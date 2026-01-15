/**
 * Database Schema
 *
 * This file defines the core database tables for an event-driven architecture.
 * The schema follows these principles:
 *
 * 1. CURRENT STATE: Mutable tables that represent the current state of entities
 * 2. DOMAIN EVENTS: Append-only table storing all domain events (event sourcing lite)
 * 3. OUTBOX: Transactional outbox for reliable event publishing
 * 4. AUDIT LOG: Immutable audit trail with before/after snapshots
 *
 * Why separate these?
 * - Current state is optimized for reads and queries
 * - Domain events provide a complete history of what happened
 * - Outbox ensures events are published reliably (at-least-once delivery)
 * - Audit log provides compliance and debugging capabilities
 */

import { AnyColumn, sql, SQL } from 'drizzle-orm';
import {
  pgEnum,
  pgTable,
  timestamp,
  varchar,
  text,
  jsonb,
  boolean,
  index,
  uuid,
  integer,
} from 'drizzle-orm/pg-core';

// ============================================================================
// ENUMS
// ============================================================================

export const statusType = pgEnum('status_type', ['active', 'inactive', 'suspended']);

export const outboxStatus = pgEnum('outbox_status', ['pending', 'processing', 'completed', 'failed']);

export const actionType = pgEnum('action_type', [
  'create',
  'update',
  'delete',
  'suspend',
  'activate',
  'custom',
]);

export const policyStatus = pgEnum('policy_status', ['draft', 'active', 'suspended', 'revoked']);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const increment = (column: AnyColumn, value = 1) => {
  return sql`${column} + ${value}`;
};

export function lower(column: AnyColumn): SQL {
  return sql`lower(${column})`;
}

// ============================================================================
// CURRENT STATE TABLES (Mutable)
// These represent the current state of entities and are optimized for queries
// ============================================================================

/**
 * Users table - Current state of user entities
 * This is the "read-optimized" view of a user
 */
export const users = pgTable(
  'users',
  {
    id: varchar('id').primaryKey().notNull(),
    email: varchar('email').notNull(),
    name: varchar('name'),
    status: statusType('status').default('active').notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('users_email_idx').on(lower(table.email)),
    index('users_status_idx').on(table.status),
    index('users_created_at_idx').on(table.createdAt),
  ],
);

/**
 * Actions table - Represents tracked actions/operations in the system
 * This is an example aggregate that demonstrates the event-driven pattern
 */
export const actions = pgTable(
  'actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    type: actionType('type').notNull(),
    name: varchar('name').notNull(),
    description: text('description'),
    status: statusType('status').default('active').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('actions_user_id_idx').on(table.userId),
    index('actions_type_idx').on(table.type),
    index('actions_status_idx').on(table.status),
    index('actions_created_at_idx').on(table.createdAt),
  ],
);

/**
 * Policies table - Represents business policies/rules that can be managed
 * Demonstrates different business logic than Action aggregate
 */
export const policies = pgTable(
  'policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    rules: jsonb('rules').$type<Record<string, unknown>>().notNull(),
    status: policyStatus('status').default('draft').notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspensionReason: text('suspension_reason'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revocationReason: text('revocation_reason'),
    revokedBy: varchar('revoked_by', { length: 100 }),
  },
  (table) => [
    index('policies_user_id_idx').on(table.userId),
    index('policies_status_idx').on(table.status),
    index('policies_created_at_idx').on(table.createdAt),
  ],
);

// ============================================================================
// DOMAIN EVENTS TABLE (Append-Only)
// Stores all domain events that have occurred in the system
// This is the "source of truth" for what happened
// ============================================================================

/**
 * Domain Events table
 *
 * Why append-only?
 * - Provides a complete audit trail of all changes
 * - Enables event replay for debugging or rebuilding state
 * - Supports event sourcing patterns if needed in the future
 *
 * Key fields:
 * - aggregateType: The type of entity (e.g., 'User', 'Action')
 * - aggregateId: The ID of the specific entity
 * - eventType: What happened (e.g., 'UserCreated', 'ActionCompleted')
 * - payload: The event data (typed per event)
 * - metadata: Contextual information (correlation ID, actor, etc.)
 */
