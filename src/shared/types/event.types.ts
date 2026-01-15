/**
 * Event Types
 *
 * Domain events represent facts that have happened in the system.
 * Unlike commands (which can fail), events are immutable records of what occurred.
 *
 * Key principles:
 * - Events are past tense (UserCreated, ActionCompleted)
 * - Events are immutable - they cannot be changed or deleted
 * - Events are the source of truth for what happened
 * - Events can be replayed to rebuild state
 *
 * The event flow:
 * Command Success -> Domain Event Created -> Persisted -> Published -> Consumed
 */

import { Actor } from '../context/request-context';

/**
 * Metadata attached to every domain event.
 * This information is critical for:
 * - Tracing (correlationId links events to original request)
 * - Auditing (who did what when)
 * - Ordering (timestamp)
 * - Versioning (for schema evolution)
 */
export interface EventMetadata {
  correlationId: string;
  causationId?: string;
  actor: Actor;
  timestamp: string;
  version: number;
}

/**
 * Base interface for all domain events.
 *
 * Why include aggregateType and aggregateId?
 * - Enables event replay per aggregate
 * - Allows filtering events by entity
 * - Supports event sourcing patterns
 */
export interface IDomainEvent<TPayload = unknown> {
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: TPayload;
  readonly metadata: EventMetadata;
}

/**
 * Interface for domain event handlers (subscribers).
 * Handlers react to events and perform side effects.
 *
 * Key principles:
 * - Handlers should be idempotent (safe to process same event twice)
 * - Handlers should not throw (log and move to DLQ instead)
 * - Handlers can trigger new commands/events
 */
export interface IEventHandler<TEvent extends IDomainEvent> {
  readonly handlerName: string;
  handle(event: TEvent): Promise<void>;
}

/**
 * Options for publishing events.
 */
export interface PublishOptions {
  immediate?: boolean;
  delay?: number;
  priority?: number;
}

/**
 * Interface for the event publisher.
 * This abstracts the actual publishing mechanism (BullMQ, etc.).
 */
export interface IEventPublisher {
  publish(event: IDomainEvent, options?: PublishOptions): Promise<void>;
  publishBatch(events: IDomainEvent[], options?: PublishOptions): Promise<void>;
}

/**
 * Factory function type for creating domain events.
 * Ensures consistent event creation with all required metadata.
 */
export type EventFactory<TPayload> = (
  aggregateId: string,
  payload: TPayload,
  metadata: Omit<EventMetadata, 'version'>,
) => IDomainEvent<TPayload>;

/**
 * Helper to create an event factory for a specific event type.
 */
export function createEventFactory<TPayload>(
  eventType: string,
  aggregateType: string,
  version: number = 1,
): EventFactory<TPayload> {
  return (aggregateId, payload, metadata) => ({
    eventType,
    aggregateType,
    aggregateId,
    payload,
    metadata: { ...metadata, version },
  });
}

/**
 * Aggregate types used in the system.
 * Adding new aggregates? Add them here.
 */
export const AggregateTypes = {
  USER: 'User',
  ACTION: 'Action',
  POLICY: 'Policy',
} as const;

export type AggregateType =
  (typeof AggregateTypes)[keyof typeof AggregateTypes];
