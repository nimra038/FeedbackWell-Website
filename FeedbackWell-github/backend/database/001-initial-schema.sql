-- Empty database only. Generated from current entities; review before applying.
BEGIN;

CREATE TABLE "public"."organizations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "legal_name" character varying, "industry" character varying, "type" character varying, "logo" character varying, "brand_color" character varying, "website" character varying, "timezone" character varying NOT NULL DEFAULT 'America/New_York', "country" character varying NOT NULL DEFAULT 'US', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"));

CREATE TYPE "public"."customers_customertype_enum" AS ENUM('individual', 'business', 'joint', 'guarantor', 'co_borrower', 'other');

CREATE TYPE "public"."customers_status_enum" AS ENUM('active', 'inactive', 'archived');

CREATE TABLE "public"."customers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" uuid NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "email" character varying, "phone" character varying, "companyName" character varying, "customerType" "public"."customers_customertype_enum" NOT NULL DEFAULT 'individual', "externalReference" character varying, "status" "public"."customers_status_enum" NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"));

CREATE TYPE "public"."users_role_enum" AS ENUM('owner', 'admin', 'manager', 'loan_officer', 'processor', 'underwriter', 'reviewer', 'read_only');

CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'invited', 'suspended');

CREATE TABLE "public"."users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" uuid NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'loan_officer', "status" "public"."users_status_enum" NOT NULL DEFAULT 'invited', "phone" character varying, "mfaEnabled" boolean NOT NULL DEFAULT false, "mfaSecret" character varying, "lastLoginAt" TIMESTAMP, "invitedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"));

CREATE TYPE "public"."applications_status_enum" AS ENUM('draft', 'requested', 'collecting', 'documents_in_review', 'missing_documents', 'ready_for_review', 'approved', 'declined', 'closed');

CREATE TABLE "public"."applications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" uuid NOT NULL, "customerId" uuid NOT NULL, "assignedUserId" uuid, "applicationNumber" character varying NOT NULL, "applicationType" character varying, "status" "public"."applications_status_enum" NOT NULL DEFAULT 'draft', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_cbe9cb2d37267b0fb1bcf49b705" UNIQUE ("applicationNumber"), CONSTRAINT "PK_938c0a27255637bde919591888f" PRIMARY KEY ("id"));

CREATE TABLE "public"."audit_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" uuid NOT NULL, "actorId" character varying, "actorType" character varying NOT NULL, "action" character varying NOT NULL, "resourceType" character varying NOT NULL, "resourceId" character varying NOT NULL, "ipAddress" character varying, "userAgent" character varying, "metadata" jsonb, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_910f64d901a5c3e9878f0d4a407" PRIMARY KEY ("id"));

CREATE TABLE "public"."rate_limit_buckets" ("key" character varying NOT NULL, "count" integer NOT NULL DEFAULT '1', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_9eb2f8a2ae370667b4ca83dd313" PRIMARY KEY ("key"));

CREATE TYPE "public"."document_requests_status_enum" AS ENUM('draft', 'sent', 'opened', 'in_progress', 'waiting_on_customer', 'under_review', 'completed', 'expired', 'cancelled');

CREATE TABLE "public"."document_requests" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" uuid NOT NULL, "customerId" uuid NOT NULL, "applicationId" uuid, "createdBy" uuid NOT NULL, "title" character varying NOT NULL, "description" character varying, "status" "public"."document_requests_status_enum" NOT NULL DEFAULT 'draft', "dueDate" TIMESTAMP, "portalToken" character varying NOT NULL, "sentAt" TIMESTAMP WITH TIME ZONE, "portalExpiresAt" TIMESTAMP WITH TIME ZONE, "reminderScheduleHours" jsonb NOT NULL DEFAULT '[24,72,168]'::jsonb, "completedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_3482d6a74e2c328ee7c6191bb82" UNIQUE ("portalToken"), CONSTRAINT "PK_43076ee267e48f196b68ce008e6" PRIMARY KEY ("id"));

CREATE TYPE "public"."document_requirements_status_enum" AS ENUM('missing', 'uploaded', 'under_review', 'accepted', 'rejected', 'needs_replacement', 'not_applicable');

CREATE TABLE "public"."document_requirements" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "requestId" uuid NOT NULL, "name" character varying NOT NULL, "description" character varying, "category" character varying, "required" boolean NOT NULL DEFAULT true, "status" "public"."document_requirements_status_enum" NOT NULL DEFAULT 'missing', "dueDate" TIMESTAMP, "acceptedFileTypes" text, "maxFileSizeMb" integer, "minFiles" integer NOT NULL DEFAULT '1', "maxFiles" integer, "instructions" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_21b28e7d53255a15274f676f4c1" PRIMARY KEY ("id"));

CREATE TABLE "public"."documents" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" uuid NOT NULL, "customerId" uuid NOT NULL, "requirementId" uuid NOT NULL, "originalName" character varying NOT NULL, "mimeType" character varying NOT NULL, "fileSize" integer NOT NULL, "fileHash" character varying NOT NULL, "storagePath" character varying NOT NULL, "malwareScanPassed" boolean NOT NULL DEFAULT false, "malwareScannedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY ("id"));

