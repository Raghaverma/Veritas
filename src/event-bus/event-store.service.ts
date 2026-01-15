/**
 * Event Store Service
 *
 * Persists domain events to the database using the transactional outbox pattern.
 * This ensures reliable event publishing with at-least-once delivery semantics.
 *
 * The transactional outbox pattern:
 * 1. Domain events are written to both domain_events AND event_outbox tables
 * 2. Both writes happen in the SAME database transaction
 * 3. A separate worker polls the outbox and publishes to the message queue
 * 4. This guarantees events are published if and only if the transaction commits
 *
 * Why not publish directly?
 * - If we publish to a queue and the DB transaction fails, we have orphaned events
 * - If we commit to DB and queue publish fails, we have missing events
 * - The outbox pattern solves this "dual write" problem
 */

import { Injectable, Logger } from '@nestjs/common';
import { IDomainEvent } from '../shared/types/event.types';
import { DrizzleService } from '../helpers/drizzle/drizzle.service';
import { domainEvents, eventOutbox } from '../db/schema';
import { NewDomainEvent, NewEventOutboxEntry } from '../db/types';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';

type DrizzleTransaction = Parameters<Parameters<PostgresJsDatabase<typeof schema>['transaction']>[0]>[0];

@Injectable()
export class EventStoreService {
  private readonly logger = new Logger(EventStoreService.name);

  constructor(private readonly drizzleService: DrizzleService) {}

  /**
   * Persist a single domain event with outbox entry.
   * Use persistEvents for multiple events in a transaction.
   */
  async persistEvent(event: IDomainEvent): Promise<{ eventId: string }> {
    return this.drizzleService.db.transaction(async (tx) => {
      return this.persistEventInTransaction(tx, event);
    });
  }

  /**
   * Persist multiple domain events in a single transaction.
   * All events are written to both domain_events and event_outbox.
   */
  async persistEvents(events: IDomainEvent[]): Promise<{ eventIds: string[] }> {
    if (events.length === 0) {
      return { eventIds: [] };
    }

    return this.drizzleService.db.transaction(async (tx) => {
      const results = await Promise.all(
        events.map((event) => this.persistEventInTransaction(tx, event)),
      );
      return { eventIds: results.map((r) => r.eventId) };
    });
  }

  /**
   * Persist events as part of an existing transaction.
   * Use this when you need to include event persistence in a larger transaction.
   */
  async persistEventsWithTransaction(
    tx: DrizzleTransaction,
    events: IDomainEvent[],
  ): Promise<{ eventIds: string[] }> {
    if (events.length === 0) {
      return { eventIds: [] };
    }

    const results = await Promise.all(
      events.map((event) => this.persistEventInTransaction(tx, event)),
    );
    return { eventIds: results.map((r) => r.eventId) };
  }

  /**
   * Internal method to persist a single event within a transaction.
   */
  private async persistEventInTransaction(
    tx: DrizzleTransaction,
    event: IDomainEvent,
  ): Promise<{ eventId: string }> {
    const domainEventRecord: NewDomainEvent = {
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      eventVersion: event.metadata.version,
      payload: event.payload as Record<string, unknown>,
      metadata: event.metadata,
    };

    const [insertedEvent] = await tx
      .insert(domainEvents)
      .values(domainEventRecord)
      .returning({ id: domainEvents.id });

    const outboxRecord: NewEventOutboxEntry = {
      eventId: insertedEvent.id,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: {
        ...(event.payload as Record<string, unknown>),
        metadata: event.metadata,
      },
      status: 'pending',
    };

    await tx.insert(eventOutbox).values(outboxRecord);

    this.logger.debug({
      message: 'Event persisted',
      eventId: insertedEvent.id,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      correlationId: event.metadata.correlationId,
    });

    return { eventId: insertedEvent.id };
  }

  /**
   * Get the database transaction wrapper for external use.
   * This allows other services to include event persistence in their transactions.
   */
  async withTransaction<T>(
    callback: (tx: DrizzleTransaction, persistEvents: (events: IDomainEvent[]) => Promise<{ eventIds: string[] }>) => Promise<T>,
  ): Promise<T> {
    return this.drizzleService.db.transaction(async (tx) => {
      const persistEvents = (events: IDomainEvent[]) =>
        this.persistEventsWithTransaction(tx, events);
      return callback(tx, persistEvents);
    });
  }
}
