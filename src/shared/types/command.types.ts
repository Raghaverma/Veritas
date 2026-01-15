/**
 * Command Types
 *
 * Commands represent user intent - they describe what the user wants to do.
 * Commands are NOT the same as events; they may be rejected or succeed.
 *
 * Key principles:
 * - Commands are imperative (CreateUser, UpdateAction)
 * - Commands can fail (validation, business rules, conflicts)
 * - Commands are handled synchronously
 * - Commands produce zero or more events on success
 *
 * The command flow:
 * Request -> Validation -> Command -> Handler -> Domain Logic -> Events
 */

import { Actor } from '../context/request-context';

/**
 * Metadata attached to every command for tracing and auditing
 */
export interface CommandMetadata {
  correlationId: string;
  causationId?: string;
  actor: Actor;
  timestamp: Date;
}

/**
 * Base interface for all commands.
 * Every command must have a type (for routing) and metadata (for tracing).
 */
export interface ICommand<TPayload = unknown> {
  readonly type: string;
  readonly payload: TPayload;
  readonly metadata: CommandMetadata;
}

/**
 * Result of command execution - either success or failure.
 * Using a discriminated union for type-safe error handling.
 *
 * Why not throw exceptions?
 * - Explicit error handling forces consideration of failure cases
 * - Type-safe error data (not just strings)
 * - Easier to test
 * - Better performance (no stack traces for expected failures)
 */
export type CommandResult<TSuccess, TError = CommandError> =
  | { success: true; data: TSuccess }
  | { success: false; error: TError };

/**
 * Standard command error structure.
 * Provides consistent error responses across all commands.
 */
export interface CommandError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Common error codes for command failures.
 * Use these for consistent error handling across the application.
 */
export const CommandErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  OPTIMISTIC_LOCK_FAILED: 'OPTIMISTIC_LOCK_FAILED',
} as const;

export type CommandErrorCode = (typeof CommandErrorCodes)[keyof typeof CommandErrorCodes];

/**
 * Interface for command handlers.
 * Each command type has exactly one handler.
 *
 * Why one handler per command?
 * - Single responsibility
 * - Clear ownership
 * - Easy to test in isolation
 * - Explicit dependencies
 */
export interface ICommandHandler<TCommand extends ICommand, TResult> {
  execute(command: TCommand): Promise<CommandResult<TResult>>;
}

/**
 * Helper function to create a successful command result.
 */
export function commandSuccess<T>(data: T): CommandResult<T, never> {
  return { success: true, data };
}

/**
 * Helper function to create a failed command result.
 */
export function commandFailure<E extends CommandError>(error: E): CommandResult<never, E> {
  return { success: false, error };
}

/**
 * Helper to create a standard command error.
 */
export function createCommandError(
  code: CommandErrorCode,
  message: string,
  details?: Record<string, unknown>,
): CommandError {
  return { code, message, details };
}
