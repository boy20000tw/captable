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
export const adminRoleEnum = pgEnum("admin_role", ["super_admin", "admin"]);

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
export const shareClassEnum = pgEnum("share_class", ["common", "preferred", "seed", "seed_plus", "pre_a", "bridge", "series_a", "pre_b", "series_b", "pre_c", "series_c", "esop"]);

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

// Share class enums
export const shareClassTypeEnum = pgEnum("share_class_type", ["common", "preferred"]);
export const dividendTypeEnum = pgEnum("dividend_type", ["none", "non_cumulative", "cumulative"]);
export const antiDilutionDefaultEnum = pgEnum("anti_dilution_default", ["none", "full_ratchet", "broad_based_wa", "narrow_based_wa"]);

// Company member role enum
export const companyMemberRoleEnum = pgEnum("company_member_role", ["owner", "admin", "cfo", "lawyer", "investor", "viewer"]);

// Company subscription plan enum
export const companyPlanEnum = pgEnum("company_plan", ["starter", "standard", "plus", "enterprise"]);

// Admin audit action enum (platform-level admin operations)
export const adminAuditActionEnum = pgEnum("admin_audit_action", [
    "view_company", "update_plan", "update_permissions",
    "view_audit_log", "suspend_company", "reactivate_company",
    "update_admin_role", "add_admin", "remove_admin", "transfer_super_admin",
]);

// ─── Companies ──────────────────────────────────────────────────────────────
// The `name` / `slug` were added by the multi-company work. Everything from
// `nameEn` onwards was added by SPEC-company-settings.md and populates the
// Company Settings page (also used by DocuSeal eSignature integration later).
export const companies = pgTable("companies", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).unique(),

    // Basic info (SPEC-company-settings §一)
    nameEn: text("name_en"),
    taxId: text("tax_id"),

    // Contact
    address: text("address"),
    phone: text("phone"),
    contactEmail: text("contact_email"),
    website: text("website"),
    // Encrypted PII (Phase 2)
    contactEmailEnc: text("contact_email_enc"),
    contactEmailBi: varchar("contact_email_bi", { length: 64 }),
    representativeNameEnc: text("representative_name_enc"),

    // Branding
    logoUrl: text("logo_url"),

    // Representative / authorized signatory
    representativeName: text("representative_name"),
    representativeTitle: text("representative_title"),

    // eSignature (Phase 2 preview — columns reserved now)
    signatureUrl: text("signature_url"),
    docusealTenantApiKey: text("docuseal_tenant_api_key"),
    docusealWebhookSecret: text("docuseal_webhook_secret"),

    // Preferences
    defaultCurrency: varchar("default_currency", { length: 8 }).default("NTD"),

    // Subscription
    plan: companyPlanEnum("plan").default("starter").notNull(),
    planNote: text("plan_note"),           // admin memo, e.g. "Enterprise — 3-year contract"
    isSuspended: boolean("is_suspended").default(false).notNull(),

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
    // Encrypted PII (Phase 2) — dual-write: plaintext kept until migration complete
    nameEnc: text("name_enc"),                       // AES-256-GCM encrypted name
    emailEnc: text("email_enc"),                     // AES-256-GCM encrypted email
    emailBi: varchar("email_bi", { length: 64 }),    // HMAC-SHA256 blind index for email lookup
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: userRoleEnum("role").default("user").notNull(),
    adminRole: adminRoleEnum("adminRole").default("admin"),
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

