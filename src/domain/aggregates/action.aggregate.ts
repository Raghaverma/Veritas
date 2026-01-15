/**
 * Action Aggregate
 *
 * The Action aggregate encapsulates all business rules for actions.
 * It is the single source of truth for action-related domain logic.
 *
 * Key responsibilities:
 * - Enforce business rules (invariants)
 * - Manage state transitions
 * - Emit domain events on successful operations
 *
 * Why aggregates?
 * - Encapsulates all business logic in one place
 * - Prevents invalid state transitions
 * - Makes testing business rules straightforward
 * - Provides a clear boundary for transactions
 */

import { v7 as uuidv7 } from 'uuid';
import {
  AggregateRoot,
  AggregateResult,
  aggregateSuccess,
  aggregateFailure,
  businessRuleViolation,
} from '../../shared/types/aggregate.types';
import { EventMetadata } from '../../shared/types/event.types';
import { ActionType, StatusType } from '../../db/types';
import {
  createActionCreatedEvent,
  createActionUpdatedEvent,
  createActionCompletedEvent,
  createActionCancelledEvent,
} from '../events/action.events';

// ============================================================================
// ACTION STATE
// The internal state of an action
// ============================================================================

interface ActionState {
  id: string;
  userId: string;
  name: string;
  type: ActionType;
  description: string | null;
  metadata: Record<string, unknown> | null;
  status: StatusType;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

// ============================================================================
// ACTION AGGREGATE
// ============================================================================

export class ActionAggregate extends AggregateRoot<string> {
  private state: ActionState;

  private constructor(state: ActionState) {
    super();
    this.state = state;
    this.setVersion(state.version);
  }

  // ============================================================================
  // ACCESSORS
  // Read-only access to aggregate state
  // ============================================================================

  get id(): string {
    return this.state.id;
  }

  get userId(): string {
    return this.state.userId;
  }

  get name(): string {
    return this.state.name;
  }

  get type(): ActionType {
    return this.state.type;
  }

  get description(): string | null {
    return this.state.description;
  }

  get metadata(): Record<string, unknown> | null {
    return this.state.metadata;
  }

