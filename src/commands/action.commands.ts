/**
 * Action Commands
 *
 * Commands for managing actions in the system.
 * These represent user intents to create, update, or complete actions.
 *
 * Each command:
 * - Has a unique type string for routing
 * - Contains a typed payload with the command data
 * - Includes metadata from the request context
 */

import { ICommand, CommandMetadata } from '../shared/types/command.types';
import { ActionType } from '../db/types';

// ============================================================================
// COMMAND TYPES
// These constants are used to identify commands throughout the system
// ============================================================================

export const ActionCommandTypes = {
  CREATE_ACTION: 'action.create',
  UPDATE_ACTION: 'action.update',
  COMPLETE_ACTION: 'action.complete',
  CANCEL_ACTION: 'action.cancel',
} as const;

// ============================================================================
// COMMAND PAYLOADS
// Typed data structures for each command
// ============================================================================

export interface CreateActionPayload {
  name: string;
  type: ActionType;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateActionPayload {
  actionId: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  expectedVersion: number;
}

export interface CompleteActionPayload {
  actionId: string;
  result?: Record<string, unknown>;
  expectedVersion: number;
}

export interface CancelActionPayload {
  actionId: string;
  reason: string;
  expectedVersion: number;
}

// ============================================================================
// COMMAND INTERFACES
// Full command types with payload and metadata
// ============================================================================

export interface CreateActionCommand extends ICommand<CreateActionPayload> {
  type: typeof ActionCommandTypes.CREATE_ACTION;
}

export interface UpdateActionCommand extends ICommand<UpdateActionPayload> {
  type: typeof ActionCommandTypes.UPDATE_ACTION;
}

export interface CompleteActionCommand extends ICommand<CompleteActionPayload> {
  type: typeof ActionCommandTypes.COMPLETE_ACTION;
}

export interface CancelActionCommand extends ICommand<CancelActionPayload> {
  type: typeof ActionCommandTypes.CANCEL_ACTION;
}

// Union type for all action commands
export type ActionCommand =
  | CreateActionCommand
  | UpdateActionCommand
  | CompleteActionCommand
  | CancelActionCommand;

// ============================================================================
// COMMAND FACTORIES
// Helper functions to create properly typed commands
// ============================================================================

export function createCreateActionCommand(
  payload: CreateActionPayload,
  metadata: CommandMetadata,
): CreateActionCommand {
  return {
    type: ActionCommandTypes.CREATE_ACTION,
    payload,
    metadata,
  };
}

export function createUpdateActionCommand(
  payload: UpdateActionPayload,
  metadata: CommandMetadata,
): UpdateActionCommand {
  return {
    type: ActionCommandTypes.UPDATE_ACTION,
    payload,
    metadata,
  };
}

export function createCompleteActionCommand(
  payload: CompleteActionPayload,
  metadata: CommandMetadata,
): CompleteActionCommand {
  return {
    type: ActionCommandTypes.COMPLETE_ACTION,
    payload,
    metadata,
  };
}

export function createCancelActionCommand(
  payload: CancelActionPayload,
  metadata: CommandMetadata,
): CancelActionCommand {
  return {
    type: ActionCommandTypes.CANCEL_ACTION,
    payload,
    metadata,
  };
}