// ─── Admin Audit Logs (platform-level operations by admin users) ──────────────
export const adminAuditLogs = pgTable("admin_audit_logs", {
    id: serial("id").primaryKey(),
    adminUserId: integer("admin_user_id").notNull(),
    adminUserName: varchar("admin_user_name", { length: 255 }),
    adminUserEmail: varchar("admin_user_email", { length: 320 }),
    action: adminAuditActionEnum("action").notNull(),
    targetCompanyId: integer("target_company_id"),
    targetCompanyName: varchar("target_company_name", { length: 255 }),
    details: text("details"),               // JSON string with before/after or context
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLogs.$inferInsert;

// ─── Shareholders ─────────────────────────────────────────────────────────────
export const shareholders = pgTable("shareholders", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    name: varchar("name", { length: 255 }).notNull(),
    aka: varchar("aka", { length: 255 }),
    type: shareholderTypeEnum("type").default("other").notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 64 }),
    // Encrypted PII (Phase 2)
    nameEnc: text("name_enc"),
    emailEnc: text("email_enc"),
    emailBi: varchar("email_bi", { length: 64 }),
    phoneEnc: text("phone_enc"),
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
export const valuation409aStatusEnum = pgEnum("valuation_409a_status", ["active", "expired", "superseded"]);

export const valuations409a = pgTable("valuations_409a", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),
    valuationDate: date("valuationDate").notNull(),
    expiryDate: date("expiryDate"),                // typically 12 months after valuationDate
    status: valuation409aStatusEnum("status").default("active").notNull(),
    fmvPerShare: decimal("fmvPerShare", { precision: 18, scale: 6 }),
    currency: varchar("currency", { length: 8 }).default("USD"),
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

// ─── 83(b) Elections ──────────────────────────────────────────────────────────
export const election83bStatusEnum = pgEnum("election_83b_status", ["pending", "filed", "confirmed", "missed"]);

export const elections83b = pgTable("elections_83b", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    grantId: integer("grantId"),                    // links to esop_grants_v1
    recipientName: varchar("recipientName", { length: 255 }).notNull(),
    recipientEmail: varchar("recipientEmail", { length: 320 }),
    grantDate: date("grantDate").notNull(),
    filingDeadline: date("filingDeadline").notNull(), // grantDate + 30 days
    sharesSubject: integer("sharesSubject").notNull(),
    fmvPerShare: decimal("fmvPerShare", { precision: 18, scale: 6 }),
    amountPaid: decimal("amountPaid", { precision: 18, scale: 4 }),
    currency: varchar("currency", { length: 8 }).default("USD"),
    propertyDescription: text("propertyDescription"), // "shares of Common Stock of [Company]"
    status: election83bStatusEnum("status").default("pending").notNull(),
    filedDate: date("filedDate"),
    irsConfirmationDate: date("irsConfirmationDate"),
    employerCopyDate: date("employerCopyDate"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Election83b = typeof elections83b.$inferSelect;
export type InsertElection83b = typeof elections83b.$inferInsert;

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

// ─── Share Classes ──────────────────────────────────────────────────────────
// Defines the terms & rights of each equity class. Each company can have
// multiple classes (e.g. Common, Series Seed Preferred, Series A Preferred).
// The `slug` field matches legacy shareClassEnum values for backward compat.
export const shareClasses = pgTable("share_classes", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    // Identity
    name: varchar("name", { length: 128 }).notNull(),             // "Series A Preferred"
    slug: varchar("slug", { length: 64 }).notNull(),              // "series_a" — matches shareClassEnum
    classType: shareClassTypeEnum("classType").default("common").notNull(),  // common or preferred
    // Authorized shares
    authorizedShares: bigint("authorizedShares", { mode: "number" }),
    parValue: decimal("parValue", { precision: 20, scale: 6 }),
    pricePerShare: decimal("pricePerShare", { precision: 20, scale: 6 }),
    currency: varchar("currency", { length: 8 }).default("USD"),
    // Liquidation terms (for preferred)
    liquidationMultiple: decimal("liquidationMultiple", { precision: 6, scale: 2 }).default("1.00"),
    participationType: liquidationPreferenceTypeEnum("participationType").default("non_participating"),
    participationCap: decimal("participationCap", { precision: 6, scale: 2 }),
    seniorityRank: integer("seniorityRank").default(1),
    // Anti-dilution
    antiDilutionType: antiDilutionDefaultEnum("antiDilutionType").default("none"),
    // Conversion
    isConvertible: boolean("isConvertible").default(true),
    conversionRatio: decimal("conversionRatio", { precision: 10, scale: 4 }).default("1.0000"),
    // Dividends
    dividendType: dividendTypeEnum("dividendType").default("none"),
    dividendRate: decimal("dividendRate", { precision: 6, scale: 4 }),   // e.g. 0.08 = 8%
    // Voting
    votingMultiplier: decimal("votingMultiplier", { precision: 6, scale: 2 }).default("1.00"),  // votes per share
    // Protective provisions & board
    boardSeats: integer("boardSeats").default(0),
    protectiveProvisions: text("protectiveProvisions"),  // JSON or markdown
    // Linkage
    fundingRoundId: integer("fundingRoundId"),   // optionally tie to a round
    notes: text("notes"),
    sortOrder: integer("sortOrder").default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ShareClass = typeof shareClasses.$inferSelect;
export type InsertShareClass = typeof shareClasses.$inferInsert;

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

// ════════════════════════════════════════════════════════════════════════════
// MVP V1 DATA LAYER (per SPEC-mvp-split.md Phase 1)
// ────────────────────────────────────────────────────────────────────────────
// Design principles:
//   1. Cap Table is a pure derived view — never edited directly
//   2. Allocation is the only fundraising operation entry point
//   3. Share register is append-only; corrections via reversing entries
//   4. Investor is a superset (pipeline + invested + passed)
//
// Coexists with legacy tables (shareholders, share_holdings, share_transactions,
// cap_table_snapshots). Migration happens in Phase 3.
// ════════════════════════════════════════════════════════════════════════════

// ─── Enums for V1 ───────────────────────────────────────────────────────────
export const investorEntityKindEnum = pgEnum("investor_entity_kind", ["individual", "entity"]);
export const investorStatusEnum = pgEnum("investor_status", [
    "prospect",
    "meeting",
    "term_sheet",
    "invested",
    "passed",
]);
export const allocationStatusEnum = pgEnum("allocation_status", [
    "planned",
    "committed",
    "signed",
    "funded",
    "issued",
]);
export const registerEventTypeEnum = pgEnum("register_event_type", [
    "issuance",        // new shares issued to an investor
    "transfer_in",     // shares transferred to an investor from another
    "transfer_out",    // shares transferred away from an investor
    "cancellation",    // shares retired / cancelled
    "reversal",        // corrects a prior entry (points via reversedEntryId)
    "esop_exercise",   // ESOP grant exercised → Common Stock issued
]);
export const snapshotTriggerEnum = pgEnum("snapshot_trigger", [
    "register_write",
    "manual",
]);

// ─── Investors (superset: pipeline + invested + passed) ─────────────────────
// Replaces `shareholders` for V1+ work. Legacy `shareholders` kept until
// Phase 3 migration.
export const investors = pgTable("investors", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    entityKind: investorEntityKindEnum("entityKind").default("individual").notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 64 }),
    // ── Encrypted PII (Phase 2 dual-write) ──
    nameEnc: text("name_enc"),
    emailEnc: text("email_enc"),
    emailBi: varchar("email_bi", { length: 64 }),
    phoneEnc: text("phone_enc"),
    nationality: varchar("nationality", { length: 100 }),
    status: investorStatusEnum("status").default("prospect").notNull(),
    // Investor profile / meta
    aka: varchar("aka", { length: 255 }),
    website: text("website"),
    linkedinUrl: text("linkedinUrl"),
    // Pipeline bookkeeping
    firstContactAt: timestamp("firstContactAt"),
    lastContactAt: timestamp("lastContactAt"),
    ownerUserId: integer("ownerUserId"),              // which team member owns this relationship
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Investor = typeof investors.$inferSelect;
export type InsertInvestor = typeof investors.$inferInsert;

// ─── Allocations (lifecycle-tracked fundraising operations) ─────────────────
// The ONLY fundraising operation entry point. Must pass through statuses
// planned → committed → signed → funded → issued; Issued triggers register write.
export const allocations = pgTable("allocations", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    fundingRoundId: integer("fundingRoundId").notNull(),
    investorId: integer("investorId").notNull(),
    shareClass: shareClassEnum("shareClass").notNull(),
    shareClassId: integer("shareClassId"),   // FK to share_classes (nullable for legacy rows)

    // Money (multi-currency ready)
    amount: decimal("amount", { precision: 20, scale: 2 }),             // in `currency`
    currency: varchar("currency", { length: 8 }).default("NTD").notNull(),
    fxToNtd: decimal("fxToNtd", { precision: 18, scale: 8 }).default("1").notNull(),
    // Share terms
    sharesAllocated: bigint("sharesAllocated", { mode: "number" }),
    pricePerShare: decimal("pricePerShare", { precision: 20, scale: 6 }), // in `currency`

    // Lifecycle state machine
    status: allocationStatusEnum("status").default("planned").notNull(),
    plannedAt: timestamp("plannedAt").defaultNow(),
    committedAt: timestamp("committedAt"),
    signedAt: timestamp("signedAt"),
    fundedAt: timestamp("fundedAt"),
    issuedAt: timestamp("issuedAt"),

    // Documents
    termSheetUrl: text("termSheetUrl"),
    agreementUrl: text("agreementUrl"),

    // ── Encrypted financial fields (Phase 3 dual-write) ──
    amountEnc: text("amount_enc"),
    sharesAllocatedEnc: text("shares_allocated_enc"),
    pricePerShareEnc: text("price_per_share_enc"),
    fxToNtdEnc: text("fx_to_ntd_enc"),

    notes: text("notes"),
    createdByUserId: integer("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Allocation = typeof allocations.$inferSelect;
export type InsertAllocation = typeof allocations.$inferInsert;

// ─── Share Register Entries (append-only fact ledger) ───────────────────────
// Immutable. Corrections are done by inserting a reversal entry that points
// to the original via reversedEntryId, then inserting the corrected entry.
// Cap Table is computed as: sum of all entries per investor per share class.
export const shareRegisterEntries = pgTable("share_register_entries", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    // Origin — nullable for founder/manual entries
    allocationId: integer("allocationId"),
    fundingRoundId: integer("fundingRoundId"),
    // Who + what
    investorId: integer("investorId").notNull(),
    eventType: registerEventTypeEnum("eventType").notNull(),
    shareClass: shareClassEnum("shareClass").notNull(),
    shareClassId: integer("shareClassId"),   // FK to share_classes (nullable for legacy rows)
    // Shares: signed integer. Issuance / transfer_in positive;
    // transfer_out / cancellation / reversal negative (by convention).
    shares: bigint("shares", { mode: "number" }).notNull(),
    // Economics at event time (nullable for non-monetary events e.g. transfers)
    pricePerShare: decimal("pricePerShare", { precision: 20, scale: 6 }),
    currency: varchar("currency", { length: 8 }).default("NTD"),
    fxToNtd: decimal("fxToNtd", { precision: 18, scale: 8 }).default("1"),
    totalAmount: decimal("totalAmount", { precision: 20, scale: 2 }),
    // Effective date separate from createdAt (backdating support)
    effectiveDate: date("effectiveDate").notNull(),
    // Reversal linkage
    reversedEntryId: integer("reversedEntryId"),
    // ── Encrypted financial fields (Phase 3 dual-write) ──
    sharesEnc: text("shares_enc"),
    pricePerShareEnc: text("price_per_share_enc"),
    fxToNtdEnc: text("fx_to_ntd_enc"),
    totalAmountEnc: text("total_amount_enc"),

    notes: text("notes"),
    createdByUserId: integer("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ShareRegisterEntry = typeof shareRegisterEntries.$inferSelect;
export type InsertShareRegisterEntry = typeof shareRegisterEntries.$inferInsert;

// ─── Snapshots (auto-created on register write, plus manual) ────────────────
// Captures the derived cap-table state at a point in time. Distinct from
// legacy `cap_table_snapshots` (which remains for backwards compatibility).
export const snapshots = pgTable("snapshots", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    triggerType: snapshotTriggerEnum("triggerType").default("register_write").notNull(),
    // Which register entry triggered this snapshot (null for manual)
    registerEntryId: integer("registerEntryId"),
    // Serialized cap table at this point in time
    capTableData: jsonb("capTableData").notNull(),
    // Quick stats
    totalShares: bigint("totalShares", { mode: "number" }).default(0).notNull(),
    totalInvestors: integer("totalInvestors").default(0).notNull(),
    notes: text("notes"),
    createdByUserId: integer("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Snapshot = typeof snapshots.$inferSelect;
export type InsertSnapshot = typeof snapshots.$inferInsert;

// ─── V1 ESOP Pools ──────────────────────────────────────────────────────────
// Replaces legacy `esop_pool`. A company can have multiple pools (e.g. a
// Seed-era pool + a post-Series-A top-up). Tracks totals; per-grant detail
// lives in `esop_grants_v1`.
export const esopPoolsV1 = pgTable("esop_pools_v1", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    fundingRoundId: integer("fundingRoundId"),
    totalShares: bigint("totalShares", { mode: "number" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EsopPoolV1 = typeof esopPoolsV1.$inferSelect;
export type InsertEsopPoolV1 = typeof esopPoolsV1.$inferInsert;

// ─── V1 ESOP Grant Status ───────────────────────────────────────────────────
export const esopGrantV1StatusEnum = pgEnum("esop_grant_v1_status", [
    "active",
    "fully_vested",
    "exercised",
    "cancelled",
]);

// ─── V1 ESOP Grants ─────────────────────────────────────────────────────────
// Replaces legacy `esop_grants`. Always points at an `investors` row via
// `investorId` (V1-native, no legacy shareholderId). Employees who are not
// investors should be added to `investors` first.
export const esopGrantsV1 = pgTable("esop_grants_v1", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    poolId: integer("poolId").notNull(),
    investorId: integer("investorId").notNull(),
    grantDate: date("grantDate").notNull(),
    sharesGranted: bigint("sharesGranted", { mode: "number" }).notNull(),
    sharesVested: bigint("sharesVested", { mode: "number" }).default(0).notNull(),
    sharesExercised: bigint("sharesExercised", { mode: "number" }).default(0).notNull(),
    sharesCancelled: bigint("sharesCancelled", { mode: "number" }).default(0).notNull(),
    exercisePrice: decimal("exercisePrice", { precision: 20, scale: 6 }),
    currency: varchar("currency", { length: 8 }).default("NTD"),
    vestingStartDate: date("vestingStartDate"),
    vestingCliffMonths: integer("vestingCliffMonths").default(12),
    vestingTotalMonths: integer("vestingTotalMonths").default(48),
    status: esopGrantV1StatusEnum("status").default("active").notNull(),
    expiryDate: date("expiryDate"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EsopGrantV1 = typeof esopGrantsV1.$inferSelect;
export type InsertEsopGrantV1 = typeof esopGrantsV1.$inferInsert;

// ─── Instruments (Equity / SAFE / Convertible Note) ────────────────────────
// Tracks financing instruments independently of the cap table. Equity rows
// represent an instrument record for bookkeeping (the actual shares are
// recorded via share_register_entries). SAFEs and convertible notes stay as
// instruments until converted at a qualified round.
// Instruments only tracks pre-conversion investment tools (SAFE, Convertible
// Note). Regular equity issuances are recorded via Funding Rounds + the share
// register. The `equity` value is deliberately not listed here.
// NOTE: Postgres does not support removing enum values. If the production DB
// still has `equity` in the underlying PG enum, the DB value stays but is no
// longer accepted by the router's zod input or shown in the UI.
export const instrumentTypeEnum = pgEnum("instrument_type", [
    "safe",
    "convertible_note",
]);

export const instrumentStatusEnum = pgEnum("instrument_status", [
    "active",       // not yet converted / still valid
    "converted",    // converted into equity
    "cancelled",    // cancelled before conversion
    "matured",      // convertible note hit maturity without converting
]);

export const instrumentSafeTypeEnum = pgEnum("instrument_safe_type", [
    "pre_money",
    "post_money",   // YC standard
    "mfn",          // Most Favored Nation
]);

export const instruments = pgTable("instruments", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),

    // ── Basics ──
    name: varchar("name", { length: 255 }).notNull(),
    type: instrumentTypeEnum("type").notNull(),
    status: instrumentStatusEnum("status").default("active").notNull(),

    // ── Relations ──
    investorId: integer("investorId").notNull(),          // points to investors.id (V1)
    fundingRoundId: integer("fundingRoundId"),             // optional (SAFEs can pre-date any round)

    // ── Amount ──
    investmentAmountNtd: decimal("investmentAmountNtd", { precision: 20, scale: 2 }).notNull(),
    investmentAmountUsd: decimal("investmentAmountUsd", { precision: 20, scale: 2 }),

    // ── Equity-specific ──
    pricePerShareNtd: decimal("pricePerShareNtd", { precision: 20, scale: 6 }),
    sharesIssued: bigint("sharesIssued", { mode: "number" }),

    // ── SAFE-specific ──
    valuationCapNtd: decimal("valuationCapNtd", { precision: 20, scale: 2 }),
    valuationCapUsd: decimal("valuationCapUsd", { precision: 20, scale: 2 }),
    discountRate: decimal("discountRate", { precision: 5, scale: 4 }),
    safeType: instrumentSafeTypeEnum("safeType"),

    // ── Convertible-note-specific ──
    interestRate: decimal("interestRate", { precision: 5, scale: 4 }),
    maturityDate: date("maturityDate"),
    accruedInterestNtd: decimal("accruedInterestNtd", { precision: 20, scale: 2 }),

    // ── Conversion results (filled on trigger) ──
    conversionRoundId: integer("conversionRoundId"),
    conversionDate: date("conversionDate"),
    conversionPriceNtd: decimal("conversionPriceNtd", { precision: 20, scale: 6 }),
    conversionShares: bigint("conversionShares", { mode: "number" }),

    // ── Encrypted financial fields (Phase 3 dual-write) ──
    investmentAmountNtdEnc: text("investment_amount_ntd_enc"),
    investmentAmountUsdEnc: text("investment_amount_usd_enc"),
    pricePerShareNtdEnc: text("price_per_share_ntd_enc"),
    sharesIssuedEnc: text("shares_issued_enc"),
    valuationCapNtdEnc: text("valuation_cap_ntd_enc"),
    valuationCapUsdEnc: text("valuation_cap_usd_enc"),
    discountRateEnc: text("discount_rate_enc"),
    interestRateEnc: text("interest_rate_enc"),
    accruedInterestNtdEnc: text("accrued_interest_ntd_enc"),
    conversionPriceNtdEnc: text("conversion_price_ntd_enc"),
    conversionSharesEnc: text("conversion_shares_enc"),

    // ── Meta ──
    notes: text("notes"),
    boardApprovalDate: date("boardApprovalDate"),
    documentUrl: text("documentUrl"),
    createdByUserId: integer("createdByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Instrument = typeof instruments.$inferSelect;
export type InsertInstrument = typeof instruments.$inferInsert;

// ─── eSignature (DocuSeal) ──────────────────────────────────────────────────

export const signingStatusEnum = pgEnum("signing_status", [
    "draft",
    "pending",
    "viewed",
    "completed",
    "declined",
    "expired",
]);

export const signingDocTypeEnum = pgEnum("signing_doc_type", [
    "share_certificate",
    "safe_agreement",
    "convertible_note",
    "stock_option_grant",
    "board_resolution",
    "sha",
    "custom",
]);

export const signingRequests = pgTable("signing_requests", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),

    // Document type & metadata
    docType: signingDocTypeEnum("docType").notNull(),
    title: text("title").notNull(),
    description: text("description"),

    // Linked entity (optional)
    linkedResourceType: text("linkedResourceType"),   // "investor" | "instrument" | "esop_grant"
    linkedResourceId: integer("linkedResourceId"),

    // DocuSeal IDs
    docusealTemplateId: integer("docusealTemplateId"),
    docusealSubmissionId: integer("docusealSubmissionId"),

    // Status
    status: signingStatusEnum("status").default("draft").notNull(),

    // Signers (JSON array: [{role, name, email, signedAt?}])
    signers: text("signers"),

    // Files
    sourceDocumentUrl: text("sourceDocumentUrl"),
    signedDocumentUrl: text("signedDocumentUrl"),

    // Tracking
    sentAt: timestamp("sentAt"),
    completedAt: timestamp("completedAt"),
    expiresAt: timestamp("expiresAt"),

    // Metadata
    createdBy: integer("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type SigningRequest = typeof signingRequests.$inferSelect;
export type InsertSigningRequest = typeof signingRequests.$inferInsert;

// ─── Signing Templates (reusable document templates) ────────────────────────
// scope = "platform" → visible to all companies (admin-managed)
// scope = "company"  → visible only to that company
export const signingTemplateScopeEnum = pgEnum("signing_template_scope", ["platform", "company"]);

export const signingTemplates = pgTable("signing_templates", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"),          // null for platform-scope templates

    scope: signingTemplateScopeEnum("scope").default("company").notNull(),
    docType: signingDocTypeEnum("docType").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    // DocuSeal template ID (created when the file is uploaded)
    docusealTemplateId: integer("docusealTemplateId"),

    // Original file stored in Vercel Blob
    fileUrl: text("fileUrl"),
    fileName: text("fileName"),

    createdBy: integer("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type SigningTemplate = typeof signingTemplates.$inferSelect;
export type InsertSigningTemplate = typeof signingTemplates.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "email", "both"]);
export const notificationTypeEnum = pgEnum("notification_type", [
    "funding_round",     // new round created / closed
    "document_signing",  // signing request sent / completed
    "vesting_milestone", // cliff reached, fully vested
    "valuation_409a",    // 409A expiring soon
    "election_83b",      // 83(b) filing deadline approaching
    "share_transfer",    // shares transferred
    "general",           // manual / system notification
]);

export const notifications = pgTable("notifications", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    userId: integer("userId"),                    // target user (null = company-wide)
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message"),
    channel: notificationChannelEnum("channel").default("both").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    emailSent: boolean("email_sent").default(false).notNull(),
    emailSentAt: timestamp("email_sent_at"),
    linkUrl: varchar("link_url", { length: 500 }),   // in-app link to related page
    metadata: text("metadata"),                       // JSON: { grantId, roundId, etc. }
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Share Transfers (Secondary Trading) ──────────────────────────────────────
export const shareTransferStatusEnum = pgEnum("share_transfer_status", ["pending", "rofr_notice", "approved", "completed", "rejected"]);

export const shareTransfers = pgTable("share_transfers", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    sellerInvestorId: integer("seller_investor_id").notNull(),
    buyerInvestorId: integer("buyer_investor_id"),         // null if buyer is new / external
    buyerName: varchar("buyer_name", { length: 255 }),
    buyerEmail: varchar("buyer_email", { length: 320 }),
    shareClass: varchar("share_class", { length: 64 }).notNull(),
    shares: integer("shares").notNull(),
    pricePerShare: decimal("price_per_share", { precision: 18, scale: 6 }),
    totalPrice: decimal("total_price", { precision: 20, scale: 4 }),
    currency: varchar("currency", { length: 8 }).default("USD"),
    transferDate: date("transfer_date").notNull(),
    status: shareTransferStatusEnum("status").default("pending").notNull(),
    hasRofr: boolean("has_rofr").default(false).notNull(),   // right of first refusal applicable
    rofrDeadline: date("rofr_deadline"),
    rofrWaivedAt: timestamp("rofr_waived_at"),
    boardApprovalDate: date("board_approval_date"),
    registerEntryId: integer("register_entry_id"),           // links to share_register after completion
    // ── Encrypted financial fields (Phase 3 dual-write) ──
    sharesEnc: text("shares_enc"),
    pricePerShareEnc: text("price_per_share_enc"),
    totalPriceEnc: text("total_price_enc"),

    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ShareTransfer = typeof shareTransfers.$inferSelect;
export type InsertShareTransfer = typeof shareTransfers.$inferInsert;

// ─── Tech Share / RSA Tax Tracking (台灣法規) ─────────────────────────────────
export const techShareTypeEnum = pgEnum("tech_share_type", ["tech_share", "rsa"]);
export const techShareTaxStatusEnum = pgEnum("tech_share_tax_status", ["deferred", "taxable", "filed", "exempt"]);
export const dispositionTypeEnum = pgEnum("disposition_type", ["transfer", "resignation", "ipo", "other"]);

export const techShareTaxRecords = pgTable("tech_share_tax_records", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    grantId: integer("grantId"),                                // FK to esop grants / allocations
    holderName: varchar("holder_name", { length: 255 }).notNull(),
    shareType: techShareTypeEnum("share_type").notNull(),
    // 取得資訊
    acquisitionDate: date("acquisition_date").notNull(),
    sharesAcquired: integer("shares_acquired").notNull(),
    acquisitionFmv: decimal("acquisition_fmv", { precision: 18, scale: 6 }),  // TWD per share
    paidAmount: decimal("paid_amount", { precision: 18, scale: 6 }),          // RSA 認購價
    // 緩課條件 (產創 §19-1)
    isDeferralEligible: boolean("is_deferral_eligible").default(false).notNull(),
    deferralStartDate: date("deferral_start_date"),
    deferralExpiryDate: date("deferral_expiry_date"),       // 取得日 + 5 年
    holdingPeriodMet: boolean("holding_period_met").default(false).notNull(),  // 滿 2 年
    // RSA 解限
    vestingDate: date("vesting_date"),
    vestingFmv: decimal("vesting_fmv", { precision: 18, scale: 6 }),
    // 處分 / 轉讓
    dispositionDate: date("disposition_date"),
    dispositionFmv: decimal("disposition_fmv", { precision: 18, scale: 6 }),
    dispositionType: dispositionTypeEnum("disposition_type"),
    // 稅務
    taxableIncome: decimal("taxable_income", { precision: 20, scale: 4 }),
    estimatedTax: decimal("estimated_tax", { precision: 20, scale: 4 }),
    taxStatus: techShareTaxStatusEnum("tax_status").default("deferred").notNull(),
    // 申報追蹤
    filingDeadline: date("filing_deadline"),
    filingDate: date("filing_date"),
    filingReference: varchar("filing_reference", { length: 100 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type TechShareTaxRecord = typeof techShareTaxRecords.$inferSelect;
export type InsertTechShareTaxRecord = typeof techShareTaxRecords.$inferInsert;

// ─── Closed Company Provisions (閉鎖性公司 — 台灣法規) ────────────────────────
export const transferRestrictionEnum = pgEnum("transfer_restriction", ["none", "board_approval", "shareholder_approval", "custom"]);
export const parValueTypeEnum = pgEnum("par_value_type", ["par", "no_par"]);
export const dividendPriorityEnum = pgEnum("dividend_priority", ["cumulative", "non_cumulative", "participating", "none"]);

export const closedCompanyProvisions = pgTable("closed_company_provisions", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    isClosedCompany: boolean("is_closed_company").default(false).notNull(),
    parValueType: parValueTypeEnum("par_value_type").default("par").notNull(),
    transferRestriction: transferRestrictionEnum("transfer_restriction").default("none").notNull(),
    transferDescription: text("transfer_description"),
    articlesUrl: varchar("articles_url", { length: 500 }),
    effectiveDate: date("effective_date"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ClosedCompanyProvision = typeof closedCompanyProvisions.$inferSelect;
export type InsertClosedCompanyProvision = typeof closedCompanyProvisions.$inferInsert;

export const closedCompanyShareRights = pgTable("closed_company_share_rights", {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    shareClassId: integer("share_class_id"),                   // FK to share_classes
    shareClassName: varchar("share_class_name", { length: 128 }).notNull(),
    // 表決權
    votesPerShare: decimal("votes_per_share", { precision: 6, scale: 2 }).default("1.00").notNull(),
    hasVetoRight: boolean("has_veto_right").default(false).notNull(),
    vetoMatters: text("veto_matters"),                          // JSON: veto items
    // 董事
    guaranteedBoardSeats: integer("guaranteed_board_seats").default(0).notNull(),
    boardObserverRights: boolean("board_observer_rights").default(false).notNull(),
    // 股利
    dividendPriority: dividendPriorityEnum("dividend_priority").default("none").notNull(),
    dividendRate: decimal("dividend_rate", { precision: 6, scale: 4 }),
    // 清算
    liquidationPriority: integer("liquidation_priority").default(1).notNull(),
    liquidationMultiple: decimal("liquidation_multiple", { precision: 6, scale: 2 }).default("1.00"),
    // 轉換
    isConvertible: boolean("is_convertible").default(false).notNull(),
    conversionRatio: decimal("conversion_ratio", { precision: 10, scale: 4 }),
    conversionTrigger: text("conversion_trigger"),
    // 其他
    customProvisions: text("custom_provisions"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ClosedCompanyShareRight = typeof closedCompanyShareRights.$inferSelect;
export type InsertClosedCompanyShareRight = typeof closedCompanyShareRights.$inferInsert;

// ─── Support Tickets ────────────────────────────────────────────────────────
export const supportTicketTypeEnum = pgEnum("support_ticket_type", [
  "feedback", "bug", "billing", "feature_request", "general",
]);
export const supportTicketStatusEnum = pgEnum("support_ticket_status", [
  "open", "in_progress", "resolved", "closed",
]);
export const supportTicketPriorityEnum = pgEnum("support_ticket_priority", [
  "low", "medium", "high",
]);

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  userId: integer("user_id").notNull(),
  userName: varchar("user_name", { length: 256 }),
  userEmail: varchar("user_email", { length: 256 }),
  type: supportTicketTypeEnum("type").default("general").notNull(),
  priority: supportTicketPriorityEnum("priority").default("medium").notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  message: text("message").notNull(),
  status: supportTicketStatusEnum("status").default("open").notNull(),
  adminNotes: text("admin_notes"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

// ─── Support FAQs ───────────────────────────────────────────────────────────
export const supportFaqCategoryEnum = pgEnum("support_faq_category", [
  "account", "subscription", "equity", "technical", "general",
]);

export const supportFaqs = pgTable("support_faqs", {
  id: serial("id").primaryKey(),
  category: supportFaqCategoryEnum("category").default("general").notNull(),
  questionEn: text("question_en").notNull(),
  questionZh: text("question_zh").notNull(),
  answerEn: text("answer_en").notNull(),
  answerZh: text("answer_zh").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SupportFaq = typeof supportFaqs.$inferSelect;
export type InsertSupportFaq = typeof supportFaqs.$inferInsert;

// ─── Company Encryption Keys (per-tenant DEK for envelope encryption) ───────
export const companyKeys = pgTable("company_keys", {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull().unique(),
    encryptedDek: text("encrypted_dek").notNull(),          // KEK-encrypted DEK (base64)
    dekVersion: integer("dek_version").default(1).notNull(),
    algorithm: varchar("algorithm", { length: 32 }).default("aes-256-gcm").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    rotatedAt: timestamp("rotated_at"),
});
export type CompanyKey = typeof companyKeys.$inferSelect;
export type InsertCompanyKey = typeof companyKeys.$inferInsert;
