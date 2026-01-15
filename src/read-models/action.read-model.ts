/**
 * Action Read Model
 *
 * Read-optimized queries for action data.
 * This is separate from the command/domain layer to enable:
 *
 * 1. Query optimization without affecting write paths
 * 2. Different data shapes for different views
 * 3. Caching without cache invalidation complexity
 * 4. Clear separation of concerns (CQRS-lite)
 *
 * Key principles:
 * - No business logic here (that belongs in the domain layer)
 * - Optimized for specific UI/API requirements
 * - Can join multiple tables for composite views
 * - Can use caching for frequently accessed data
 */

import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../helpers/drizzle/drizzle.service';
import { CacheService } from '../helpers/cache/cache.service';
import { actions, users, domainEvents } from '../db/schema';
import { DomainEvent } from '../db/types';
import { eq, desc, and, sql, gte, lte, or, like } from 'drizzle-orm';

/**
 * Action detail view with user information.
 */
export interface ActionDetailView {
  id: string;
  name: string;
  type: string;
  description: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

/**
 * Action list item (lighter than detail view).
 */
export interface ActionListItem {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: Date;
  userId: string;
  userName: string | null;
}

/**
 * Query options for listing actions.
 */
export interface ListActionsOptions {
  userId?: string;
  status?: 'active' | 'inactive' | 'suspended';
  type?: 'create' | 'update' | 'delete' | 'suspend' | 'activate' | 'custom';
  search?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Action statistics.
 */
export interface ActionStats {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  byType: Record<string, number>;
}

@Injectable()
export class ActionReadModel {
  private readonly logger = new Logger(ActionReadModel.name);
  private readonly CACHE_TTL = 60;

  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly cacheService: CacheService,
  ) { }

  /**
   * Get a single action with full details.
   */
  async getActionById(actionId: string): Promise<ActionDetailView | null> {
    const cacheKey = `action:detail:${actionId}`;
    const cached = await this.cacheService.get<ActionDetailView>(
      cacheKey,
      true,
    );

    if (cached) {
      return cached;
    }

    const result = await this.drizzleService.db
      .select({
        id: actions.id,
        name: actions.name,
        type: actions.type,
        description: actions.description,
        status: actions.status,
        metadata: actions.metadata,
        version: actions.version,
        createdAt: actions.createdAt,
        updatedAt: actions.updatedAt,
        completedAt: actions.completedAt,
        userId: users.id,
        userEmail: users.email,
        userName: users.name,
      })
      .from(actions)
      .innerJoin(users, eq(actions.userId, users.id))
      .where(eq(actions.id, actionId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    const view: ActionDetailView = {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      status: row.status,
      metadata: row.metadata,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
      user: {
        id: row.userId,
        email: row.userEmail,
        name: row.userName,
      },
    };

    await this.cacheService.set(cacheKey, view, this.CACHE_TTL);

    return view;
  }

  /**
   * List actions with filtering and pagination.
   */
  async listActions(options: ListActionsOptions): Promise<{
    items: ActionListItem[];
    total: number;
  }> {
    const conditions: ReturnType<typeof eq>[] = [];

    if (options.userId) {
      conditions.push(eq(actions.userId, options.userId));
    }
    if (options.status) {
      conditions.push(eq(actions.status, options.status));
    }
    if (options.type) {
      conditions.push(eq(actions.type, options.type));
    }
    if (options.fromDate) {
      conditions.push(gte(actions.createdAt, options.fromDate));
    }
    if (options.toDate) {
      conditions.push(lte(actions.createdAt, options.toDate));
    }
    if (options.search) {
      conditions.push(
        or(
          like(actions.name, `%${options.search}%`),
          like(actions.description, `%${options.search}%`),
        ) as ReturnType<typeof eq>,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      this.drizzleService.db
        .select({
          id: actions.id,
          name: actions.name,
          type: actions.type,
          status: actions.status,
          createdAt: actions.createdAt,
          userId: actions.userId,
          userName: users.name,
        })
        .from(actions)
        .leftJoin(users, eq(actions.userId, users.id))
        .where(whereClause)
        .orderBy(desc(actions.createdAt))
        .limit(options.limit ?? 20)
        .offset(options.offset ?? 0),
      this.drizzleService.db
        .select({ count: sql<number>`count(*)::int` })
        .from(actions)
        .where(whereClause),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
    };
  }

  /**
   * Get actions for a specific user.
   */
  async getActionsForUser(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ActionListItem[]> {
    return this.drizzleService.db
      .select({
        id: actions.id,
        name: actions.name,
        type: actions.type,
        status: actions.status,
        createdAt: actions.createdAt,
        userId: actions.userId,
        userName: users.name,
      })
      .from(actions)
      .leftJoin(users, eq(actions.userId, users.id))
      .where(eq(actions.userId, userId))
      .orderBy(desc(actions.createdAt))
      .limit(options?.limit ?? 20)
      .offset(options?.offset ?? 0);
  }

  /**
   * Get action statistics.
   */
  async getActionStats(userId?: string): Promise<ActionStats> {
    const whereClause = userId ? eq(actions.userId, userId) : undefined;

    const [statusCounts, typeCounts] = await Promise.all([
      this.drizzleService.db
        .select({
          status: actions.status,
          count: sql<number>`count(*)::int`,
        })
        .from(actions)
        .where(whereClause)
        .groupBy(actions.status),
      this.drizzleService.db
        .select({
          type: actions.type,
          count: sql<number>`count(*)::int`,
        })
        .from(actions)
        .where(whereClause)
        .groupBy(actions.type),
    ]);

    const stats: ActionStats = {
      total: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      byType: {},
    };

    for (const row of statusCounts) {
      stats.total += row.count;
      if (row.status === 'active') {
        stats.active = row.count;
      } else if (row.status === 'inactive') {
        stats.completed = row.count;
      }
    }

    for (const row of typeCounts) {
      stats.byType[row.type] = row.count;
    }

    return stats;
  }

  /**
   * Get action history (events) for an action.
   */
  async getActionHistory(actionId: string): Promise<DomainEvent[]> {
    return this.drizzleService.db
      .select()
      .from(domainEvents)
      .where(
        and(
          eq(domainEvents.aggregateType, 'Action'),
          eq(domainEvents.aggregateId, actionId),
        ),
      )
      .orderBy(desc(domainEvents.occurredAt));
  }

  /**
   * Invalidate cached action data.
   * Call this when an action is modified.
   */
  async invalidateCache(actionId: string): Promise<void> {
    await this.cacheService.del(`action:detail:${actionId}`);
  }
}