  get status(): StatusType {
    return this.state.status;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get updatedAt(): Date {
    return this.state.updatedAt;
  }

  get completedAt(): Date | null {
    return this.state.completedAt;
  }

  // ============================================================================
  // FACTORY METHODS
  // Create new aggregates or reconstitute from storage
  // ============================================================================

  /**
   * Create a new action.
   *
   * Business rules:
   * - Name is required and must not be empty
   * - Type must be valid
   */
  static create(
    userId: string,
    name: string,
    type: ActionType,
    description: string | null,
    metadata: Record<string, unknown> | null,
    eventMetadata: Omit<EventMetadata, 'version'>,
  ): AggregateResult {
    if (!name || name.trim().length === 0) {
      return aggregateFailure(
        businessRuleViolation(
          'action.name.required',
          'Action name is required and cannot be empty',
        ),
      );
    }

    if (name.length > 200) {
      return aggregateFailure(
        businessRuleViolation(
          'action.name.too_long',
          'Action name cannot exceed 200 characters',
        ),
      );
    }

    const id = uuidv7();
    const now = new Date();

    const state: ActionState = {
      id,
      userId,
      name: name.trim(),
      type,
      description: description?.trim() || null,
      metadata,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    const aggregate = new ActionAggregate(state);

    const event = createActionCreatedEvent(
      id,
      {
        actionId: id,
        userId,
        name: state.name,
        type,
        description: state.description ?? undefined,
        metadata: metadata ?? undefined,
        status: 'active',
        version: 1,
        createdAt: now.toISOString(),
      },
      eventMetadata,
    );

    aggregate.apply(event);

    return aggregateSuccess(aggregate.getUncommittedEvents());
  }

  /**
   * Reconstitute an aggregate from stored state.
   * Used when loading from the database.
   */
  static fromState(state: {
    id: string;
    userId: string;
    name: string;
    type: ActionType;
    description: string | null;
    metadata: Record<string, unknown> | null;
    status: StatusType;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }): ActionAggregate {
    return new ActionAggregate(state);
  }

  // ============================================================================
  // COMMAND METHODS
  // Operations that may change state and emit events
  // ============================================================================

  /**
   * Update action properties.
   *
   * Business rules:
   * - Cannot update completed or cancelled actions
   * - Name cannot be empty if provided
   * - Version must match for optimistic concurrency
   */
  update(
    changes: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    },
    expectedVersion: number,
    eventMetadata: Omit<EventMetadata, 'version'>,
  ): AggregateResult {
    if (this.state.version !== expectedVersion) {
      return aggregateFailure(
        businessRuleViolation(
          'action.version.mismatch',
          `Version mismatch: expected ${expectedVersion}, found ${this.state.version}`,
          { expectedVersion, actualVersion: this.state.version },
        ),
      );
    }

    if (this.state.status === 'inactive') {
      return aggregateFailure(
        businessRuleViolation(
          'action.update.inactive',
          'Cannot update an inactive (completed/cancelled) action',
        ),
      );
    }

    if (changes.name !== undefined && changes.name.trim().length === 0) {
      return aggregateFailure(
        businessRuleViolation(
          'action.name.required',
          'Action name cannot be empty',
        ),
      );
    }

    if (changes.name !== undefined && changes.name.length > 200) {
      return aggregateFailure(
        businessRuleViolation(
          'action.name.too_long',
          'Action name cannot exceed 200 characters',
        ),
      );
    }

    const changeRecord: {
      name?: { from: string; to: string };
      description?: { from: string | null; to: string | null };
      metadata?: {
        from: Record<string, unknown> | null;
        to: Record<string, unknown> | null;
      };
    } = {};

    const now = new Date();
    const newVersion = this.state.version + 1;

    if (changes.name !== undefined && changes.name !== this.state.name) {
      changeRecord.name = { from: this.state.name, to: changes.name.trim() };
      this.state.name = changes.name.trim();
    }

    if (
      changes.description !== undefined &&
      changes.description !== this.state.description
    ) {
      changeRecord.description = {
        from: this.state.description,
        to: changes.description?.trim() || null,
      };
      this.state.description = changes.description?.trim() || null;
    }

    if (changes.metadata !== undefined) {
      changeRecord.metadata = {
        from: this.state.metadata,
        to: changes.metadata,
      };
      this.state.metadata = changes.metadata;
    }

    if (Object.keys(changeRecord).length === 0) {
      return aggregateSuccess([]);
    }

    this.state.version = newVersion;
    this.state.updatedAt = now;
    this.setVersion(newVersion);

    const event = createActionUpdatedEvent(
      this.state.id,
      {
        actionId: this.state.id,
        changes: changeRecord,
        newVersion,
        updatedAt: now.toISOString(),
      },
      eventMetadata,
    );

    this.apply(event);

    return aggregateSuccess(this.getUncommittedEvents());
  }

  /**
   * Complete the action.
   *
   * Business rules:
   * - Can only complete active actions
   * - Version must match for optimistic concurrency
   */
  complete(
    result: Record<string, unknown> | undefined,
    expectedVersion: number,
    eventMetadata: Omit<EventMetadata, 'version'>,
  ): AggregateResult {
    if (this.state.version !== expectedVersion) {
      return aggregateFailure(
        businessRuleViolation(
          'action.version.mismatch',
          `Version mismatch: expected ${expectedVersion}, found ${this.state.version}`,
          { expectedVersion, actualVersion: this.state.version },
        ),
      );
    }

    if (this.state.status !== 'active') {
      return aggregateFailure(
        businessRuleViolation(
          'action.complete.not_active',
          `Cannot complete action with status '${this.state.status}'`,
        ),
      );
    }

    const now = new Date();
    const newVersion = this.state.version + 1;

    this.state.status = 'inactive';
    this.state.completedAt = now;
    this.state.updatedAt = now;
    this.state.version = newVersion;
    this.setVersion(newVersion);

    const event = createActionCompletedEvent(
      this.state.id,
      {
        actionId: this.state.id,
        result,
        completedAt: now.toISOString(),
        newVersion,
      },
      eventMetadata,
    );

    this.apply(event);

    return aggregateSuccess(this.getUncommittedEvents());
  }

  /**
   * Cancel the action.
   *
   * Business rules:
   * - Can only cancel active actions
   * - Must provide a reason
   * - Version must match for optimistic concurrency
   */
  cancel(
    reason: string,
    expectedVersion: number,
    eventMetadata: Omit<EventMetadata, 'version'>,
  ): AggregateResult {
    if (this.state.version !== expectedVersion) {
      return aggregateFailure(
        businessRuleViolation(
          'action.version.mismatch',
          `Version mismatch: expected ${expectedVersion}, found ${this.state.version}`,
          { expectedVersion, actualVersion: this.state.version },
        ),
      );
    }

    if (this.state.status !== 'active') {
      return aggregateFailure(
        businessRuleViolation(
          'action.cancel.not_active',
          `Cannot cancel action with status '${this.state.status}'`,
        ),
      );
    }

    if (!reason || reason.trim().length === 0) {
      return aggregateFailure(
        businessRuleViolation(
          'action.cancel.reason_required',
          'Cancellation reason is required',
        ),
      );
    }

    const now = new Date();
    const newVersion = this.state.version + 1;

    this.state.status = 'inactive';
    this.state.updatedAt = now;
    this.state.version = newVersion;
    this.setVersion(newVersion);

    const event = createActionCancelledEvent(
      this.state.id,
      {
        actionId: this.state.id,
        reason: reason.trim(),
        cancelledAt: now.toISOString(),
        newVersion,
      },
      eventMetadata,
    );

    this.apply(event);

    return aggregateSuccess(this.getUncommittedEvents());
  }

  // ============================================================================
  // SERIALIZATION
  // Convert aggregate to/from storage format
  // ============================================================================

  /**
   * Convert aggregate state to a plain object for persistence.
   */
  toState(): ActionState {
    return { ...this.state };
  }

  /**
   * Get a snapshot of the current state for auditing.
   */
  toSnapshot(): Record<string, unknown> {
    return {
      id: this.state.id,
      userId: this.state.userId,
      name: this.state.name,
      type: this.state.type,
      description: this.state.description,
      metadata: this.state.metadata,
      status: this.state.status,
      version: this.state.version,
      createdAt: this.state.createdAt.toISOString(),
      updatedAt: this.state.updatedAt.toISOString(),
      completedAt: this.state.completedAt?.toISOString() ?? null,
    };
  }
}
