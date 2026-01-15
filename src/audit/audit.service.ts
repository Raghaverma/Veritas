/**
 * Audit Service
 *
 * Provides immutable audit logging for compliance and debugging.
 * Audit logs capture who did what, when, and the before/after state.
 *
 * Key principles:
 * - Audit logs are NEVER updated or deleted (append-only)
 * - Every state change should produce an audit record
 * - Includes before/after snapshots for accountability
 * - Supports compliance requirements (SOC2, GDPR, HIPAA)
 *
 * Usage:
 * - Call createAuditLog() after any state-changing operation
 * - Event handlers automatically create audit logs via ActionAuditHandler
 * - Use queryAuditLog() for auditing and debugging
 */

import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../helpers/drizzle/drizzle.service';
import { auditLog } from '../db/schema';
import { NewAuditLogEntry, AuditLogEntry } from '../db/types';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

/**
 * Input for creating an audit log entry.
 */
export interface CreateAuditLogInput {
  correlationId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorEmail: string;
  actorIp?: string;
  actorUserAgent?: string;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
}

/**
 * Query options for audit log.
 */
export interface QueryAuditLogOptions {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  correlationId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly drizzleService: DrizzleService) {}

  /**
   * Create an immutable audit log entry.
   *
   * This method only inserts - it never updates or deletes.
   * This is intentional for compliance and audit trail integrity.
   */
  async createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    const record: NewAuditLogEntry = {
      correlationId: input.correlationId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      actorIp: input.actorIp ?? null,
      actorUserAgent: input.actorUserAgent ?? null,
      beforeSnapshot: input.beforeSnapshot ?? null,
      afterSnapshot: input.afterSnapshot ?? null,
      changes: input.changes ?? null,
      metadata: input.metadata ?? null,
    };

    const [inserted] = await this.drizzleService.db
      .insert(auditLog)
      .values(record)
      .returning();

    this.logger.debug({
      message: 'Audit log created',
      auditLogId: inserted.id,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      correlationId: input.correlationId,
    });

    return inserted;
  }

  /**
   * Query audit logs with filters.
   *
   * Results are ordered by occurredAt descending (most recent first).
   */
  async queryAuditLog(options: QueryAuditLogOptions): Promise<{
    entries: AuditLogEntry[];
    total: number;
  }> {
    const conditions: ReturnType<typeof eq>[] = [];

    if (options.entityType) {
      conditions.push(eq(auditLog.entityType, options.entityType));
    }
    if (options.entityId) {
      conditions.push(eq(auditLog.entityId, options.entityId));
    }
    if (options.actorId) {
      conditions.push(eq(auditLog.actorId, options.actorId));
    }
    if (options.action) {
      conditions.push(eq(auditLog.action, options.action));
    }
    if (options.correlationId) {
      conditions.push(eq(auditLog.correlationId, options.correlationId));
    }
    if (options.fromDate) {
      conditions.push(gte(auditLog.occurredAt, options.fromDate));
    }
    if (options.toDate) {
      conditions.push(lte(auditLog.occurredAt, options.toDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [entries, countResult] = await Promise.all([
      this.drizzleService.db
        .select()
        .from(auditLog)
        .where(whereClause)
        .orderBy(desc(auditLog.occurredAt))
        .limit(options.limit ?? 50)
        .offset(options.offset ?? 0),
      this.drizzleService.db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(whereClause),
    ]);

    return {
      entries,
      total: countResult[0]?.count ?? 0,
    };
  }

  /**
   * Get the audit trail for a specific entity.
   *
   * Returns all audit log entries for the entity, ordered by time.
   * This is useful for viewing the complete history of changes.
   */
  async getEntityAuditTrail(
    entityType: string,
    entityId: string,
  ): Promise<AuditLogEntry[]> {
    return this.drizzleService.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityType, entityType),
          eq(auditLog.entityId, entityId),
        ),
      )
      .orderBy(desc(auditLog.occurredAt));
  }

  /**
   * Get all audit entries for a correlation ID.
   *
   * This shows all changes that happened as part of a single request.
   * Useful for debugging and understanding the impact of a request.
   */
  async getAuditTrailByCorrelation(
    correlationId: string,
  ): Promise<AuditLogEntry[]> {
    return this.drizzleService.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.correlationId, correlationId))
      .orderBy(desc(auditLog.occurredAt));
  }

  /**
   * Get audit entries for a specific actor.
   *
   * Shows all changes made by a user.
   */
  async getActorAuditTrail(
    actorId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<AuditLogEntry[]> {
    return this.drizzleService.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.actorId, actorId))
      .orderBy(desc(auditLog.occurredAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);
  }
}
