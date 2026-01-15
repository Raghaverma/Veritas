/**
 * Policy Aggregate
 *
 * Represents a business policy/rule that can be managed through its lifecycle.
 * Unlike Action (which tracks operations), Policy enforces different business rules:
 *
 * Business Rules:
 * - Policies start in 'draft' state
 * - Must have valid rules before activation
 * - Suspension requires a reason
 * - Revocation is irreversible and requires approval
 * - Cannot modify revoked policies
 *
 * State Transitions:
 * draft → active (activate)
 * active → suspended (suspend with reason)
 * suspended → active (resume)
 * any → revoked (revoke, final state)
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
import { PolicyStatus } from '../../db/types';
import {
    PolicyCreatedEvent,
    PolicyActivatedEvent,
    PolicySuspendedEvent,
    PolicyResumedEvent,
    PolicyRevokedEvent,
    createPolicyCreatedEvent,
    createPolicyActivatedEvent,
    createPolicySuspendedEvent,
    createPolicyResumedEvent,
    createPolicyRevokedEvent,
} from '../events/policy.events';

// ============================================================================
// POLICY STATE
// ============================================================================

interface PolicyState {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    rules: Record<string, unknown>;
    status: PolicyStatus;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    activatedAt: Date | null;
    suspendedAt: Date | null;
    suspensionReason: string | null;
    revokedAt: Date | null;
    revocationReason: string | null;
    revokedBy: string | null;
}

// ============================================================================
// POLICY AGGREGATE
// ============================================================================

export class PolicyAggregate extends AggregateRoot<string> {
    private state: PolicyState;

    private constructor(state: PolicyState) {
        super();
        this.state = state;
        this.setVersion(state.version);
    }

    // ============================================================================
    // ACCESSORS
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

    get description(): string | null {
        return this.state.description;
    }

    get rules(): Record<string, unknown> {
        return this.state.rules;
    }

    get status(): PolicyStatus {
        return this.state.status;
    }

    get version(): number {
        return this.state.version;
    }

    get createdAt(): Date {
        return this.state.createdAt;
    }

    get updatedAt(): Date {
        return this.state.updatedAt;
    }

    get activatedAt(): Date | null {
        return this.state.activatedAt;
    }

    get suspendedAt(): Date | null {
        return this.state.suspendedAt;
    }

    get revokedAt(): Date | null {
        return this.state.revokedAt;
    }

    // ============================================================================
    // FACTORY METHODS
    // ============================================================================

    /**
     * Create a new policy in draft state.
     *
     * Business rules:
     * - Name is required and must be 1-200 characters
     * - Rules must be a valid object (not empty)
     */
    static create(
        userId: string,
        name: string,
        description: string | null,
        rules: Record<string, unknown>,
        eventMetadata: Omit<EventMetadata, 'version'>,
    ): AggregateResult {
        if (!name || name.trim().length === 0) {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.name.required',
                    'Policy name is required and cannot be empty',
                ),
            );
        }

        if (name.length > 200) {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.name.too_long',
                    'Policy name cannot exceed 200 characters',
                ),
            );
        }

        if (!rules || Object.keys(rules).length === 0) {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.rules.required',
                    'Policy must have at least one rule',
                ),
            );
        }

        const id = uuidv7();
        const now = new Date();

        const state: PolicyState = {
            id,
            userId,
            name: name.trim(),
            description: description?.trim() || null,
            rules,
            status: 'draft',
            version: 1,
            createdAt: now,
            updatedAt: now,
            activatedAt: null,
            suspendedAt: null,
            suspensionReason: null,
            revokedAt: null,
            revocationReason: null,
            revokedBy: null,
        };

        const aggregate = new PolicyAggregate(state);

        const event = createPolicyCreatedEvent(
            id,
            {
                policyId: id,
                userId,
                name: state.name,
                description: state.description,
                rules: state.rules,
                status: 'draft',
                version: 1,
                createdAt: now.toISOString(),
            },
            eventMetadata,
        );

        aggregate.apply(event);

        return aggregateSuccess(aggregate.getUncommittedEvents());
    }

    /**
     * Reconstitute aggregate from stored state.
     */
    static fromState(state: {
        id: string;
        userId: string;
        name: string;
        description: string | null;
        rules: Record<string, unknown>;
        status: PolicyStatus;
        version: number;
        createdAt: Date;
        updatedAt: Date;
        activatedAt: Date | null;
        suspendedAt: Date | null;
        suspensionReason: string | null;
        revokedAt: Date | null;
        revocationReason: string | null;
        revokedBy: string | null;
    }): PolicyAggregate {
        return new PolicyAggregate(state);
    }

    // ============================================================================
    // COMMAND METHODS
    // ============================================================================

    /**
     * Activate a draft policy.
     *
     * Business rules:
     * - Can only activate draft policies
     * - Rules must be valid (already validated in create)
     * - Version must match
     */
    activate(
        expectedVersion: number,
        eventMetadata: Omit<EventMetadata, 'version'>,
    ): AggregateResult {
        if (this.state.version !== expectedVersion) {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.version.mismatch',
                    `Version mismatch: expected ${expectedVersion}, found ${this.state.version}`,
                    { expectedVersion, actualVersion: this.state.version },
                ),
            );
        }

        if (this.state.status !== 'draft') {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.activate.not_draft',
                    `Cannot activate policy with status '${this.state.status}'. Only draft policies can be activated.`,
                ),
            );
        }

        const now = new Date();
        const newVersion = this.state.version + 1;

        this.state.status = 'active';
        this.state.activatedAt = now;
        this.state.updatedAt = now;
        this.state.version = newVersion;
        this.setVersion(newVersion);

        const event = createPolicyActivatedEvent(
            this.state.id,
            {
                policyId: this.state.id,
                activatedAt: now.toISOString(),
                newVersion,
            },
            eventMetadata,
        );

        this.apply(event);

        return aggregateSuccess(this.getUncommittedEvents());
    }

    /**
     * Suspend an active policy.
     *
     * Business rules:
     * - Can only suspend active policies
     * - Reason is required
     * - Version must match
     */
    suspend(
        reason: string,
        expectedVersion: number,
        eventMetadata: Omit<EventMetadata, 'version'>,
    ): AggregateResult {
        if (this.state.version !== expectedVersion) {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.version.mismatch',
                    `Version mismatch: expected ${expectedVersion}, found ${this.state.version}`,
                    { expectedVersion, actualVersion: this.state.version },
                ),
            );
        }

        if (this.state.status !== 'active') {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.suspend.not_active',
                    `Cannot suspend policy with status '${this.state.status}'. Only active policies can be suspended.`,
                ),
            );
        }

        if (!reason || reason.trim().length === 0) {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.suspend.reason_required',
                    'Suspension reason is required',
                ),
            );
        }

        const now = new Date();
        const newVersion = this.state.version + 1;

        this.state.status = 'suspended';
        this.state.suspendedAt = now;
        this.state.suspensionReason = reason.trim();
        this.state.updatedAt = now;
        this.state.version = newVersion;
        this.setVersion(newVersion);

        const event = createPolicySuspendedEvent(
            this.state.id,
            {
                policyId: this.state.id,
                reason: reason.trim(),
                suspendedAt: now.toISOString(),
                newVersion,
            },
            eventMetadata,
        );

        this.apply(event);

        return aggregateSuccess(this.getUncommittedEvents());
    }

    /**
     * Resume a suspended policy.
     *
     * Business rules:
     * - Can only resume suspended policies
     * - Version must match
     */
    resume(
        expectedVersion: number,
        eventMetadata: Omit<EventMetadata, 'version'>,
    ): AggregateResult {
        if (this.state.version !== expectedVersion) {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.version.mismatch',
                    `Version mismatch: expected ${expectedVersion}, found ${this.state.version}`,
                    { expectedVersion, actualVersion: this.state.version },
                ),
            );
        }

        if (this.state.status !== 'suspended') {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.resume.not_suspended',
                    `Cannot resume policy with status '${this.state.status}'. Only suspended policies can be resumed.`,
                ),
            );
        }

        const now = new Date();
        const newVersion = this.state.version + 1;

        this.state.status = 'active';
        this.state.suspendedAt = null;
        this.state.suspensionReason = null;
        this.state.updatedAt = now;
        this.state.version = newVersion;
        this.setVersion(newVersion);

        const event = createPolicyResumedEvent(
            this.state.id,
            {
                policyId: this.state.id,
                resumedAt: now.toISOString(),
                newVersion,
            },
            eventMetadata,
        );

        this.apply(event);

        return aggregateSuccess(this.getUncommittedEvents());
    }

    /**
     * Revoke a policy (irreversible).
     *
     * Business rules:
     * - Cannot revoke already revoked policies
     * - Reason is required
     * - Revoker ID is required (approval tracking)
     * - Version must match
     * - Revocation is final (no transitions from revoked state)
     */
    revoke(
        reason: string,
        revokedBy: string,
        expectedVersion: number,
        eventMetadata: Omit<EventMetadata, 'version'>,
    ): AggregateResult {
        if (this.state.version !== expectedVersion) {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.version.mismatch',
                    `Version mismatch: expected ${expectedVersion}, found ${this.state.version}`,
                    { expectedVersion, actualVersion: this.state.version },
                ),
            );
        }

        if (this.state.status === 'revoked') {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.revoke.already_revoked',
                    'Policy is already revoked. Revocation is irreversible.',
                ),
            );
        }

        if (!reason || reason.trim().length === 0) {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.revoke.reason_required',
                    'Revocation reason is required',
                ),
            );
        }

        if (!revokedBy || revokedBy.trim().length === 0) {
            return aggregateFailure(
                businessRuleViolation(
                    'policy.revoke.approver_required',
                    'Revoker ID is required for audit trail',
                ),
            );
        }

        const now = new Date();
        const newVersion = this.state.version + 1;

        this.state.status = 'revoked';
        this.state.revokedAt = now;
        this.state.revocationReason = reason.trim();
        this.state.revokedBy = revokedBy.trim();
        this.state.updatedAt = now;
        this.state.version = newVersion;
        this.setVersion(newVersion);

        const event = createPolicyRevokedEvent(
            this.state.id,
            {
                policyId: this.state.id,
                reason: reason.trim(),
                revokedBy: revokedBy.trim(),
                revokedAt: now.toISOString(),
                newVersion,
            },
            eventMetadata,
        );

        this.apply(event);

        return aggregateSuccess(this.getUncommittedEvents());
    }

    // ============================================================================
    // SERIALIZATION
    // ============================================================================

    toState(): PolicyState {
        return { ...this.state };
    }

    toSnapshot(): Record<string, unknown> {
        return {
            id: this.state.id,
            userId: this.state.userId,
            name: this.state.name,
            description: this.state.description,
            rules: this.state.rules,
            status: this.state.status,
            version: this.state.version,
            createdAt: this.state.createdAt.toISOString(),
            updatedAt: this.state.updatedAt.toISOString(),
            activatedAt: this.state.activatedAt?.toISOString() ?? null,
            suspendedAt: this.state.suspendedAt?.toISOString() ?? null,
            suspensionReason: this.state.suspensionReason,
            revokedAt: this.state.revokedAt?.toISOString() ?? null,
            revocationReason: this.state.revocationReason,
            revokedBy: this.state.revokedBy,
        };
    }
}
