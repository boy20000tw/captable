CREATE TYPE "public"."anti_dilution_default" AS ENUM('none', 'full_ratchet', 'broad_based_wa', 'narrow_based_wa');--> statement-breakpoint
CREATE TYPE "public"."dividend_type" AS ENUM('none', 'non_cumulative', 'cumulative');--> statement-breakpoint
CREATE TYPE "public"."share_class_type" AS ENUM('common', 'preferred');--> statement-breakpoint
CREATE TABLE "share_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"classType" "share_class_type" DEFAULT 'common' NOT NULL,
	"authorizedShares" bigint,
	"parValue" numeric(20, 6),
	"pricePerShare" numeric(20, 6),
	"currency" varchar(8) DEFAULT 'USD',
	"liquidationMultiple" numeric(6, 2) DEFAULT '1.00',
	"participationType" "liquidation_preference_type" DEFAULT 'non_participating',
	"participationCap" numeric(6, 2),
	"seniorityRank" integer DEFAULT 1,
	"antiDilutionType" "anti_dilution_default" DEFAULT 'none',
	"isConvertible" boolean DEFAULT true,
	"conversionRatio" numeric(10, 4) DEFAULT '1.0000',
	"dividendType" "dividend_type" DEFAULT 'none',
	"dividendRate" numeric(6, 4),
	"votingMultiplier" numeric(6, 2) DEFAULT '1.00',
	"boardSeats" integer DEFAULT 0,
	"protectiveProvisions" text,
	"fundingRoundId" integer,
	"notes" text,
	"sortOrder" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD COLUMN "shareClassId" integer;--> statement-breakpoint
ALTER TABLE "share_register_entries" ADD COLUMN "shareClassId" integer;