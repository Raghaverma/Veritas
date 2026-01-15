/**
 * Aggregate Types
 *
 * Aggregates are the core domain objects that enforce business rules
 * and maintain consistency boundaries. They are the "gatekeepers" of
 * the domain logic.
 *
 * Key principles:
 * - Aggregates enforce all business rules for their entity
 * - Aggregates emit domain events when state changes
 * - Aggregates are loaded and saved as a whole
 * - Aggregates use version numbers for optimistic concurrency
 *
 * The aggregate pattern:
 * Load -> Validate Command -> Apply Changes -> Emit Events -> Save
 */

import { IDomainEvent } from './event.types';

/**
 * Base interface for all aggregates.
 *
 * Why track uncommitted events?
 * - Allows collecting events during a use case
 * - Events are persisted together with state changes
 * - Clear separation between "what happened" and "current state"
 */
export interface IAggregate<TId = string> {
  readonly id: TId;
  readonly version: number;
  getUncommittedEvents(): IDomainEvent[];
  clearUncommittedEvents(): void;
}

/**
 * Base class for aggregates.
 * Provides common functionality for event collection and versioning.
 */
export abstract class AggregateRoot<TId = string> implements IAggregate<TId> {
  abstract readonly id: TId;
  private _version: number = 0;
  private _uncommittedEvents: IDomainEvent[] = [];

  get version(): number {
    return this._version;
  }

  protected setVersion(version: number): void {
    this._version = version;
  }

  /**
   * Apply an event to the aggregate.
   * This should update the aggregate's state and record the event.
   */
  protected apply(event: IDomainEvent): void {
    this._uncommittedEvents.push(event);
  }

  /**
   * Get all events that haven't been saved yet.
   */
  getUncommittedEvents(): IDomainEvent[] {
    return [...this._uncommittedEvents];
  }

  /**
   * Clear uncommitted events after they've been saved.
   */
  clearUncommittedEvents(): void {
    this._uncommittedEvents = [];
  }

  /**
   * Increment version for optimistic concurrency.
   */
  protected incrementVersion(): void {
    this._version++;
  }
}

/**
 * Result of an aggregate operation.
 * Can be either success (with events) or failure (with reason).
 */
export type AggregateResult<TError = AggregateError> =
  | { success: true; events: IDomainEvent[] }
  | { success: false; error: TError };

/**
 * Standard aggregate error structure.
 */
export interface AggregateError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Helper to create a successful aggregate result.
 */
export function aggregateSuccess(
  events: IDomainEvent[],
): AggregateResult<never> {
  return { success: true, events };
}

/**
 * Helper to create a failed aggregate result.
 */
export function aggregateFailure<E extends AggregateError>(
  error: E,
): AggregateResult<E> {
  return { success: false, error };
}

/**
 * Business rule violation error.
 */
export interface BusinessRuleViolation extends AggregateError {
  code: 'BUSINESS_RULE_VIOLATION';
  rule: string;
}

/**
 * Create a business rule violation error.
 */
export function businessRuleViolation(
  rule: string,
  message: string,
  details?: Record<string, unknown>,
): BusinessRuleViolation {
  return {
    code: 'BUSINESS_RULE_VIOLATION',
    rule,
    message,
    details,
  };
}

/**
 * Invariant violation - when an internal consistency check fails.
 */
export function invariantViolation(message: string): never {
  throw new Error(`Invariant violation: ${message}`);
}
