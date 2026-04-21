CREATE TYPE "public"."signing_doc_type" AS ENUM('share_certificate', 'safe_agreement', 'convertible_note', 'stock_option_grant', 'board_resolution', 'sha', 'custom');--> statement-breakpoint
CREATE TYPE "public"."signing_status" AS ENUM('draft', 'pending', 'viewed', 'completed', 'declined', 'expired');--> statement-breakpoint
CREATE TABLE "signing_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"docType" "signing_doc_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"linkedResourceType" text,
	"linkedResourceId" integer,
	"docusealTemplateId" integer,
	"docusealSubmissionId" integer,
	"status" "signing_status" DEFAULT 'draft' NOT NULL,
	"signers" text,
	"sourceDocumentUrl" text,
	"signedDocumentUrl" text,
	"sentAt" timestamp,
	"completedAt" timestamp,
	"expiresAt" timestamp,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
