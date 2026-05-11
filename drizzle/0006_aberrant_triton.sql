CREATE TYPE "public"."angel_tax_ineligible_reason" AS ENUM('founder', 'entity', 'foreign', 'holding_period', 'other');--> statement-breakpoint
CREATE TYPE "public"."angel_tax_status" AS ENUM('pending', 'eligible', 'filed', 'expired', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."investor_activity_priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."investor_activity_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."investor_activity_type" AS ENUM('meeting', 'document', 'discussion', 'follow_up', 'call', 'email', 'note', 'other');--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE 'broadcast_notification';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'platform_broadcast';--> statement-breakpoint
CREATE TABLE "angel_tax_deductions" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"investorId" integer,
	"investorName" varchar(255) NOT NULL,
	"roundName" varchar(128),
	"investmentDate" date NOT NULL,
	"investmentAmountNtd" numeric(20, 2) NOT NULL,
	"sharesAcquired" integer NOT NULL,
	"pricePerShareNtd" numeric(20, 6),
	"isEligible" boolean DEFAULT false NOT NULL,
	"ineligibleReason" "angel_tax_ineligible_reason",
	"lockupYears" integer DEFAULT 2,
	"lockupEndDate" date,
	"taxFilingYear" integer,
	"deductionRate" numeric(4, 2) DEFAULT '0.50',
	"maxDeductionNtd" numeric(20, 2),
	"status" "angel_tax_status" DEFAULT 'pending' NOT NULL,
	"filingDate" date,
	"filingReference" varchar(100),
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comps_peers" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"groupName" varchar(255) DEFAULT 'Default' NOT NULL,
	"name" varchar(255) NOT NULL,
	"ticker" varchar(20),
	"revenue" numeric(20, 2) DEFAULT '0' NOT NULL,
	"ebitda" numeric(20, 2) DEFAULT '0' NOT NULL,
	"netIncome" numeric(20, 2) DEFAULT '0' NOT NULL,
	"marketCap" numeric(20, 2) DEFAULT '0' NOT NULL,
	"netDebt" numeric(20, 2) DEFAULT '0' NOT NULL,
	"sharesOutstanding" numeric(20, 0),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"investorId" integer NOT NULL,
	"userId" integer NOT NULL,
	"type" "investor_activity_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"dueDate" timestamp,
	"status" "investor_activity_status" DEFAULT 'pending' NOT NULL,
	"priority" "investor_activity_priority" DEFAULT 'medium' NOT NULL,
	"completedAt" timestamp,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectionId" integer NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"assumptions" jsonb NOT NULL,
	"isBaseline" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