export const domainEvents = pgTable(
  'domain_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 100 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    eventVersion: integer('event_version').default(1).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    metadata: jsonb('metadata')
      .$type<{
        correlationId: string;
        causationId?: string;
        actor: { id: string; email: string };
        timestamp: string;
        version: number;
      }>()
      .notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('domain_events_aggregate_idx').on(table.aggregateType, table.aggregateId),
    index('domain_events_event_type_idx').on(table.eventType),
    index('domain_events_occurred_at_idx').on(table.occurredAt),
    index('domain_events_correlation_idx').using(
      'btree',
      sql`(metadata->>'correlationId')`,
    ),
  ],
);

// ============================================================================
// OUTBOX TABLE (Transactional Outbox Pattern)
// Ensures reliable event publishing with at-least-once delivery
// ============================================================================

/**
 * Event Outbox table
 *
 * Why transactional outbox?
 * - Guarantees that events are published if and only if the transaction commits
 * - Prevents the dual-write problem (state update + event publish)
 * - Enables at-least-once delivery semantics
 *
 * How it works:
 * 1. Domain event is written to both domain_events AND outbox in same transaction
 * 2. Background worker polls outbox for pending events
 * 3. Worker publishes to message queue and marks as completed
 * 4. If publish fails, event stays pending for retry
 */
export const eventOutbox = pgTable(
  'event_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => domainEvents.id),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 100 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: outboxStatus('status').default('pending').notNull(),
    retryCount: integer('retry_count').default(0).notNull(),
    maxRetries: integer('max_retries').default(5).notNull(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  },
  (table) => [
    index('event_outbox_status_idx').on(table.status),
    index('event_outbox_created_at_idx').on(table.createdAt),
    index('event_outbox_next_retry_idx').on(table.nextRetryAt),
    index('event_outbox_event_type_idx').on(table.eventType),
  ],
);

// ============================================================================
// AUDIT LOG TABLE (Immutable)
// Provides a complete, tamper-evident audit trail
// ============================================================================

/**
 * Audit Log table
 *
 * Why immutable audit logs?
 * - Compliance requirements (SOC2, GDPR, HIPAA, etc.)
 * - Debugging and incident investigation
 * - Legal evidence trail
 *
 * Key features:
 * - Never updated or deleted
 * - Includes before/after snapshots for all changes
 * - Tracks who, what, when, and why
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    correlationId: varchar('correlation_id', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: varchar('entity_id', { length: 100 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    actorId: varchar('actor_id', { length: 100 }).notNull(),
    actorEmail: varchar('actor_email', { length: 255 }).notNull(),
    actorIp: varchar('actor_ip', { length: 45 }),
    actorUserAgent: text('actor_user_agent'),
    beforeSnapshot: jsonb('before_snapshot').$type<Record<string, unknown> | null>(),
    afterSnapshot: jsonb('after_snapshot').$type<Record<string, unknown> | null>(),
    changes: jsonb('changes').$type<Record<string, { from: unknown; to: unknown }>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_log_entity_idx').on(table.entityType, table.entityId),
    index('audit_log_actor_idx').on(table.actorId),
    index('audit_log_correlation_idx').on(table.correlationId),
    index('audit_log_occurred_at_idx').on(table.occurredAt),
    index('audit_log_action_idx').on(table.action),
  ],
);

// ============================================================================
// PROCESSED EVENTS TABLE (Idempotency)
// Tracks which events have been processed by each handler
// ============================================================================

/**
 * Processed Events table
 *
 * Why track processed events?
 * - Ensures idempotent event handling (process each event exactly once)
 * - Prevents duplicate side effects if events are redelivered
 * - Enables safe retries without duplicating work
 */
export const processedEvents = pgTable(
  'processed_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id').notNull(),
    handlerName: varchar('handler_name', { length: 100 }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('processed_events_event_handler_idx').on(table.eventId, table.handlerName),
  ],
);
