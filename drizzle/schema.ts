import {
    pgTable,
    serial,
    integer,
    varchar,
    text,
    timestamp,
    decimal,
    bigint,
    boolean,
    date,
    pgEnum,
} from "drizzle-orm/pg-core";

// ─── Enum Definitions ────────────────────────────────────────────────────────────

// Users enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const userAppRoleEnum = pgEnum("user_app_role", ["owner", "admin", "cfo", "lawyer", "investor", "viewer"]);

// User invitations enums
export const invitationAppRoleEnum = pgEnum("invitation_app_role", ["admin", "cfo", "lawyer", "investor", "viewer"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "revoked", "expired"]);

// Audit logs enums
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete", "import", "export", "login", "invite"]);

// Shareholders enums
export const shareholderTypeEnum = pgEnum("shareholder_type", ["founder", "angel", "seed", "seed_plus", "pre_a", "bridge", "series_a", "pre_b", "series_b", "pre_c", "series_c", "esop", "other"]);

// Funding rounds enums
export const fundingRoundStatusEnum = pgEnum("funding_round_status", ["completed", "projected", "bridge"]);

// Share transactions enums
export const shareTransactionTypeEnum = pgEnum("share_transaction_type", ["issuance", "transfer_in", "transfer_out", "esop_grant", "esop_exercise", "esop_cancel"]);
export const shareClassEnum = pgEnum("share_class", ["common", "seed", "seed_plus", "pre_a", "bridge", "series_a", "pre_b", "series_b", "pre_c", "series_c", "esop"]);

// ESOP grants enums
export const esopGrantStatusEnum = pgEnum("esop_grant_status", ["active", "fully_vested", "cancelled", "exercised"]);

// Valuation projections enums
export const valuationScenarioEnum = pgEnum("valuation_scenario", ["base", "optimistic", "conservative"]);

// Import logs enums
export const importLogStatusEnum = pgEnum("import_log_status", ["pending", "processing", "completed", "failed"]);

// Anti-dilution provisions enums
export const antiDilutionProvisionTypeEnum = pgEnum("anti_dilution_provision_type", ["full_ratchet", "broad_based_wa", "narrow_based_wa", "none"]);
export const antiDilutionStatusEnum = pgEnum("anti_dilution_status", ["active", "triggered", "waived", "expired"]);

// Shareholder documents enums
export const shareholderDocumentTypeEnum = pgEnum("shareholder_document_type", ["sha", "subscription", "nda", "board_consent", "side_letter", "warrant", "other"]);
export const shareholderDocumentStatusEnum = pgEnum("shareholder_document_status", ["pending", "signed", "expired", "waived"]);

// 409A valuations enums
export const valuation409aMethodEnum = pgEnum("valuation_409a_method", ["dcf", "market_comparable", "asset_based", "409a_safe_harbor", "other"]);

// Liquidation preferences enums
export const liquidationPreferenceTypeEnum = pgEnum("liquidation_preference_type", ["non_participating", "participating", "capped_participating"]);

// Company member role enum
export const companyMemberRoleEnum = pgEnum("company_member_role", ["owner", "admin", "cfo", "lawyer", "investor", "viewer"]);

