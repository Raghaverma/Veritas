/**
 * Policy Audit Handler
 *
 * Listens to policy events and creates audit log entries.
 * Demonstrates the event-to-audit-log flow for Policy aggregate.
 *
 * FAILURE DEMONSTRATION:
 * This handler includes controlled failure logic for testing retry behavior.
 * If event metadata contains `simulateFailure: true`, the handler will fail
 * on first attempts and succeed on the final retry.
 */

import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler, IDomainEvent } from '../../shared/types/event.types';
import { EventHandler } from '../domain-events.processor';
import { AuditService } from '../../audit/audit.service';
import { PolicyEventTypes } from '../../domain/events/policy.events';
import { RequestContext } from '../../shared/context/request-context';

@Injectable()
@EventHandler([
    PolicyEventTypes.POLICY_CREATED,
    PolicyEventTypes.POLICY_ACTIVATED,
    PolicyEventTypes.POLICY_SUSPENDED,
    PolicyEventTypes.POLICY_RESUMED,
    PolicyEventTypes.POLICY_REVOKED,
])
export class PolicyAuditHandler implements IEventHandler<IDomainEvent> {
    readonly handlerName = 'PolicyAuditHandler';
    private readonly logger = new Logger(PolicyAuditHandler.name);
    private readonly failureAttempts = new Map<string, number>();

    constructor(private readonly auditService: AuditService) { }

    async handle(event: IDomainEvent): Promise<void> {
        const context = RequestContext.current();
        const { eventType, aggregateType, aggregateId, payload, metadata } = event;

        this.logger.debug({
            message: 'Creating audit log for policy event',
            eventType,
            aggregateId,
            correlationId: metadata.correlationId,
        });

        const shouldSimulateFailure = (payload as { simulateFailure?: boolean }).simulateFailure === true;

        if (shouldSimulateFailure) {
            const attemptKey = `${aggregateId}:${eventType}`;
            const currentAttempt = (this.failureAttempts.get(attemptKey) || 0) + 1;
            this.failureAttempts.set(attemptKey, currentAttempt);

            this.logger.warn({
                message: 'Simulating failure for testing',
                eventType,
                aggregateId,
                attempt: currentAttempt,
                correlationId: metadata.correlationId,
            });

            if (currentAttempt < 3) {
                throw new Error(
                    `Simulated failure (attempt ${currentAttempt}/3). This will trigger retry logic.`,
                );
            }

            this.logger.log({
                message: 'Final retry attempt - allowing success',
                eventType,
                aggregateId,
                attempt: currentAttempt,
            });

            this.failureAttempts.delete(attemptKey);
        }

        const action = this.mapEventTypeToAction(eventType);

        const { beforeSnapshot, afterSnapshot, changes } = this.extractSnapshots(
            eventType,
            payload as Record<string, unknown>,
        );

        await this.auditService.createAuditLog({
            correlationId: metadata.correlationId,
            entityType: aggregateType,
            entityId: aggregateId,
            action,
            actorId: metadata.actor.id,
            actorEmail: metadata.actor.email,
            actorIp: context?.clientIp ?? undefined,
            actorUserAgent: context?.userAgent ?? undefined,
            beforeSnapshot,
            afterSnapshot,
            changes,
            metadata: {
                eventType,
                eventVersion: metadata.version,
                timestamp: metadata.timestamp,
            },
        });

        this.logger.debug({
            message: 'Audit log created for policy event',
            eventType,
            aggregateId,
        });
    }

    private mapEventTypeToAction(eventType: string): string {
        switch (eventType) {
            case PolicyEventTypes.POLICY_CREATED:
                return 'create';
            case PolicyEventTypes.POLICY_ACTIVATED:
                return 'activate';
            case PolicyEventTypes.POLICY_SUSPENDED:
                return 'suspend';
            case PolicyEventTypes.POLICY_RESUMED:
                return 'resume';
            case PolicyEventTypes.POLICY_REVOKED:
                return 'revoke';
            default:
                return 'unknown';
        }
    }

    private extractSnapshots(
        eventType: string,
        payload: Record<string, unknown>,
    ): {
        beforeSnapshot: Record<string, unknown> | null;
        afterSnapshot: Record<string, unknown> | null;
        changes: Record<string, { from: unknown; to: unknown }> | undefined;
    } {
        switch (eventType) {
            case PolicyEventTypes.POLICY_CREATED:
                return {
                    beforeSnapshot: null,
                    afterSnapshot: payload as Record<string, unknown>,
                    changes: undefined,
                };

            case PolicyEventTypes.POLICY_ACTIVATED:
                return {
                    beforeSnapshot: null,
                    afterSnapshot: {
                        policyId: payload.policyId,
                        status: 'active',
                        activatedAt: payload.activatedAt,
                    },
                    changes: {
                        status: { from: 'draft', to: 'active' },
                    },
                };

            case PolicyEventTypes.POLICY_SUSPENDED:
                return {
                    beforeSnapshot: null,
                    afterSnapshot: {
                        policyId: payload.policyId,
                        status: 'suspended',
                        suspendedAt: payload.suspendedAt,
                        reason: payload.reason,
                    },
                    changes: {
                        status: { from: 'active', to: 'suspended' },
                    },
                };

            case PolicyEventTypes.POLICY_RESUMED:
                return {
                    beforeSnapshot: null,
                    afterSnapshot: {
                        policyId: payload.policyId,
                        status: 'active',
                        resumedAt: payload.resumedAt,
                    },
                    changes: {
                        status: { from: 'suspended', to: 'active' },
                    },
                };

            case PolicyEventTypes.POLICY_REVOKED:
                return {
                    beforeSnapshot: null,
                    afterSnapshot: {
                        policyId: payload.policyId,
                        status: 'revoked',
                        revokedAt: payload.revokedAt,
                        reason: payload.reason,
                        revokedBy: payload.revokedBy,
                    },
                    changes: {
                        status: { from: 'active/suspended', to: 'revoked' },
                    },
                };

            default:
                return {
                    beforeSnapshot: null,
                    afterSnapshot: payload as Record<string, unknown>,
                    changes: undefined,
                };
        }
    }
}
