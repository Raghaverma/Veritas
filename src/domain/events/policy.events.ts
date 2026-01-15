/**
 * Policy Domain Events
 *
 * Events representing state changes in the Policy aggregate.
 * Policies represent business rules that can be activated, suspended, or revoked.
 *
 * State transitions:
 * draft → active → suspended → active (resume)
 * draft/active/suspended → revoked (final state)
 */

import { IDomainEvent, EventMetadata, AggregateTypes } from '../../shared/types/event.types';
import { PolicyStatus } from '../../db/types';

export const PolicyEventTypes = {
    POLICY_CREATED: 'policy.created',
    POLICY_ACTIVATED: 'policy.activated',
    POLICY_SUSPENDED: 'policy.suspended',
    POLICY_RESUMED: 'policy.resumed',
    POLICY_REVOKED: 'policy.revoked',
} as const;

export type PolicyEventType = (typeof PolicyEventTypes)[keyof typeof PolicyEventTypes];

// ============================================================================
// EVENT PAYLOADS
// ============================================================================

export interface PolicyCreatedPayload {
    policyId: string;
    userId: string;
    name: string;
    description: string | null;
    rules: Record<string, unknown>;
    status: PolicyStatus;
    version: number;
    createdAt: string;
}

export interface PolicyActivatedPayload {
    policyId: string;
    activatedAt: string;
    newVersion: number;
}

export interface PolicySuspendedPayload {
    policyId: string;
    reason: string;
    suspendedAt: string;
    newVersion: number;
}

export interface PolicyResumedPayload {
    policyId: string;
    resumedAt: string;
    newVersion: number;
}

export interface PolicyRevokedPayload {
    policyId: string;
    reason: string;
    revokedBy: string;
    revokedAt: string;
    newVersion: number;
}

// ============================================================================
// EVENT INTERFACES
// ============================================================================

export interface PolicyCreatedEvent extends IDomainEvent<PolicyCreatedPayload> {
    eventType: typeof PolicyEventTypes.POLICY_CREATED;
}

export interface PolicyActivatedEvent extends IDomainEvent<PolicyActivatedPayload> {
    eventType: typeof PolicyEventTypes.POLICY_ACTIVATED;
}

export interface PolicySuspendedEvent extends IDomainEvent<PolicySuspendedPayload> {
    eventType: typeof PolicyEventTypes.POLICY_SUSPENDED;
}

export interface PolicyResumedEvent extends IDomainEvent<PolicyResumedPayload> {
    eventType: typeof PolicyEventTypes.POLICY_RESUMED;
}

export interface PolicyRevokedEvent extends IDomainEvent<PolicyRevokedPayload> {
    eventType: typeof PolicyEventTypes.POLICY_REVOKED;
}

export type PolicyEvent =
    | PolicyCreatedEvent
    | PolicyActivatedEvent
    | PolicySuspendedEvent
    | PolicyResumedEvent
    | PolicyRevokedEvent;

// ============================================================================
// EVENT FACTORIES
// ============================================================================

export function createPolicyCreatedEvent(
    aggregateId: string,
    payload: PolicyCreatedPayload,
    metadata: Omit<EventMetadata, 'version'>,
): PolicyCreatedEvent {
    return {
        eventType: PolicyEventTypes.POLICY_CREATED,
        aggregateType: AggregateTypes.POLICY,
        aggregateId,
        payload,
        metadata: { ...metadata, version: 1 },
    };
}

export function createPolicyActivatedEvent(
    aggregateId: string,
    payload: PolicyActivatedPayload,
    metadata: Omit<EventMetadata, 'version'>,
): PolicyActivatedEvent {
    return {
        eventType: PolicyEventTypes.POLICY_ACTIVATED,
        aggregateType: AggregateTypes.POLICY,
        aggregateId,
        payload,
        metadata: { ...metadata, version: 1 },
    };
}

export function createPolicySuspendedEvent(
    aggregateId: string,
    payload: PolicySuspendedPayload,
    metadata: Omit<EventMetadata, 'version'>,
): PolicySuspendedEvent {
    return {
        eventType: PolicyEventTypes.POLICY_SUSPENDED,
        aggregateType: AggregateTypes.POLICY,
        aggregateId,
        payload,
        metadata: { ...metadata, version: 1 },
    };
}

export function createPolicyResumedEvent(
    aggregateId: string,
    payload: PolicyResumedPayload,
    metadata: Omit<EventMetadata, 'version'>,
): PolicyResumedEvent {
    return {
        eventType: PolicyEventTypes.POLICY_RESUMED,
        aggregateType: AggregateTypes.POLICY,
        aggregateId,
        payload,
        metadata: { ...metadata, version: 1 },
    };
}

export function createPolicyRevokedEvent(
    aggregateId: string,
    payload: PolicyRevokedPayload,
    metadata: Omit<EventMetadata, 'version'>,
): PolicyRevokedEvent {
    return {
        eventType: PolicyEventTypes.POLICY_REVOKED,
        aggregateType: AggregateTypes.POLICY,
        aggregateId,
        payload,
        metadata: { ...metadata, version: 1 },
    };
}
