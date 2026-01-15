-- Migration: Event-Driven Architecture Schema
-- This migration updates the schema to support the event-driven architecture

-- Drop old enum type if it exists
DROP TYPE IF EXISTS "public"."status-type" CASCADE;

-- Create new enum types
CREATE TYPE "public"."status_type" AS ENUM('active', 'inactive', 'suspended');
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'completed', 'failed');
CREATE TYPE "public"."action_type" AS ENUM('create', 'update', 'delete', 'suspend', 'activate', 'custom');

-- Drop and recreate users table with new schema
DROP TABLE IF EXISTS "users" CASCADE;

CREATE TABLE "users" (
  "id" varchar PRIMARY KEY NOT NULL,
  "email" varchar NOT NULL,
  "name" varchar,
  "status" "status_type" DEFAULT 'active' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "users_email_idx" ON "users" USING btree (lower("email"));
CREATE INDEX "users_status_idx" ON "users" ("status");
CREATE INDEX "users_created_at_idx" ON "users" ("created_at");

-- Create actions table
CREATE TABLE "actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "type" "action_type" NOT NULL,
  "name" varchar NOT NULL,
  "description" text,
  "status" "status_type" DEFAULT 'active' NOT NULL,
  "metadata" jsonb,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE INDEX "actions_user_id_idx" ON "actions" ("user_id");
CREATE INDEX "actions_type_idx" ON "actions" ("type");
CREATE INDEX "actions_status_idx" ON "actions" ("status");
CREATE INDEX "actions_created_at_idx" ON "actions" ("created_at");

-- Create domain_events table (append-only)
CREATE TABLE "domain_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "aggregate_type" varchar(100) NOT NULL,
  "aggregate_id" varchar(100) NOT NULL,
  "event_type" varchar(100) NOT NULL,
  "event_version" integer DEFAULT 1 NOT NULL,
  "payload" jsonb NOT NULL,
  "metadata" jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "domain_events_aggregate_idx" ON "domain_events" ("aggregate_type", "aggregate_id");
CREATE INDEX "domain_events_event_type_idx" ON "domain_events" ("event_type");
CREATE INDEX "domain_events_occurred_at_idx" ON "domain_events" ("occurred_at");
CREATE INDEX "domain_events_correlation_idx" ON "domain_events" USING btree ((metadata->>'correlationId'));

-- Create event_outbox table (transactional outbox pattern)
CREATE TABLE "event_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "domain_events"("id"),
  "event_type" varchar(100) NOT NULL,
  "aggregate_type" varchar(100) NOT NULL,
  "aggregate_id" varchar(100) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "outbox_status" DEFAULT 'pending' NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "max_retries" integer DEFAULT 5 NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "next_retry_at" timestamp with time zone
);

CREATE INDEX "event_outbox_status_idx" ON "event_outbox" ("status");
CREATE INDEX "event_outbox_created_at_idx" ON "event_outbox" ("created_at");
CREATE INDEX "event_outbox_next_retry_idx" ON "event_outbox" ("next_retry_at");
CREATE INDEX "event_outbox_event_type_idx" ON "event_outbox" ("event_type");

-- Create audit_log table (immutable)
CREATE TABLE "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "correlation_id" varchar(100) NOT NULL,
  "entity_type" varchar(100) NOT NULL,
  "entity_id" varchar(100) NOT NULL,
  "action" varchar(50) NOT NULL,
  "actor_id" varchar(100) NOT NULL,
  "actor_email" varchar(255) NOT NULL,
  "actor_ip" varchar(45),
  "actor_user_agent" text,
  "before_snapshot" jsonb,
  "after_snapshot" jsonb,
  "changes" jsonb,
  "metadata" jsonb,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "audit_log_entity_idx" ON "audit_log" ("entity_type", "entity_id");
CREATE INDEX "audit_log_actor_idx" ON "audit_log" ("actor_id");
CREATE INDEX "audit_log_correlation_idx" ON "audit_log" ("correlation_id");
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log" ("occurred_at");
CREATE INDEX "audit_log_action_idx" ON "audit_log" ("action");

-- Create processed_events table (idempotency)
CREATE TABLE "processed_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "handler_name" varchar(100) NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "processed_events_event_handler_idx" ON "processed_events" ("event_id", "handler_name");
