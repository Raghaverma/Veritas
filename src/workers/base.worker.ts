/**
 * Base Worker
 *
 * Abstract base class for BullMQ workers.
 * Provides common functionality for event processing:
 * - Idempotency checking
 * - Error handling
 * - Logging
 * - Correlation ID propagation
 *
 * Why use a base class?
 * - Consistent error handling across all workers
 * - Automatic idempotency tracking
 * - Standardized logging
 * - Reduces boilerplate in concrete workers
 */

import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DrizzleService } from '../helpers/drizzle/drizzle.service';
import { processedEvents } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { RequestContext, Actor } from '../shared/context/request-context';

/**
 * Standard job data structure for domain events.
 */
export interface DomainEventJobData {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown> & {
    metadata?: {
      correlationId: string;
      causationId?: string;
      actor: Actor;
      timestamp: string;
      version: number;
    };
  };
}

/**
 * Abstract base class for workers that process domain events.
 *
 * Concrete implementations must:
 * 1. Implement getHandlerName() - unique identifier for idempotency
 * 2. Implement processEvent() - the actual event processing logic
 * 3. Optionally override shouldProcess() - to filter events
 */
export abstract class BaseDomainEventWorker {
  protected abstract readonly logger: Logger;

  constructor(protected readonly drizzleService: DrizzleService) {}

  /**
   * Get the unique handler name for idempotency tracking.
   * Each handler should have a unique name.
   */
  protected abstract getHandlerName(): string;

  /**
   * Process the event. Implement this in concrete workers.
   */
  protected abstract processEvent(
    job: Job<DomainEventJobData>,
  ): Promise<void>;

  /**
   * Check if this handler should process the event.
   * Override to filter events by type or other criteria.
   */
  protected shouldProcess(job: Job<DomainEventJobData>): boolean {
    return true;
  }

  /**
   * Main entry point for job processing.
   * Handles idempotency, logging, and error handling.
   */
  async handleJob(job: Job<DomainEventJobData>): Promise<void> {
    const { eventId, eventType, aggregateType, aggregateId, payload } = job.data;
    const handlerName = this.getHandlerName();

    if (!this.shouldProcess(job)) {
      this.logger.debug({
        message: 'Skipping event - not handled by this worker',
        eventId,
        eventType,
        handlerName,
      });
      return;
    }

    if (await this.isAlreadyProcessed(eventId)) {
      this.logger.debug({
        message: 'Event already processed - skipping',
        eventId,
        eventType,
        handlerName,
      });
      return;
    }

    const correlationId = payload.metadata?.correlationId ?? eventId;
    const actor = payload.metadata?.actor ?? { id: 'system', email: 'system@internal' };

    const context = RequestContext.createBackgroundContext({
      correlationId,
      causationId: eventId,
      actor,
    });

    await RequestContext.run(context, async () => {
      this.logger.log({
        message: 'Processing event',
        eventId,
        eventType,
        aggregateType,
        aggregateId,
        handlerName,
        correlationId,
      });

      const startTime = Date.now();

      try {
        await this.processEvent(job);

        await this.markAsProcessed(eventId);

        const duration = Date.now() - startTime;
        this.logger.log({
          message: 'Event processed successfully',
          eventId,
          eventType,
          handlerName,
          durationMs: duration,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger.error({
          message: 'Event processing failed',
          eventId,
          eventType,
          handlerName,
          durationMs: duration,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });

        throw error;
      }
    });
  }

  /**
   * Check if this event has already been processed by this handler.
   */
  private async isAlreadyProcessed(eventId: string): Promise<boolean> {
    const result = await this.drizzleService.db
      .select({ id: processedEvents.id })
      .from(processedEvents)
      .where(
        and(
          eq(processedEvents.eventId, eventId),
          eq(processedEvents.handlerName, this.getHandlerName()),
        ),
      )
      .limit(1);

    return result.length > 0;
  }

  /**
   * Mark this event as processed by this handler.
   */
  private async markAsProcessed(eventId: string): Promise<void> {
    await this.drizzleService.db.insert(processedEvents).values({
      eventId,
      handlerName: this.getHandlerName(),
    });
  }
}