// ─── Companies ──────────────────────────────────────────────────────────────
export const companies = pgTable("companies", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ─── Company Members (many-to-many: users ↔ companies) ──────────────────────
export const companyMembers = pgTable("company_members", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    userId: integer("userId").notNull(),
    role: companyMemberRoleEnum("role").default("viewer").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CompanyMember = typeof companyMembers.$inferSelect;
export type InsertCompanyMember = typeof companyMembers.$inferInsert;

// ─── Users (auth) ────────────────────────────────────────────────────────────
export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: userRoleEnum("role").default("user").notNull(),
    appRole: userAppRoleEnum("appRole").default("viewer").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
// ─── User Invitations ─────────────────────────────────────────────────────────
export const userInvitations = pgTable("user_invitations", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    token: varchar("token", { length: 128 }).notNull().unique(),
    email: varchar("email", { length: 320 }),
    appRole: invitationAppRoleEnum("appRole").default("viewer").notNull(),
    invitedByUserId: integer("invitedByUserId").notNull(),
    status: invitationStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    acceptedAt: timestamp("acceptedAt"),
    acceptedByUserId: integer("acceptedByUserId"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = typeof userInvitations.$inferInsert;
// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    userId: integer("userId"),
    userName: varchar("userName", { length: 255 }),
    action: auditActionEnum("action").notNull(),
    resourceType: varchar("resourceType", { length: 64 }),
    resourceId: integer("resourceId"),
    resourceName: varchar("resourceName", { length: 255 }),
    changesBefore: text("changesBefore"),
    changesAfter: text("changesAfter"),
    ipAddress: varchar("ipAddress", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── Shareholders ─────────────────────────────────────────────────────────────
export const shareholders = pgTable("shareholders", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    name: varchar("name", { length: 255 }).notNull(),
    aka: varchar("aka", { length: 255 }),
    type: shareholderTypeEnum("type").default("other").notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 64 }),
    nationality: varchar("nationality", { length: 100 }),
    isEntity: boolean("isEntity").default(false).notNull(),
    notes: text("notes"),
    lockupPeriod: text("lockupPeriod"),
    taxBenefits: text("taxBenefits"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Shareholder = typeof shareholders.$inferSelect;
export type InsertShareholder = typeof shareholders.$inferInsert;

// ─── Funding Rounds ───────────────────────────────────────────────────────────
export const fundingRounds = pgTable("funding_rounds", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    name: varchar("name", { length: 100 }).notNull(),
    roundDate: date("roundDate"),
    pricePerShareNtd: decimal("pricePerShareNtd", { precision: 20, scale: 6 }),
    moneyRaisedNtd: decimal("moneyRaisedNtd", { precision: 20, scale: 2 }),
    preMoneyValuationNtd: decimal("preMoneyValuationNtd", { precision: 20, scale: 2 }),
    postMoneyValuationNtd: decimal("postMoneyValuationNtd", { precision: 20, scale: 2 }),
    exchangeRate: decimal("exchangeRate", { precision: 10, scale: 7 }),
    status: fundingRoundStatusEnum("status").default("completed").notNull(),
    notes: text("notes"),
    sortOrder: integer("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type FundingRound = typeof fundingRounds.$inferSelect;
export type InsertFundingRound = typeof fundingRounds.$inferInsert;

// ─── Share Holdings (snapshot per round) ─────────────────────────────────────
export const shareHoldings = pgTable("share_holdings", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    shareholderId: integer("shareholderId").notNull(),
    fundingRoundId: integer("fundingRoundId").notNull(),
    commonShares: bigint("commonShares", { mode: "number" }).default(0).notNull(),
    seedShares: bigint("seedShares", { mode: "number" }).default(0).notNull(),
    seedPlusShares: bigint("seedPlusShares", { mode: "number" }).default(0).notNull(),
    preAShares: bigint("preAShares", { mode: "number" }).default(0).notNull(),
    bridgeShares: bigint("bridgeShares", { mode: "number" }).default(0).notNull(),
    seriesAShares: bigint("seriesAShares", { mode: "number" }).default(0).notNull(),
    esopShares: bigint("esopShares", { mode: "number" }).default(0).notNull(),
    totalShares: bigint("totalShares", { mode: "number" }).default(0).notNull(),
    ownershipPct: decimal("ownershipPct", { precision: 20, scale: 10 }),
    paidInCapitalNtd: decimal("paidInCapitalNtd", { precision: 20, scale: 2 }),
    investmentDate: date("investmentDate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ShareHolding = typeof shareHoldings.$inferSelect;
export type InsertShareHolding = typeof shareHoldings.$inferInsert;

// ─── Share Transactions (individual issuance/transfer events) ─────────────────
export const shareTransactions = pgTable("share_transactions", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    shareholderId: integer("shareholderId").notNull(),
    fundingRoundId: integer("fundingRoundId"),
    transactionDate: timestamp("transactionDate").defaultNow(),
    transactionType: shareTransactionTypeEnum("transactionType").notNull(),
    shareClass: shareClassEnum("shareClass").notNull(),
    sharesAmount: bigint("sharesAmount", { mode: "number" }).notNull(),
    pricePerShareNtd: decimal("pricePerShareNtd", { precision: 20, scale: 6 }),
    totalAmountNtd: decimal("totalAmountNtd", { precision: 20, scale: 2 }),
    taxQualified: boolean("taxQualified").default(false),
    taxCapNtd: decimal("taxCapNtd", { precision: 20, scale: 2 }),
    lockUpEndDate: date("lockUpEndDate"),
    taxDeductionYear: integer("taxDeductionYear"),
    taxDeductionAmountNtd: decimal("taxDeductionAmountNtd", { precision: 20, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShareTransaction = typeof shareTransactions.$inferSelect;
export type InsertShareTransaction = typeof shareTransactions.$inferInsert;

// ─── ESOP Pool ────────────────────────────────────────────────────────────────
export const esopPool = pgTable("esop_pool", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    fundingRoundId: integer("fundingRoundId"),
    poolName: varchar("poolName", { length: 100 }).default("ESOP Pool").notNull(),
    totalShares: bigint("totalShares", { mode: "number" }).notNull(),
    allocatedShares: bigint("allocatedShares", { mode: "number" }).default(0).notNull(),
    vestedShares: bigint("vestedShares", { mode: "number" }).default(0).notNull(),
    exercisedShares: bigint("exercisedShares", { mode: "number" }).default(0).notNull(),
    cancelledShares: bigint("cancelledShares", { mode: "number" }).default(0).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type EsopPool = typeof esopPool.$inferSelect;
export type InsertEsopPool = typeof esopPool.$inferInsert;

// ─── ESOP Grants ──────────────────────────────────────────────────────────────
export const esopGrants = pgTable("esop_grants", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    esopPoolId: integer("esopPoolId").notNull(),
    shareholderId: integer("shareholderId"),
    granteeName: varchar("granteeName", { length: 255 }),
    grantDate: date("grantDate"),
    sharesGranted: bigint("sharesGranted", { mode: "number" }).notNull(),
    sharesVested: bigint("sharesVested", { mode: "number" }).default(0).notNull(),
    sharesExercised: bigint("sharesExercised", { mode: "number" }).default(0).notNull(),
    sharesCancelled: bigint("sharesCancelled", { mode: "number" }).default(0).notNull(),
    exercisePriceNtd: decimal("exercisePriceNtd", { precision: 20, scale: 6 }),
    vestingStartDate: date("vestingStartDate"),
    vestingCliffMonths: integer("vestingCliffMonths").default(12),
    vestingTotalMonths: integer("vestingTotalMonths").default(48),
    status: esopGrantStatusEnum("status").default("active").notNull(),
    expiryDate: date("expiryDate"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EsopGrant = typeof esopGrants.$inferSelect;
export type InsertEsopGrant = typeof esopGrants.$inferInsert;

// ─── Valuation Projections ────────────────────────────────────────────────────
export const valuationProjections = pgTable("valuation_projections", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    name: varchar("name", { length: 100 }).notNull(),
    projectionDate: date("projectionDate"),
    pricePerShareNtd: decimal("pricePerShareNtd", { precision: 20, scale: 6 }),
    targetRaiseNtd: decimal("targetRaiseNtd", { precision: 20, scale: 2 }),
    preMoneyValuationNtd: decimal("preMoneyValuationNtd", { precision: 20, scale: 2 }),
    postMoneyValuationNtd: decimal("postMoneyValuationNtd", { precision: 20, scale: 2 }),
    newSharesIssued: bigint("newSharesIssued", { mode: "number" }),
    exchangeRate: decimal("exchangeRate", { precision: 10, scale: 7 }),
    scenario: valuationScenarioEnum("scenario").default("base").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ValuationProjection = typeof valuationProjections.$inferSelect;
export type InsertValuationProjection = typeof valuationProjections.$inferInsert;

// ─── Import Logs ──────────────────────────────────────────────────────────────
export const importLogs = pgTable("import_logs", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    fileUrl: text("fileUrl"),
    status: importLogStatusEnum("status").default("pending").notNull(),
    recordsImported: integer("recordsImported").default(0),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImportLog = typeof importLogs.$inferSelect;
export type InsertImportLog = typeof importLogs.$inferInsert;

// ─── Cap Table Snapshots ──────────────────────────────────────────────────────
export const capTableSnapshots = pgTable("cap_table_snapshots", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    snapshotDate: timestamp("snapshotDate").notNull(),
    triggerEvent: varchar("triggerEvent", { length: 100 }),
    fundingRoundId: integer("fundingRoundId"),
    totalShares: bigint("totalShares", { mode: "number" }).default(0).notNull(),
    totalShareholders: integer("totalShareholders").default(0).notNull(),
    esopPoolTotal: bigint("esopPoolTotal", { mode: "number" }).default(0).notNull(),
    esopAllocated: bigint("esopAllocated", { mode: "number" }).default(0).notNull(),
    postMoneyValuationNtd: decimal("postMoneyValuationNtd", { precision: 20, scale: 2 }),
    snapshotData: text("snapshotData"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CapTableSnapshot = typeof capTableSnapshots.$inferSelect;
export type InsertCapTableSnapshot = typeof capTableSnapshots.$inferInsert;

// ─── Anti-Dilution Provisions ─────────────────────────────────────────────────
export const antiDilutionProvisions = pgTable("anti_dilution_provisions", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    shareholderId: integer("shareholderId").notNull(),
    fundingRoundId: integer("fundingRoundId").notNull(),
    provisionType: antiDilutionProvisionTypeEnum("provisionType").default("broad_based_wa").notNull(),
    originalPriceNtd: decimal("originalPriceNtd", { precision: 20, scale: 6 }).notNull(),
    adjustedPriceNtd: decimal("adjustedPriceNtd", { precision: 20, scale: 6 }),
    originalShares: bigint("originalShares", { mode: "number" }).notNull(),
    adjustedShares: bigint("adjustedShares", { mode: "number" }),
    triggerRoundId: integer("triggerRoundId"),
    status: antiDilutionStatusEnum("status").default("active").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AntiDilutionProvision = typeof antiDilutionProvisions.$inferSelect;
export type InsertAntiDilutionProvision = typeof antiDilutionProvisions.$inferInsert;

// ─── Shareholder Documents ─────────────────────────────────────────────────────
export const shareholderDocuments = pgTable("shareholder_documents", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    shareholderId: integer("shareholderId").notNull(),
    documentType: shareholderDocumentTypeEnum("documentType").notNull(),
    documentName: varchar("documentName", { length: 255 }).notNull(),
    status: shareholderDocumentStatusEnum("status").default("pending").notNull(),
    signedDate: date("signedDate"),
    expiryDate: date("expiryDate"),
    fundingRoundId: integer("fundingRoundId"),
    fileUrl: text("fileUrl"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShareholderDocument = typeof shareholderDocuments.$inferSelect;
export type InsertShareholderDocument = typeof shareholderDocuments.$inferInsert;

// ─── 409A Valuations ──────────────────────────────────────────────────────────
export const valuations409a = pgTable("valuations_409a", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    valuationDate: date("valuationDate").notNull(),
    fmvPerShareNtd: decimal("fmvPerShareNtd", { precision: 18, scale: 4 }),
    fmvPerShareUsd: decimal("fmvPerShareUsd", { precision: 18, scale: 6 }),
    commonStockValueNtd: decimal("commonStockValueNtd", { precision: 20, scale: 2 }),
    preferredStockValueNtd: decimal("preferredStockValueNtd", { precision: 20, scale: 2 }),
    totalCompanyValueNtd: decimal("totalCompanyValueNtd", { precision: 20, scale: 2 }),
    valuationFirm: varchar("valuationFirm", { length: 255 }),
    reportUrl: text("reportUrl"),
    method: valuation409aMethodEnum("method").default("dcf"),
    relatedRoundId: integer("relatedRoundId"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Valuation409a = typeof valuations409a.$inferSelect;
export type InsertValuation409a = typeof valuations409a.$inferInsert;

// ─── Liquidation Preferences ──────────────────────────────────────────────────
export const liquidationPreferences = pgTable("liquidation_preferences", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    fundingRoundId: integer("fundingRoundId").notNull().unique(),
    preferenceType: liquidationPreferenceTypeEnum("preferenceType").default("non_participating").notNull(),
    liquidationMultiple: decimal("liquidationMultiple", { precision: 6, scale: 2 }).default("1.00").notNull(),
    participationCap: decimal("participationCap", { precision: 6, scale: 2 }),
    seniorityRank: integer("seniorityRank").default(1).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LiquidationPreference = typeof liquidationPreferences.$inferSelect;
export type InsertLiquidationPreference = typeof liquidationPreferences.$inferInsert;

// ─── 5-Year Financial Projections ────────────────────────────────────────────
import { jsonb } from "drizzle-orm/pg-core";

export const financialProjections = pgTable("financial_projections", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    name: varchar("name", { length: 255 }).notNull(),
    startYear: integer("startYear").notNull(),
    years: integer("years").notNull().default(5),
    assumptions: jsonb("assumptions").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FinancialProjection = typeof financialProjections.$inferSelect;
export type InsertFinancialProjection = typeof financialProjections.$inferInsert;

// ─── DCF Scenarios ──────────────────────────────────────────────────────────
export const dcfScenarios = pgTable("dcf_scenarios", {
    id: serial("id").primaryKey(),
    projectionId: integer("projectionId").notNull(),
    companyId: integer("companyId"),
    name: varchar("name", { length: 255 }).notNull(),
    discountRate: decimal("discountRate", { precision: 8, scale: 4 }).notNull(),
    terminalGrowth: decimal("terminalGrowth", { precision: 8, scale: 4 }).notNull(),
    netDebt: decimal("netDebt", { precision: 20, scale: 2 }).notNull().default("0"),
    cash: decimal("cash", { precision: 20, scale: 2 }).notNull().default("0"),
    targetRaise: decimal("targetRaise", { precision: 20, scale: 2 }),
    targetPreMoney: decimal("targetPreMoney", { precision: 20, scale: 2 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DcfScenario = typeof dcfScenarios.$inferSelect;
export type InsertDcfScenario = typeof dcfScenarios.$inferInsert;
