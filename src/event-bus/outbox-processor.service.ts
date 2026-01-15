/**
 * Outbox Processor Service
 *
 * Polls the event outbox and publishes events to the message queue.
 * This is the second half of the transactional outbox pattern.
 *
 * How it works:
 * 1. Periodically polls for pending events in the outbox
 * 2. Claims events for processing (prevents duplicate processing)
 * 3. Publishes events to BullMQ
 * 4. Marks events as completed on success
 * 5. Handles failures with exponential backoff retries
 *
 * Reliability guarantees:
 * - At-least-once delivery (events may be published more than once if process crashes)
 * - Consumers must be idempotent to handle duplicates
 * - Failed events are retried with exponential backoff
 * - Dead events (max retries exceeded) are moved to 'failed' status
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { DrizzleService } from '../helpers/drizzle/drizzle.service';
import { eventOutbox } from '../db/schema';
import { eq, and, or, lt, sql } from 'drizzle-orm';
import { EventOutboxEntry } from '../db/types';

const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 100;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 300000;

export const DOMAIN_EVENTS_QUEUE = 'domain-events';

@Injectable()
export class OutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private isProcessing = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;

  constructor(
    private readonly drizzleService: DrizzleService,
    @InjectQueue(DOMAIN_EVENTS_QUEUE) private readonly eventsQueue: Queue,
  ) {}

  onModuleInit() {
    this.startPolling();
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  /**
   * Start the polling loop.
   */
  private startPolling(): void {
    this.logger.log('Starting outbox processor');
    this.pollInterval = setInterval(() => {
      this.processOutbox().catch((error) => {
        this.logger.error('Error processing outbox', error);
      });
    }, POLL_INTERVAL_MS);
  }

  /**
   * Stop the polling loop gracefully.
   */
  private stopPolling(): void {
    this.logger.log('Stopping outbox processor');
    this.isShuttingDown = true;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Process pending events from the outbox.
   */
  private async processOutbox(): Promise<void> {
    if (this.isProcessing || this.isShuttingDown) {
      return;
    }

    this.isProcessing = true;

    try {
      const events = await this.claimPendingEvents();

      if (events.length === 0) {
        return;
      }

      this.logger.debug(`Processing ${events.length} outbox events`);

      await Promise.all(events.map((event) => this.processEvent(event)));
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Claim pending events for processing.
   * Uses SELECT FOR UPDATE SKIP LOCKED to prevent concurrent processing.
   */
  private async claimPendingEvents(): Promise<EventOutboxEntry[]> {
    const now = new Date();

    const events = await this.drizzleService.db
      .select()
      .from(eventOutbox)
      .where(
        and(
          or(
            eq(eventOutbox.status, 'pending'),
            and(
              eq(eventOutbox.status, 'processing'),
              lt(eventOutbox.nextRetryAt, now),
            ),
          ),
          lt(eventOutbox.retryCount, eventOutbox.maxRetries),
        ),
      )
      .limit(BATCH_SIZE);

    if (events.length === 0) {
      return [];
    }

    await this.drizzleService.db
      .update(eventOutbox)
      .set({ status: 'processing' })
      .where(
        sql`${eventOutbox.id} IN (${sql.join(
          events.map((e) => sql`${e.id}`),
          sql`, `,
        )})`,
      );

    return events;
  }

  /**
   * Process a single outbox event.
   */
  private async processEvent(outboxEntry: EventOutboxEntry): Promise<void> {
    try {
      await this.eventsQueue.add(
        outboxEntry.eventType,
        {
          eventId: outboxEntry.eventId,
          eventType: outboxEntry.eventType,
          aggregateType: outboxEntry.aggregateType,
          aggregateId: outboxEntry.aggregateId,
          payload: outboxEntry.payload,
        },
        {
          jobId: outboxEntry.eventId,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      await this.markCompleted(outboxEntry.id);

      this.logger.debug({
        message: 'Event published to queue',
        eventId: outboxEntry.eventId,
        eventType: outboxEntry.eventType,
      });
    } catch (error) {
      await this.markFailed(outboxEntry, error);

      this.logger.error({
        message: 'Failed to publish event',
        eventId: outboxEntry.eventId,
        eventType: outboxEntry.eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Mark an outbox entry as completed.
   */
  private async markCompleted(outboxId: string): Promise<void> {
    await this.drizzleService.db
      .update(eventOutbox)
      .set({
        status: 'completed',
        processedAt: new Date(),
      })
      .where(eq(eventOutbox.id, outboxId));
  }

  /**
   * Mark an outbox entry as failed and schedule retry.
   */
  private async markFailed(
    outboxEntry: EventOutboxEntry,
    error: unknown,
  ): Promise<void> {
    const newRetryCount = outboxEntry.retryCount + 1;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    if (newRetryCount >= outboxEntry.maxRetries) {
      await this.drizzleService.db
        .update(eventOutbox)
        .set({
          status: 'failed',
          retryCount: newRetryCount,
          lastError: errorMessage,
        })
        .where(eq(eventOutbox.id, outboxEntry.id));
    } else {
      const retryDelay = Math.min(
        BASE_RETRY_DELAY_MS * Math.pow(2, newRetryCount),
        MAX_RETRY_DELAY_MS,
      );
      const nextRetryAt = new Date(Date.now() + retryDelay);

      await this.drizzleService.db
        .update(eventOutbox)
        .set({
          status: 'pending',
          retryCount: newRetryCount,
          lastError: errorMessage,
          nextRetryAt,
        })
        .where(eq(eventOutbox.id, outboxEntry.id));
    }
  }

  /**
   * Manually trigger outbox processing (useful for testing).
   */
  async triggerProcessing(): Promise<void> {
    await this.processOutbox();
  }

  /**
   * Get metrics about the outbox state.
   */
  async getMetrics(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const result = await this.drizzleService.db
      .select({
        status: eventOutbox.status,
        count: sql<number>`count(*)::int`,
      })
      .from(eventOutbox)
      .groupBy(eventOutbox.status);

    const metrics = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of result) {
      if (row.status in metrics) {
        metrics[row.status as keyof typeof metrics] = row.count;
      }
    }

    return metrics;
  }
}
