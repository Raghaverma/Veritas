/**
 * Domain Events Processor
 *
 * BullMQ processor for domain events.
 * Dispatches events to registered handlers.
 *
 * This is the main entry point for async event processing.
 * It uses the NestJS/BullMQ processor pattern to:
 * 1. Receive events from the domain-events queue
 * 2. Dispatch to registered event handlers
 * 3. Handle failures and retries
 *
 * Event handlers are registered using the @EventHandler decorator
 * and automatically discovered during module initialization.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Job } from 'bullmq';
import { DOMAIN_EVENTS_QUEUE } from '../event-bus/outbox-processor.service';
import { DomainEventJobData } from './base.worker';
import { IEventHandler, IDomainEvent } from '../shared/types/event.types';
import { RequestContext } from '../shared/context/request-context';
import { DrizzleService } from '../helpers/drizzle/drizzle.service';
import { processedEvents } from '../db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Token used to identify event handlers in the DI container.
 */
export const EVENT_HANDLER_METADATA = 'EVENT_HANDLER_METADATA';

/**
 * Decorator to mark a class as an event handler.
 * The eventTypes array specifies which events this handler processes.
 */
export function EventHandler(eventTypes: string[]): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(EVENT_HANDLER_METADATA, eventTypes, target);
  };
}

/**
 * Registry for event handlers.
 * Maps event types to handler classes.
 */
@Injectable()
export class EventHandlerRegistry {
  private handlers = new Map<string, Type<IEventHandler<IDomainEvent>>[]>();
  private readonly logger = new Logger(EventHandlerRegistry.name);

  /**
   * Register a handler for an event type.
   */
  register(
    eventType: string,
    handler: Type<IEventHandler<IDomainEvent>>,
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
    this.logger.log(
      `Registered handler ${handler.name} for event type: ${eventType}`,
    );
  }

  /**
   * Get all handlers for an event type.
   */
  getHandlers(eventType: string): Type<IEventHandler<IDomainEvent>>[] {
    return this.handlers.get(eventType) ?? [];
  }

  /**
   * Get all registered event types.
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Main BullMQ processor for domain events.
 */
@Processor(DOMAIN_EVENTS_QUEUE)
export class DomainEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(DomainEventsProcessor.name);

  constructor(
    private readonly registry: EventHandlerRegistry,
    private readonly moduleRef: ModuleRef,
    private readonly drizzleService: DrizzleService,
  ) {
    super();
  }

  /**
   * Process a job from the queue.
   */
  async process(job: Job<DomainEventJobData>): Promise<void> {
    const { eventId, eventType, aggregateType, aggregateId, payload } =
      job.data;

    const correlationId = payload.metadata?.correlationId ?? eventId;
    const actor = payload.metadata?.actor ?? {
      id: 'system',
      email: 'system@internal',
    };

    const context = RequestContext.createBackgroundContext({
      correlationId,
      causationId: eventId,
      actor,
    });

    await RequestContext.run(context, async () => {
      this.logger.log({
        message: 'Processing domain event',
        eventId,
        eventType,
        aggregateType,
        aggregateId,
        correlationId,
        jobAttempt: job.attemptsMade,
      });

      const handlers = this.registry.getHandlers(eventType);

      if (handlers.length === 0) {
        this.logger.debug({
          message: 'No handlers registered for event type',
          eventType,
          eventId,
        });
        return;
      }

      const event: IDomainEvent = {
        eventType,
        aggregateType,
        aggregateId,
        payload,
        metadata: payload.metadata ?? {
          correlationId,
          actor,
          timestamp: new Date().toISOString(),
          version: 1,
        },
      };

      const results = await Promise.allSettled(
        handlers.map((handlerClass) =>
          this.executeHandler(handlerClass, event, eventId),
        ),
      );

      const failures = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );

      if (failures.length > 0) {
        this.logger.error({
          message: 'Some event handlers failed',
          eventId,
          eventType,
          failedCount: failures.length,
          totalCount: handlers.length,
          errors: failures.map((f) => f.reason?.message ?? 'Unknown error'),
        });

        if (failures.length === handlers.length) {
          throw new Error(`All handlers failed for event ${eventId}`);
        }
      }

      this.logger.log({
        message: 'Event processing completed',
        eventId,
        eventType,
        handlersExecuted: handlers.length,
        handlersFailed: failures.length,
      });
    });
  }

  /**
   * Execute a single handler for an event.
   */
  private async executeHandler(
    handlerClass: Type<IEventHandler<IDomainEvent>>,
    event: IDomainEvent,
    eventId: string,
  ): Promise<void> {
    const handler = this.moduleRef.get(handlerClass, { strict: false });
    const handlerName = handler.handlerName;

    if (await this.isAlreadyProcessed(eventId, handlerName)) {
      this.logger.debug({
        message: 'Event already processed by handler - skipping',
        eventId,
        handlerName,
      });
      return;
    }

    const startTime = Date.now();

    try {
      await handler.handle(event);

      await this.markAsProcessed(eventId, handlerName);

      const duration = Date.now() - startTime;
      this.logger.debug({
        message: 'Handler completed',
        handlerName,
        eventId,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        message: 'Handler failed',
        handlerName,
        eventId,
        durationMs: duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if an event has already been processed by a handler.
   */
  private async isAlreadyProcessed(
    eventId: string,
    handlerName: string,
  ): Promise<boolean> {
    const result = await this.drizzleService.db
      .select({ id: processedEvents.id })
      .from(processedEvents)
      .where(
        and(
          eq(processedEvents.eventId, eventId),
          eq(processedEvents.handlerName, handlerName),
        ),
      )
      .limit(1);

    return result.length > 0;
  }

  /**
   * Mark an event as processed by a handler.
   */
  private async markAsProcessed(
    eventId: string,
    handlerName: string,
  ): Promise<void> {
    await this.drizzleService.db
      .insert(processedEvents)
      .values({
        eventId,
        handlerName,
      })
      .onConflictDoNothing();
  }
}
