-- Existing pre-migration FeedbackWell database only; back up and review first.
BEGIN;

CREATE TABLE IF NOT EXISTS "public"."rate_limit_buckets" ("key" character varying NOT NULL, "count" integer NOT NULL DEFAULT '1', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_9eb2f8a2ae370667b4ca83dd313" PRIMARY KEY ("key"));

CREATE TABLE IF NOT EXISTS "public"."storage_deletions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" character varying NOT NULL, "storagePath" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0f4ad92143fb36dadad7c5b8717" PRIMARY KEY ("id"));

CREATE TABLE IF NOT EXISTS "public"."notifications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" character varying NOT NULL, "requestId" character varying NOT NULL, "dedupeKey" character varying NOT NULL, "recipient" character varying NOT NULL, "senderName" character varying NOT NULL, "subject" character varying NOT NULL, "body" text NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4e652c0d7bd0781daccfea1e117" UNIQUE ("dedupeKey"), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"));

CREATE INDEX IF NOT EXISTS "IDX_92f5d3a7779be163cbea7916c6" ON "public"."notifications"  ("status") ;

CREATE TABLE IF NOT EXISTS "public"."request_templates" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" character varying NOT NULL, "name" character varying NOT NULL, "requirements" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_91b178479b6d636b12157c60f33" PRIMARY KEY ("id"));

ALTER TABLE portal_otps ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

UPDATE portal_otps SET used = true WHERE length(code) <> 64;

ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS "sentAt" timestamptz;

ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS "portalExpiresAt" timestamptz;

ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS "reminderScheduleHours" jsonb NOT NULL DEFAULT '[24,72,168]'::jsonb;

COMMIT;
