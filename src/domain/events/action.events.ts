/**
 * Action Domain Events
 *
 * Domain events represent facts that have occurred in the system.
 * They are immutable, past-tense records of state changes.
 *
 * Naming convention:
 * - Past tense (Created, Updated, Completed)
 * - Start with aggregate name (Action)
 * - Describe what happened, not what will happen
 *
 * Event payloads:
 * - Include all data needed to understand what happened
 * - Include the state AFTER the change (for projections)
 * - Do not include sensitive data that shouldn't be logged
 */

import { IDomainEvent, EventMetadata, createEventFactory, AggregateTypes } from '../../shared/types/event.types';
import { ActionType, StatusType } from '../../db/types';

// ============================================================================
// EVENT TYPES
// These constants identify events throughout the system
// ============================================================================

export const ActionEventTypes = {
  ACTION_CREATED: 'action.created',
  ACTION_UPDATED: 'action.updated',
  ACTION_COMPLETED: 'action.completed',
  ACTION_CANCELLED: 'action.cancelled',
  ACTION_SUSPENDED: 'action.suspended',
  ACTION_ACTIVATED: 'action.activated',
} as const;

export type ActionEventType = (typeof ActionEventTypes)[keyof typeof ActionEventTypes];

// ============================================================================
// EVENT PAYLOADS
// Typed data structures for each event
// ============================================================================

export interface ActionCreatedPayload {
  actionId: string;
  userId: string;
  name: string;
  type: ActionType;
  description?: string;
  metadata?: Record<string, unknown>;
  status: StatusType;
  version: number;
  createdAt: string;
}

export interface ActionUpdatedPayload {
  actionId: string;
  changes: {
    name?: { from: string; to: string };
    description?: { from: string | null; to: string | null };
    metadata?: { from: Record<string, unknown> | null; to: Record<string, unknown> | null };
  };
  newVersion: number;
  updatedAt: string;
}

export interface ActionCompletedPayload {
  actionId: string;
  result?: Record<string, unknown>;
  completedAt: string;
  newVersion: number;
}

export interface ActionCancelledPayload {
  actionId: string;
  reason: string;
  cancelledAt: string;
  newVersion: number;
}

export interface ActionSuspendedPayload {
  actionId: string;
  reason?: string;
  suspendedAt: string;
  newVersion: number;
}

export interface ActionActivatedPayload {
  actionId: string;
  activatedAt: string;
  newVersion: number;
}

// ============================================================================
// EVENT INTERFACES
// Full event types with payload and metadata
// ============================================================================

export interface ActionCreatedEvent extends IDomainEvent<ActionCreatedPayload> {
  eventType: typeof ActionEventTypes.ACTION_CREATED;
}

export interface ActionUpdatedEvent extends IDomainEvent<ActionUpdatedPayload> {
  eventType: typeof ActionEventTypes.ACTION_UPDATED;
}

export interface ActionCompletedEvent extends IDomainEvent<ActionCompletedPayload> {
  eventType: typeof ActionEventTypes.ACTION_COMPLETED;
}

export interface ActionCancelledEvent extends IDomainEvent<ActionCancelledPayload> {
  eventType: typeof ActionEventTypes.ACTION_CANCELLED;
}

export interface ActionSuspendedEvent extends IDomainEvent<ActionSuspendedPayload> {
  eventType: typeof ActionEventTypes.ACTION_SUSPENDED;
}

export interface ActionActivatedEvent extends IDomainEvent<ActionActivatedPayload> {
  eventType: typeof ActionEventTypes.ACTION_ACTIVATED;
}

// Union type for all action events
export type ActionEvent =
  | ActionCreatedEvent
  | ActionUpdatedEvent
  | ActionCompletedEvent
  | ActionCancelledEvent
  | ActionSuspendedEvent
  | ActionActivatedEvent;

// ============================================================================
// EVENT FACTORIES
// Helper functions to create properly typed events
// ============================================================================

export function createActionCreatedEvent(
  aggregateId: string,
  payload: ActionCreatedPayload,
  metadata: Omit<EventMetadata, 'version'>,
): ActionCreatedEvent {
  return {
    eventType: ActionEventTypes.ACTION_CREATED,
    aggregateType: AggregateTypes.ACTION,
    aggregateId,
    payload,
    metadata: { ...metadata, version: 1 },
  };
}

export function createActionUpdatedEvent(
  aggregateId: string,
  payload: ActionUpdatedPayload,
  metadata: Omit<EventMetadata, 'version'>,
): ActionUpdatedEvent {
  return {
    eventType: ActionEventTypes.ACTION_UPDATED,
    aggregateType: AggregateTypes.ACTION,
    aggregateId,
    payload,
    metadata: { ...metadata, version: 1 },
  };
}

export function createActionCompletedEvent(
  aggregateId: string,
  payload: ActionCompletedPayload,
  metadata: Omit<EventMetadata, 'version'>,
): ActionCompletedEvent {
  return {
    eventType: ActionEventTypes.ACTION_COMPLETED,
    aggregateType: AggregateTypes.ACTION,
    aggregateId,
    payload,
    metadata: { ...metadata, version: 1 },
  };
}

export function createActionCancelledEvent(
  aggregateId: string,
  payload: ActionCancelledPayload,
  metadata: Omit<EventMetadata, 'version'>,
): ActionCancelledEvent {
  return {
    eventType: ActionEventTypes.ACTION_CANCELLED,
    aggregateType: AggregateTypes.ACTION,
    aggregateId,
    payload,
    metadata: { ...metadata, version: 1 },
  };
}

export function createActionSuspendedEvent(
  aggregateId: string,
  payload: ActionSuspendedPayload,
  metadata: Omit<EventMetadata, 'version'>,
): ActionSuspendedEvent {
  return {
    eventType: ActionEventTypes.ACTION_SUSPENDED,
    aggregateType: AggregateTypes.ACTION,
    aggregateId,
    payload,
    metadata: { ...metadata, version: 1 },
  };
}

export function createActionActivatedEvent(
  aggregateId: string,
  payload: ActionActivatedPayload,
  metadata: Omit<EventMetadata, 'version'>,
): ActionActivatedEvent {
  return {
    eventType: ActionEventTypes.ACTION_ACTIVATED,
    aggregateType: AggregateTypes.ACTION,
    aggregateId,
    payload,
    metadata: { ...metadata, version: 1 },
  };
}
