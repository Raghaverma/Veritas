-- Migration: Add Policies Table
-- Adds the policies table to support Policy aggregate

-- Create policy_status enum
CREATE TYPE "public"."policy_status" AS ENUM('draft', 'active', 'suspended', 'revoked');

-- Create policies table
CREATE TABLE "policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "name" varchar(200) NOT NULL,
  "description" text,
  "rules" jsonb NOT NULL,
  "status" "policy_status" DEFAULT 'draft' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "activated_at" timestamp with time zone,
  "suspended_at" timestamp with time zone,
  "suspension_reason" text,
  "revoked_at" timestamp with time zone,
  "revocation_reason" text,
  "revoked_by" varchar(100)
);

-- Create indexes for policies table
CREATE INDEX "policies_user_id_idx" ON "policies" ("user_id");
CREATE INDEX "policies_status_idx" ON "policies" ("status");
CREATE INDEX "policies_created_at_idx" ON "policies" ("created_at");
