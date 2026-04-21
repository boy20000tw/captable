CREATE TYPE "public"."signing_template_scope" AS ENUM('platform', 'company');--> statement-breakpoint
CREATE TABLE "signing_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"scope" "signing_template_scope" DEFAULT 'company' NOT NULL,
	"docType" "signing_doc_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"docusealTemplateId" integer,
	"fileUrl" text,
	"fileName" text,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
