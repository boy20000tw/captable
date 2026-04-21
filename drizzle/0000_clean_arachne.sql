CREATE TYPE "public"."allocation_status" AS ENUM('planned', 'committed', 'signed', 'funded', 'issued');--> statement-breakpoint
CREATE TYPE "public"."anti_dilution_provision_type" AS ENUM('full_ratchet', 'broad_based_wa', 'narrow_based_wa', 'none');--> statement-breakpoint
CREATE TYPE "public"."anti_dilution_status" AS ENUM('active', 'triggered', 'waived', 'expired');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'import', 'export', 'login', 'invite');--> statement-breakpoint
CREATE TYPE "public"."company_member_role" AS ENUM('owner', 'admin', 'cfo', 'lawyer', 'investor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."esop_grant_status" AS ENUM('active', 'fully_vested', 'cancelled', 'exercised');--> statement-breakpoint
CREATE TYPE "public"."esop_grant_v1_status" AS ENUM('active', 'fully_vested', 'exercised', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."funding_round_status" AS ENUM('completed', 'projected', 'bridge');--> statement-breakpoint
CREATE TYPE "public"."import_log_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."instrument_safe_type" AS ENUM('pre_money', 'post_money', 'mfn');--> statement-breakpoint
CREATE TYPE "public"."instrument_status" AS ENUM('active', 'converted', 'cancelled', 'matured');--> statement-breakpoint
CREATE TYPE "public"."instrument_type" AS ENUM('safe', 'convertible_note');--> statement-breakpoint
CREATE TYPE "public"."investor_entity_kind" AS ENUM('individual', 'entity');--> statement-breakpoint
CREATE TYPE "public"."investor_status" AS ENUM('prospect', 'meeting', 'term_sheet', 'invested', 'passed');--> statement-breakpoint
CREATE TYPE "public"."invitation_app_role" AS ENUM('admin', 'cfo', 'lawyer', 'investor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."liquidation_preference_type" AS ENUM('non_participating', 'participating', 'capped_participating');--> statement-breakpoint
CREATE TYPE "public"."register_event_type" AS ENUM('issuance', 'transfer_in', 'transfer_out', 'cancellation', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."share_class" AS ENUM('common', 'seed', 'seed_plus', 'pre_a', 'bridge', 'series_a', 'pre_b', 'series_b', 'pre_c', 'series_c', 'esop');--> statement-breakpoint
CREATE TYPE "public"."share_transaction_type" AS ENUM('issuance', 'transfer_in', 'transfer_out', 'esop_grant', 'esop_exercise', 'esop_cancel');--> statement-breakpoint
CREATE TYPE "public"."shareholder_document_status" AS ENUM('pending', 'signed', 'expired', 'waived');--> statement-breakpoint
CREATE TYPE "public"."shareholder_document_type" AS ENUM('sha', 'subscription', 'nda', 'board_consent', 'side_letter', 'warrant', 'other');--> statement-breakpoint
CREATE TYPE "public"."shareholder_type" AS ENUM('founder', 'angel', 'seed', 'seed_plus', 'pre_a', 'bridge', 'series_a', 'pre_b', 'series_b', 'pre_c', 'series_c', 'esop', 'other');--> statement-breakpoint
CREATE TYPE "public"."snapshot_trigger" AS ENUM('register_write', 'manual');--> statement-breakpoint
CREATE TYPE "public"."user_app_role" AS ENUM('owner', 'admin', 'cfo', 'lawyer', 'investor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."valuation_409a_method" AS ENUM('dcf', 'market_comparable', 'asset_based', '409a_safe_harbor', 'other');--> statement-breakpoint
CREATE TYPE "public"."valuation_scenario" AS ENUM('base', 'optimistic', 'conservative');--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"fundingRoundId" integer NOT NULL,
	"investorId" integer NOT NULL,
	"shareClass" "share_class" NOT NULL,
	"amount" numeric(20, 2),
	"currency" varchar(8) DEFAULT 'NTD' NOT NULL,
	"fxToNtd" numeric(18, 8) DEFAULT '1' NOT NULL,
	"sharesAllocated" bigint,
	"pricePerShare" numeric(20, 6),
	"status" "allocation_status" DEFAULT 'planned' NOT NULL,
	"plannedAt" timestamp DEFAULT now(),
	"committedAt" timestamp,
	"signedAt" timestamp,
	"fundedAt" timestamp,
	"issuedAt" timestamp,
	"termSheetUrl" text,
	"agreementUrl" text,
	"notes" text,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anti_dilution_provisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"shareholderId" integer NOT NULL,
	"fundingRoundId" integer NOT NULL,
	"provisionType" "anti_dilution_provision_type" DEFAULT 'broad_based_wa' NOT NULL,
	"originalPriceNtd" numeric(20, 6) NOT NULL,
	"adjustedPriceNtd" numeric(20, 6),
	"originalShares" bigint NOT NULL,
	"adjustedShares" bigint,
	"triggerRoundId" integer,
	"status" "anti_dilution_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"userId" integer,
	"userName" varchar(255),
	"action" "audit_action" NOT NULL,
	"resourceType" varchar(64),
	"resourceId" integer,
	"resourceName" varchar(255),
	"changesBefore" text,
	"changesAfter" text,
	"ipAddress" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cap_table_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"name" varchar(255) NOT NULL,
	"description" text,
	"snapshotDate" timestamp NOT NULL,
	"triggerEvent" varchar(100),
	"fundingRoundId" integer,
	"totalShares" bigint DEFAULT 0 NOT NULL,
	"totalShareholders" integer DEFAULT 0 NOT NULL,
	"esopPoolTotal" bigint DEFAULT 0 NOT NULL,
	"esopAllocated" bigint DEFAULT 0 NOT NULL,
	"postMoneyValuationNtd" numeric(20, 2),
	"snapshotData" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100),
	"name_en" text,
	"tax_id" text,
	"address" text,
	"phone" text,
	"contact_email" text,
	"website" text,
	"logo_url" text,
	"representative_name" text,
	"representative_title" text,
	"signature_url" text,
	"docuseal_tenant_api_key" text,
	"docuseal_webhook_secret" text,
	"default_currency" varchar(8) DEFAULT 'NTD',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"userId" integer NOT NULL,
	"role" "company_member_role" DEFAULT 'viewer' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dcf_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectionId" integer NOT NULL,
	"companyId" integer,
	"name" varchar(255) NOT NULL,
	"discountRate" numeric(8, 4) NOT NULL,
	"terminalGrowth" numeric(8, 4) NOT NULL,
	"netDebt" numeric(20, 2) DEFAULT '0' NOT NULL,
	"cash" numeric(20, 2) DEFAULT '0' NOT NULL,
	"targetRaise" numeric(20, 2),
	"targetPreMoney" numeric(20, 2),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esop_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"esopPoolId" integer NOT NULL,
	"shareholderId" integer,
	"granteeName" varchar(255),
	"grantDate" date,
	"sharesGranted" bigint NOT NULL,
	"sharesVested" bigint DEFAULT 0 NOT NULL,
	"sharesExercised" bigint DEFAULT 0 NOT NULL,
	"sharesCancelled" bigint DEFAULT 0 NOT NULL,
	"exercisePriceNtd" numeric(20, 6),
	"vestingStartDate" date,
	"vestingCliffMonths" integer DEFAULT 12,
	"vestingTotalMonths" integer DEFAULT 48,
	"status" "esop_grant_status" DEFAULT 'active' NOT NULL,
	"expiryDate" date,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esop_grants_v1" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"poolId" integer NOT NULL,
	"investorId" integer NOT NULL,
	"grantDate" date NOT NULL,
	"sharesGranted" bigint NOT NULL,
	"sharesVested" bigint DEFAULT 0 NOT NULL,
	"sharesExercised" bigint DEFAULT 0 NOT NULL,
	"sharesCancelled" bigint DEFAULT 0 NOT NULL,
	"exercisePrice" numeric(20, 6),
	"currency" varchar(8) DEFAULT 'NTD',
	"vestingStartDate" date,
	"vestingCliffMonths" integer DEFAULT 12,
	"vestingTotalMonths" integer DEFAULT 48,
	"status" "esop_grant_v1_status" DEFAULT 'active' NOT NULL,
	"expiryDate" date,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esop_pool" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"fundingRoundId" integer,
	"poolName" varchar(100) DEFAULT 'ESOP Pool' NOT NULL,
	"totalShares" bigint NOT NULL,
	"allocatedShares" bigint DEFAULT 0 NOT NULL,
	"vestedShares" bigint DEFAULT 0 NOT NULL,
	"exercisedShares" bigint DEFAULT 0 NOT NULL,
	"cancelledShares" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esop_pools_v1" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"fundingRoundId" integer,
	"totalShares" bigint NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_projections" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"name" varchar(255) NOT NULL,
	"startYear" integer NOT NULL,
	"years" integer DEFAULT 5 NOT NULL,
	"assumptions" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"name" varchar(100) NOT NULL,
	"roundDate" date,
	"pricePerShareNtd" numeric(20, 6),
	"moneyRaisedNtd" numeric(20, 2),
	"preMoneyValuationNtd" numeric(20, 2),
	"postMoneyValuationNtd" numeric(20, 2),
	"exchangeRate" numeric(10, 7),
	"status" "funding_round_status" DEFAULT 'completed' NOT NULL,
	"notes" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"fileName" varchar(255) NOT NULL,
	"fileUrl" text,
	"status" "import_log_status" DEFAULT 'pending' NOT NULL,
	"recordsImported" integer DEFAULT 0,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "instrument_type" NOT NULL,
	"status" "instrument_status" DEFAULT 'active' NOT NULL,
	"investorId" integer NOT NULL,
	"fundingRoundId" integer,
	"investmentAmountNtd" numeric(20, 2) NOT NULL,
	"investmentAmountUsd" numeric(20, 2),
	"pricePerShareNtd" numeric(20, 6),
	"sharesIssued" bigint,
	"valuationCapNtd" numeric(20, 2),
	"valuationCapUsd" numeric(20, 2),
	"discountRate" numeric(5, 4),
	"safeType" "instrument_safe_type",
	"interestRate" numeric(5, 4),
	"maturityDate" date,
	"accruedInterestNtd" numeric(20, 2),
	"conversionRoundId" integer,
	"conversionDate" date,
	"conversionPriceNtd" numeric(20, 6),
	"conversionShares" bigint,
	"notes" text,
	"boardApprovalDate" date,
	"documentUrl" text,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investors" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"entityKind" "investor_entity_kind" DEFAULT 'individual' NOT NULL,
	"email" varchar(320),
	"phone" varchar(64),
	"nationality" varchar(100),
	"status" "investor_status" DEFAULT 'prospect' NOT NULL,
	"aka" varchar(255),
	"website" text,
	"linkedinUrl" text,
	"firstContactAt" timestamp,
	"lastContactAt" timestamp,
	"ownerUserId" integer,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquidation_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"fundingRoundId" integer NOT NULL,
	"preferenceType" "liquidation_preference_type" DEFAULT 'non_participating' NOT NULL,
	"liquidationMultiple" numeric(6, 2) DEFAULT '1.00' NOT NULL,
	"participationCap" numeric(6, 2),
	"seniorityRank" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "liquidation_preferences_fundingRoundId_unique" UNIQUE("fundingRoundId")
);
--> statement-breakpoint
CREATE TABLE "share_holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"shareholderId" integer NOT NULL,
	"fundingRoundId" integer NOT NULL,
	"commonShares" bigint DEFAULT 0 NOT NULL,
	"seedShares" bigint DEFAULT 0 NOT NULL,
	"seedPlusShares" bigint DEFAULT 0 NOT NULL,
	"preAShares" bigint DEFAULT 0 NOT NULL,
	"bridgeShares" bigint DEFAULT 0 NOT NULL,
	"seriesAShares" bigint DEFAULT 0 NOT NULL,
	"esopShares" bigint DEFAULT 0 NOT NULL,
	"totalShares" bigint DEFAULT 0 NOT NULL,
	"ownershipPct" numeric(20, 10),
	"paidInCapitalNtd" numeric(20, 2),
	"investmentDate" date,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_register_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"allocationId" integer,
	"fundingRoundId" integer,
	"investorId" integer NOT NULL,
	"eventType" "register_event_type" NOT NULL,
	"shareClass" "share_class" NOT NULL,
	"shares" bigint NOT NULL,
	"pricePerShare" numeric(20, 6),
	"currency" varchar(8) DEFAULT 'NTD',
	"fxToNtd" numeric(18, 8) DEFAULT '1',
	"totalAmount" numeric(20, 2),
	"effectiveDate" date NOT NULL,
	"reversedEntryId" integer,
	"notes" text,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"shareholderId" integer NOT NULL,
	"fundingRoundId" integer,
	"transactionDate" timestamp DEFAULT now(),
	"transactionType" "share_transaction_type" NOT NULL,
	"shareClass" "share_class" NOT NULL,
	"sharesAmount" bigint NOT NULL,
	"pricePerShareNtd" numeric(20, 6),
	"totalAmountNtd" numeric(20, 2),
	"taxQualified" boolean DEFAULT false,
	"taxCapNtd" numeric(20, 2),
	"lockUpEndDate" date,
	"taxDeductionYear" integer,
	"taxDeductionAmountNtd" numeric(20, 2),
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shareholder_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"shareholderId" integer NOT NULL,
	"documentType" "shareholder_document_type" NOT NULL,
	"documentName" varchar(255) NOT NULL,
	"status" "shareholder_document_status" DEFAULT 'pending' NOT NULL,
	"signedDate" date,
	"expiryDate" date,
	"fundingRoundId" integer,
	"fileUrl" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shareholders" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"name" varchar(255) NOT NULL,
	"aka" varchar(255),
	"type" "shareholder_type" DEFAULT 'other' NOT NULL,
	"email" varchar(320),
	"phone" varchar(64),
	"nationality" varchar(100),
	"isEntity" boolean DEFAULT false NOT NULL,
	"notes" text,
	"lockupPeriod" text,
	"taxBenefits" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"triggerType" "snapshot_trigger" DEFAULT 'register_write' NOT NULL,
	"registerEntryId" integer,
	"capTableData" jsonb NOT NULL,
	"totalShares" bigint DEFAULT 0 NOT NULL,
	"totalInvestors" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"token" varchar(128) NOT NULL,
	"email" varchar(320),
	"appRole" "invitation_app_role" DEFAULT 'viewer' NOT NULL,
	"invitedByUserId" integer NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"acceptedAt" timestamp,
	"acceptedByUserId" integer,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"appRole" "user_app_role" DEFAULT 'viewer' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "valuation_projections" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"name" varchar(100) NOT NULL,
	"projectionDate" date,
	"pricePerShareNtd" numeric(20, 6),
	"targetRaiseNtd" numeric(20, 2),
	"preMoneyValuationNtd" numeric(20, 2),
	"postMoneyValuationNtd" numeric(20, 2),
	"newSharesIssued" bigint,
	"exchangeRate" numeric(10, 7),
	"scenario" "valuation_scenario" DEFAULT 'base' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "valuations_409a" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"valuationDate" date NOT NULL,
	"fmvPerShareNtd" numeric(18, 4),
	"fmvPerShareUsd" numeric(18, 6),
	"commonStockValueNtd" numeric(20, 2),
	"preferredStockValueNtd" numeric(20, 2),
	"totalCompanyValueNtd" numeric(20, 2),
	"valuationFirm" varchar(255),
	"reportUrl" text,
	"method" "valuation_409a_method" DEFAULT 'dcf',
	"relatedRoundId" integer,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
