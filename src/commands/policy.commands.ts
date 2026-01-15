/**
 * Policy Commands
 *
 * Commands represent write operations for the Policy aggregate.
 * Each command encapsulates the intent and data needed for an operation.
 */

import { ICommand, CommandMetadata } from '../shared/types/command.types';

export const PolicyCommandTypes = {
  CREATE_POLICY: 'CreatePolicy',
  ACTIVATE_POLICY: 'ActivatePolicy',
  SUSPEND_POLICY: 'SuspendPolicy',
  RESUME_POLICY: 'ResumePolicy',
  REVOKE_POLICY: 'RevokePolicy',
} as const;

export type PolicyCommandType =
  (typeof PolicyCommandTypes)[keyof typeof PolicyCommandTypes];

// ============================================================================
// COMMAND PAYLOADS
// ============================================================================

export interface CreatePolicyPayload {
  name: string;
  description?: string;
  rules: Record<string, unknown>;
}

export interface ActivatePolicyPayload {
  policyId: string;
  expectedVersion: number;
}

export interface SuspendPolicyPayload {
  policyId: string;
  reason: string;
  expectedVersion: number;
}

export interface ResumePolicyPayload {
  policyId: string;
  expectedVersion: number;
}

export interface RevokePolicyPayload {
  policyId: string;
  reason: string;
  revokedBy: string;
  expectedVersion: number;
}

// ============================================================================
// COMMAND INTERFACES
// ============================================================================

export interface CreatePolicyCommand extends ICommand<CreatePolicyPayload> {
  type: typeof PolicyCommandTypes.CREATE_POLICY;
}

export interface ActivatePolicyCommand extends ICommand<ActivatePolicyPayload> {
  type: typeof PolicyCommandTypes.ACTIVATE_POLICY;
}

export interface SuspendPolicyCommand extends ICommand<SuspendPolicyPayload> {
  type: typeof PolicyCommandTypes.SUSPEND_POLICY;
}

export interface ResumePolicyCommand extends ICommand<ResumePolicyPayload> {
  type: typeof PolicyCommandTypes.RESUME_POLICY;
}

export interface RevokePolicyCommand extends ICommand<RevokePolicyPayload> {
  type: typeof PolicyCommandTypes.REVOKE_POLICY;
}

export type PolicyCommand =
  | CreatePolicyCommand
  | ActivatePolicyCommand
  | SuspendPolicyCommand
  | ResumePolicyCommand
  | RevokePolicyCommand;

// ============================================================================
// COMMAND FACTORIES
// ============================================================================

export function createCreatePolicyCommand(
  payload: CreatePolicyPayload,
  metadata: CommandMetadata,
): CreatePolicyCommand {
  return {
    type: PolicyCommandTypes.CREATE_POLICY,
    payload,
    metadata,
  };
}

export function createActivatePolicyCommand(
  payload: ActivatePolicyPayload,
  metadata: CommandMetadata,
): ActivatePolicyCommand {
  return {
    type: PolicyCommandTypes.ACTIVATE_POLICY,
    payload,
    metadata,
  };
}

export function createSuspendPolicyCommand(
  payload: SuspendPolicyPayload,
  metadata: CommandMetadata,
): SuspendPolicyCommand {
  return {
    type: PolicyCommandTypes.SUSPEND_POLICY,
    payload,
    metadata,
  };
}

export function createResumePolicyCommand(
  payload: ResumePolicyPayload,
  metadata: CommandMetadata,
): ResumePolicyCommand {
  return {
    type: PolicyCommandTypes.RESUME_POLICY,
    payload,
    metadata,
  };
}

export function createRevokePolicyCommand(
  payload: RevokePolicyPayload,
  metadata: CommandMetadata,
): RevokePolicyCommand {
  return {
    type: PolicyCommandTypes.REVOKE_POLICY,
    payload,
    metadata,
  };
}
