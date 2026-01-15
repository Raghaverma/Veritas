/**
 * Policies Repository
 *
 * Data access layer for policies.
 * Follows the same pattern as ActionsRepo.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../helpers/drizzle/drizzle.service';
import { EventStoreService } from '../event-bus/event-store.service';
import { policies } from '../db/schema';
import { Policy } from '../db/types';
import { PolicyAggregate } from '../domain/aggregates/policy.aggregate';
import { IDomainEvent } from '../shared/types/event.types';
import { eq } from 'drizzle-orm';
import { EntityNotFoundError } from '../shared/errors/domain.errors';

@Injectable()
export class PoliciesRepo {
    private readonly logger = new Logger(PoliciesRepo.name);

    constructor(
        private readonly drizzleService: DrizzleService,
        private readonly eventStore: EventStoreService,
    ) { }

    async findById(policyId: string): Promise<PolicyAggregate | null> {
        const result = await this.drizzleService.db
            .select()
            .from(policies)
            .where(eq(policies.id, policyId))
            .limit(1);

        if (result.length === 0) {
            return null;
        }

        const row = result[0];
        return PolicyAggregate.fromState({
            id: row.id,
            userId: row.userId,
            name: row.name,
            description: row.description,
            rules: row.rules,
            status: row.status,
            version: row.version,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            activatedAt: row.activatedAt,
            suspendedAt: row.suspendedAt,
            suspensionReason: row.suspensionReason,
            revokedAt: row.revokedAt,
            revocationReason: row.revocationReason,
            revokedBy: row.revokedBy,
        });
    }

    async findByIdOrFail(policyId: string): Promise<PolicyAggregate> {
        const policy = await this.findById(policyId);
        if (!policy) {
            throw new EntityNotFoundError('Policy', policyId);
        }
        return policy;
    }

    async save(
        aggregate: PolicyAggregate,
        events: IDomainEvent[],
    ): Promise<Policy> {
        return this.eventStore.withTransaction(async (tx, persistEvents) => {
            const state = aggregate.toState();

            const [inserted] = await tx
                .insert(policies)
                .values({
                    id: state.id,
                    userId: state.userId,
                    name: state.name,
                    description: state.description,
                    rules: state.rules,
                    status: state.status,
                    version: state.version,
                    createdAt: state.createdAt,
                    updatedAt: state.updatedAt,
                    activatedAt: state.activatedAt,
                    suspendedAt: state.suspendedAt,
                    suspensionReason: state.suspensionReason,
                    revokedAt: state.revokedAt,
                    revocationReason: state.revocationReason,
                    revokedBy: state.revokedBy,
                })
                .returning();

            await persistEvents(events);

            this.logger.debug({
                message: 'Policy saved with events',
                policyId: state.id,
                eventCount: events.length,
            });

            return inserted;
        });
    }

    async update(
        aggregate: PolicyAggregate,
        events: IDomainEvent[],
        expectedVersion: number,
    ): Promise<Policy> {
        return this.eventStore.withTransaction(async (tx, persistEvents) => {
            const state = aggregate.toState();

            const result = await tx
                .update(policies)
                .set({
                    name: state.name,
                    description: state.description,
                    rules: state.rules,
                    status: state.status,
                    version: state.version,
                    updatedAt: state.updatedAt,
                    activatedAt: state.activatedAt,
                    suspendedAt: state.suspendedAt,
                    suspensionReason: state.suspensionReason,
                    revokedAt: state.revokedAt,
                    revocationReason: state.revocationReason,
                    revokedBy: state.revokedBy,
                })
                .where(eq(policies.id, state.id))
                .returning();

            if (result.length === 0) {
                throw new EntityNotFoundError('Policy', state.id);
            }

            await persistEvents(events);

            this.logger.debug({
                message: 'Policy updated with events',
                policyId: state.id,
                newVersion: state.version,
                eventCount: events.length,
            });

            return result[0];
        });
    }
}