CREATE TABLE "public"."document_versions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "documentId" uuid NOT NULL, "version" integer NOT NULL, "storagePath" character varying NOT NULL, "fileHash" character varying NOT NULL, "fileSize" integer NOT NULL, "uploadedBy" character varying NOT NULL, "reviewedBy" character varying, "reviewedAt" TIMESTAMP, "status" character varying, "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_baf26dab035c6d6fc433f9dc6a2" PRIMARY KEY ("id"));

CREATE TABLE "public"."storage_deletions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" character varying NOT NULL, "storagePath" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0f4ad92143fb36dadad7c5b8717" PRIMARY KEY ("id"));

CREATE TYPE "public"."messages_sendertype_enum" AS ENUM('user', 'customer', 'system');

CREATE TABLE "public"."messages" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" uuid NOT NULL, "requestId" uuid NOT NULL, "senderId" character varying NOT NULL, "senderType" "public"."messages_sendertype_enum" NOT NULL, "body" text NOT NULL, "isInternal" boolean NOT NULL DEFAULT false, "readByCustomer" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"));

CREATE TABLE "public"."notifications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" character varying NOT NULL, "requestId" character varying NOT NULL, "dedupeKey" character varying NOT NULL, "recipient" character varying NOT NULL, "senderName" character varying NOT NULL, "subject" character varying NOT NULL, "body" text NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4e652c0d7bd0781daccfea1e117" UNIQUE ("dedupeKey"), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"));

CREATE INDEX "IDX_92f5d3a7779be163cbea7916c6" ON "public"."notifications"  ("status") ;

CREATE TABLE "public"."portal_otps" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying NOT NULL, "portalToken" character varying NOT NULL, "code" character varying NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "used" boolean NOT NULL DEFAULT false, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5f9c175cce9b55b9cc0225c0b96" PRIMARY KEY ("id"));

CREATE TABLE "public"."portal_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "customerId" character varying NOT NULL, "portalToken" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_379dfbd23aa9d6e2503df20cb3d" PRIMARY KEY ("id"));

CREATE TABLE "public"."request_templates" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "organizationId" character varying NOT NULL, "name" character varying NOT NULL, "requirements" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_91b178479b6d636b12157c60f33" PRIMARY KEY ("id"));

ALTER TABLE "public"."customers" ADD CONSTRAINT "FK_fac3145c49520eae6248715b26b" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."users" ADD CONSTRAINT "FK_f3d6aea8fcca58182b2e80ce979" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."applications" ADD CONSTRAINT "FK_630548134611c66a73c8b82bc1c" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."applications" ADD CONSTRAINT "FK_f58104aafcaf8f0fbff56631bab" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."applications" ADD CONSTRAINT "FK_405ef1022018ccb55c1ae030d4f" FOREIGN KEY ("assignedUserId") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."audit_events" ADD CONSTRAINT "FK_5f2c9619322e5354049f139a3d3" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."document_requests" ADD CONSTRAINT "FK_c5045fd967d0f1a5be0b32e9bbd" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."document_requests" ADD CONSTRAINT "FK_6a7d1fa9bd0d4590a1db5efb66f" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."document_requests" ADD CONSTRAINT "FK_ae86d67085e9edb1da66115d47d" FOREIGN KEY ("applicationId") REFERENCES "public"."applications"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."document_requests" ADD CONSTRAINT "FK_7f08981065db141c59a636137ad" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."document_requirements" ADD CONSTRAINT "FK_17e62623c9722a0c18e75b48112" FOREIGN KEY ("requestId") REFERENCES "public"."document_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."documents" ADD CONSTRAINT "FK_f16eaa571c8fc0ee214cad0f1c3" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."documents" ADD CONSTRAINT "FK_1cbf180163aa949282edd424a92" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."documents" ADD CONSTRAINT "FK_f0193b4f697971f16f602b62423" FOREIGN KEY ("requirementId") REFERENCES "public"."document_requirements"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."document_versions" ADD CONSTRAINT "FK_4ea14bf55da75a8c3997e745a28" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."messages" ADD CONSTRAINT "FK_a72fd6b3053902f578926ed1911" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."messages" ADD CONSTRAINT "FK_1a9a8327f718c21f827d6b12f42" FOREIGN KEY ("requestId") REFERENCES "public"."document_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT;
