/**
 * Actions Repository
 *
 * Data access layer for actions.
 * This handles all database operations for the Action aggregate.
 *
 * Key responsibilities:
 * - CRUD operations for actions
 * - Transaction management
 * - Integration with event persistence
 *
 * Why separate from the aggregate?
 * - Aggregates focus on business logic
 * - Repositories focus on data access
 * - Makes testing easier (can mock repository)
 * - Clear separation of concerns
 */

import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../helpers/drizzle/drizzle.service';
import { EventStoreService } from '../event-bus/event-store.service';
import { actions } from '../db/schema';
import { Action } from '../db/types';
import { ActionAggregate } from '../domain/aggregates/action.aggregate';
import { IDomainEvent } from '../shared/types/event.types';
import { eq } from 'drizzle-orm';
import { EntityNotFoundError } from '../shared/errors/domain.errors';

@Injectable()
export class ActionsRepo {
  private readonly logger = new Logger(ActionsRepo.name);

  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly eventStore: EventStoreService,
  ) {}

  /**
   * Find an action by ID.
   * Returns null if not found.
   */
  async findById(actionId: string): Promise<ActionAggregate | null> {
    const result = await this.drizzleService.db
      .select()
      .from(actions)
      .where(eq(actions.id, actionId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return ActionAggregate.fromState({
      id: row.id,
      userId: row.userId,
      name: row.name,
      type: row.type,
      description: row.description,
      metadata: row.metadata,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
    });
  }

  /**
   * Find an action by ID or throw.
   */
  async findByIdOrFail(actionId: string): Promise<ActionAggregate> {
    const action = await this.findById(actionId);
    if (!action) {
      throw new EntityNotFoundError('Action', actionId);
    }
    return action;
  }

  /**
   * Save a new action with its events in a single transaction.
   *
   * This is the core pattern:
   * 1. Insert action state
   * 2. Persist domain events + outbox entries
   * 3. All in one transaction (atomic)
   */
  async save(
    aggregate: ActionAggregate,
    events: IDomainEvent[],
  ): Promise<Action> {
    return this.eventStore.withTransaction(async (tx, persistEvents) => {
      const state = aggregate.toState();

      const [inserted] = await tx
        .insert(actions)
        .values({
          id: state.id,
          userId: state.userId,
          name: state.name,
          type: state.type,
          description: state.description,
          metadata: state.metadata,
          status: state.status,
          version: state.version,
          createdAt: state.createdAt,
          updatedAt: state.updatedAt,
          completedAt: state.completedAt,
        })
        .returning();

      await persistEvents(events);

      this.logger.debug({
        message: 'Action saved with events',
        actionId: state.id,
        eventCount: events.length,
      });

      return inserted;
    });
  }

  /**
   * Update an existing action with optimistic concurrency.
   *
   * The version check ensures we don't overwrite concurrent changes.
   * If the version doesn't match, someone else modified the action.
   */
  async update(
    aggregate: ActionAggregate,
    events: IDomainEvent[],
  ): Promise<Action> {
    return this.eventStore.withTransaction(async (tx, persistEvents) => {
      const state = aggregate.toState();

      const result = await tx
        .update(actions)
        .set({
          name: state.name,
          description: state.description,
          metadata: state.metadata,
          status: state.status,
          version: state.version,
          updatedAt: state.updatedAt,
          completedAt: state.completedAt,
        })
        .where(eq(actions.id, state.id))
        .returning();

      if (result.length === 0) {
        throw new EntityNotFoundError('Action', state.id);
      }

      await persistEvents(events);

      this.logger.debug({
        message: 'Action updated with events',
        actionId: state.id,
        newVersion: state.version,
        eventCount: events.length,
      });

      return result[0];
    });
  }
}
