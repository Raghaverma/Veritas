/**
 * Database Types
 *
 * Type definitions inferred from the Drizzle schema.
 * These types are used throughout the application for type safety.
 */

import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  users,
  actions,
  policies,
  domainEvents,
  eventOutbox,
  auditLog,
  processedEvents,
} from './schema';

// ============================================================================
// ENTITY TYPES (SELECT - what you get from the database)
// ============================================================================

export type User = InferSelectModel<typeof users>;
export type Action = InferSelectModel<typeof actions>;
export type Policy = InferSelectModel<typeof policies>;
export type DomainEvent = InferSelectModel<typeof domainEvents>;
export type EventOutboxEntry = InferSelectModel<typeof eventOutbox>;
export type AuditLogEntry = InferSelectModel<typeof auditLog>;
export type ProcessedEvent = InferSelectModel<typeof processedEvents>;

// ============================================================================
// INSERT TYPES (what you send to the database for creation)
// ============================================================================

export type NewUser = InferInsertModel<typeof users>;
export type NewAction = InferInsertModel<typeof actions>;
export type NewPolicy = InferInsertModel<typeof policies>;
export type NewDomainEvent = InferInsertModel<typeof domainEvents>;
export type NewEventOutboxEntry = InferInsertModel<typeof eventOutbox>;
export type NewAuditLogEntry = InferInsertModel<typeof auditLog>;
export type NewProcessedEvent = InferInsertModel<typeof processedEvents>;

// ============================================================================
// STATUS TYPES
// ============================================================================

export type StatusType = 'active' | 'inactive' | 'suspended';
export type OutboxStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ActionType = 'create' | 'update' | 'delete' | 'suspend' | 'activate' | 'custom';
export type PolicyStatus = 'draft' | 'active' | 'suspended' | 'revoked';
