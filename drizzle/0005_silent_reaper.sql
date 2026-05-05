CREATE TYPE "public"."admin_audit_action" AS ENUM('view_company', 'update_plan', 'update_permissions', 'view_audit_log', 'suspend_company', 'reactivate_company', 'update_admin_role', 'add_admin', 'remove_admin', 'transfer_super_admin', 'rotate_company_dek', 'rotate_platform_dek', 'delete_company');--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'admin');--> statement-breakpoint
CREATE TYPE "public"."company_plan" AS ENUM('starter', 'standard', 'plus', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."disposition_type" AS ENUM('transfer', 'resignation', 'ipo', 'other');--> statement-breakpoint
CREATE TYPE "public"."dividend_priority" AS ENUM('cumulative', 'non_cumulative', 'participating', 'none');--> statement-breakpoint
CREATE TYPE "public"."election_83b_status" AS ENUM('pending', 'filed', 'confirmed', 'missed');--> statement-breakpoint
CREATE TYPE "public"."esop_grant_v1_type" AS ENUM('option', 'rsu');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'both');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('funding_round', 'document_signing', 'vesting_milestone', 'valuation_409a', 'election_83b', 'share_transfer', 'general');--> statement-breakpoint
CREATE TYPE "public"."par_value_type" AS ENUM('par', 'no_par');--> statement-breakpoint
CREATE TYPE "public"."share_transfer_status" AS ENUM('pending', 'rofr_notice', 'approved', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."support_faq_category" AS ENUM('account', 'subscription', 'equity', 'technical', 'general');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_type" AS ENUM('feedback', 'bug', 'billing', 'feature_request', 'general');--> statement-breakpoint
CREATE TYPE "public"."tech_share_tax_status" AS ENUM('deferred', 'taxable', 'filed', 'exempt');--> statement-breakpoint
CREATE TYPE "public"."tech_share_type" AS ENUM('tech_share', 'rsa');--> statement-breakpoint
CREATE TYPE "public"."template_category" AS ENUM('shareholder_agreement', 'investment_agreement', 'employee_contract', 'board_resolution', 'equity_certificate', 'esop_grant', 'nda', 'other');--> statement-breakpoint
CREATE TYPE "public"."transfer_restriction" AS ENUM('none', 'board_approval', 'shareholder_approval', 'custom');--> statement-breakpoint
CREATE TYPE "public"."valuation_409a_status" AS ENUM('active', 'expired', 'superseded');--> statement-breakpoint
ALTER TYPE "public"."esop_grant_v1_status" ADD VALUE 'settled';--> statement-breakpoint
ALTER TYPE "public"."register_event_type" ADD VALUE 'rsu_settlement';--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_user_id" integer NOT NULL,
	"admin_user_name" varchar(255),
	"admin_user_email" varchar(320),
	"action" "admin_audit_action" NOT NULL,
	"target_company_id" integer,
	"target_company_name" varchar(255),
	"details" text,
	"ip_address" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closed_company_provisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"is_closed_company" boolean DEFAULT false NOT NULL,
	"par_value_type" "par_value_type" DEFAULT 'par' NOT NULL,
	"transfer_restriction" "transfer_restriction" DEFAULT 'none' NOT NULL,
	"transfer_description" text,
	"articles_url" varchar(500),
	"effective_date" date,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closed_company_share_rights" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"share_class_id" integer,
	"share_class_name" varchar(128) NOT NULL,
	"votes_per_share" numeric(6, 2) DEFAULT '1.00' NOT NULL,
	"has_veto_right" boolean DEFAULT false NOT NULL,
	"veto_matters" text,
	"guaranteed_board_seats" integer DEFAULT 0 NOT NULL,
	"board_observer_rights" boolean DEFAULT false NOT NULL,
	"dividend_priority" "dividend_priority" DEFAULT 'none' NOT NULL,
	"dividend_rate" numeric(6, 4),
	"liquidation_priority" integer DEFAULT 1 NOT NULL,
	"liquidation_multiple" numeric(6, 2) DEFAULT '1.00',
	"is_convertible" boolean DEFAULT false NOT NULL,
	"conversion_ratio" numeric(10, 4),
	"conversion_trigger" text,
	"custom_provisions" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"encrypted_dek" text NOT NULL,
	"dek_version" integer DEFAULT 1 NOT NULL,
	"algorithm" varchar(32) DEFAULT 'aes-256-gcm' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"rotated_at" timestamp,
	CONSTRAINT "company_keys_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "elections_83b" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"grantId" integer,
	"recipientName" varchar(255) NOT NULL,
	"recipientEmail" varchar(320),
	"grantDate" date NOT NULL,
	"filingDeadline" date NOT NULL,
	"sharesSubject" integer NOT NULL,
	"fmvPerShare" numeric(18, 6),
	"amountPaid" numeric(18, 4),
	"currency" varchar(8) DEFAULT 'USD',
	"propertyDescription" text,
	"status" "election_83b_status" DEFAULT 'pending' NOT NULL,
	"filedDate" date,
	"irsConfirmationDate" date,
	"employerCopyDate" date,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"userId" integer,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"channel" "notification_channel" DEFAULT 'both' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp,
	"link_url" varchar(500),
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"seller_investor_id" integer NOT NULL,
	"buyer_investor_id" integer,
	"buyer_name" varchar(255),
	"buyer_email" varchar(320),
	"share_class" varchar(64) NOT NULL,
	"shares" integer NOT NULL,
	"price_per_share" numeric(18, 6),
	"total_price" numeric(20, 4),
	"currency" varchar(8) DEFAULT 'USD',
	"transfer_date" date NOT NULL,
	"status" "share_transfer_status" DEFAULT 'pending' NOT NULL,
	"has_rofr" boolean DEFAULT false NOT NULL,
	"rofr_deadline" date,
	"rofr_waived_at" timestamp,
	"board_approval_date" date,
	"register_entry_id" integer,
	"shares_enc" text,
	"price_per_share_enc" text,
	"total_price_enc" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" "support_faq_category" DEFAULT 'general' NOT NULL,
	"question_en" text NOT NULL,
	"question_zh" text NOT NULL,
	"answer_en" text NOT NULL,
	"answer_zh" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"user_id" integer NOT NULL,
	"user_name" varchar(256),
	"user_email" varchar(256),
	"type" "support_ticket_type" DEFAULT 'general' NOT NULL,
	"priority" "support_ticket_priority" DEFAULT 'medium' NOT NULL,
	"subject" varchar(512) NOT NULL,
	"message" text NOT NULL,
	"status" "support_ticket_status" DEFAULT 'open' NOT NULL,
	"admin_notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_share_tax_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"grantId" integer,
	"holder_name" varchar(255) NOT NULL,
	"share_type" "tech_share_type" NOT NULL,
	"acquisition_date" date NOT NULL,
	"shares_acquired" integer NOT NULL,
	"acquisition_fmv" numeric(18, 6),
	"paid_amount" numeric(18, 6),
	"is_deferral_eligible" boolean DEFAULT false NOT NULL,
	"deferral_start_date" date,
	"deferral_expiry_date" date,
	"holding_period_met" boolean DEFAULT false NOT NULL,
	"vesting_date" date,
	"vesting_fmv" numeric(18, 6),
	"disposition_date" date,
	"disposition_fmv" numeric(18, 6),
	"disposition_type" "disposition_type",
	"taxable_income" numeric(20, 4),
	"estimated_tax" numeric(20, 4),
	"tax_status" "tech_share_tax_status" DEFAULT 'deferred' NOT NULL,
	"filing_deadline" date,
	"filing_date" date,
	"filing_reference" varchar(100),
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD COLUMN "skipTermSheet" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "allocations" ADD COLUMN "amount_enc" text;--> statement-breakpoint
ALTER TABLE "allocations" ADD COLUMN "shares_allocated_enc" text;--> statement-breakpoint
ALTER TABLE "allocations" ADD COLUMN "price_per_share_enc" text;--> statement-breakpoint
ALTER TABLE "allocations" ADD COLUMN "fx_to_ntd_enc" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "contact_email_enc" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "contact_email_bi" varchar(64);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "representative_name_enc" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "docuseal_tenant_api_key_enc" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "docuseal_webhook_secret_enc" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "plan" "company_plan" DEFAULT 'starter' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "plan_note" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "is_suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "esop_grants_v1" ADD COLUMN "grantType" "esop_grant_v1_type" DEFAULT 'option' NOT NULL;--> statement-breakpoint
ALTER TABLE "esop_grants_v1" ADD COLUMN "sharesSettled" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "esop_grants_v1" ADD COLUMN "fairMarketValue" numeric(20, 6);--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "investment_amount_ntd_enc" text;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "investment_amount_usd_enc" text;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "price_per_share_ntd_enc" text;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "shares_issued_enc" text;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "valuation_cap_ntd_enc" text;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "valuation_cap_usd_enc" text;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "discount_rate_enc" text;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "interest_rate_enc" text;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "accrued_interest_ntd_enc" text;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "conversion_price_ntd_enc" text;--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "conversion_shares_enc" text;--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN "name_enc" text;--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN "email_enc" text;--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN "email_bi" varchar(64);--> statement-breakpoint
ALTER TABLE "investors" ADD COLUMN "phone_enc" text;--> statement-breakpoint
ALTER TABLE "share_register_entries" ADD COLUMN "shares_enc" text;--> statement-breakpoint
ALTER TABLE "share_register_entries" ADD COLUMN "price_per_share_enc" text;--> statement-breakpoint
ALTER TABLE "share_register_entries" ADD COLUMN "fx_to_ntd_enc" text;--> statement-breakpoint
ALTER TABLE "share_register_entries" ADD COLUMN "total_amount_enc" text;--> statement-breakpoint
ALTER TABLE "shareholders" ADD COLUMN "name_enc" text;--> statement-breakpoint
ALTER TABLE "shareholders" ADD COLUMN "email_enc" text;--> statement-breakpoint
ALTER TABLE "shareholders" ADD COLUMN "email_bi" varchar(64);--> statement-breakpoint
ALTER TABLE "shareholders" ADD COLUMN "phone_enc" text;--> statement-breakpoint
ALTER TABLE "signing_templates" ADD COLUMN "category" "template_category" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "signing_templates" ADD COLUMN "minPlan" "company_plan" DEFAULT 'starter' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_bi" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "adminRole" "admin_role" DEFAULT 'admin';--> statement-breakpoint
ALTER TABLE "valuations_409a" ADD COLUMN "expiryDate" date;--> statement-breakpoint
ALTER TABLE "valuations_409a" ADD COLUMN "status" "valuation_409a_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "valuations_409a" ADD COLUMN "fmvPerShare" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "valuations_409a" ADD COLUMN "currency" varchar(8) DEFAULT 'USD';