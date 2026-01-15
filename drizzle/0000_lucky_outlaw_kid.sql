CREATE TYPE "public"."status-type" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "users" (
	"_id" varchar PRIMARY KEY NOT NULL,
	"name" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now()
);
