import {
  pgTable,
  serial,
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
// Manages invitation tokens for onboarding new team members
export const userInvitations = pgTable("user_invitations", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  appRole: invitationAppRoleEnum("appRole").default("viewer").notNull(),
  invitedByUserId: serial("invitedByUserId").notNull(),
  status: invitationStatusEnum("status").default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  acceptedByUserId: serial("acceptedByUserId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = typeof userInvitations.$inferInsert;
// ─── Audit Logs ───────────────────────────────────────────────────────────────
// Records all data changes for compliance and traceability
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: serial("userId"),
  userName: varchar("userName", { length: 255 }),
  action: auditActionEnum("action").notNull(),
  resourceType: varchar("resourceType", { length: 64 }), // e.g. "shareholder", "funding_round", "esop_grant"
  resourceId: serial("resourceId"),
  resourceName: varchar("resourceName", { length: 255 }), // human-readable identifier
  changesBefore: text("changesBefore"), // JSON string of previous values
  changesAfter: text("changesAfter"),  // JSON string of new values
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── Shareholders ─────────────────────────────────────────────────────────────
export const shareholders = pgTable("shareholders", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  aka: varchar("aka", { length: 255 }),
  type: shareholderTypeEnum("type").default("other").notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  nationality: varchar("nationality", { length: 100 }),
  isEntity: boolean("isEntity").default(false).notNull(), // true = company, false = individual
  notes: text("notes"),
  lockupPeriod: text("lockupPeriod"), // e.g. "180 days from IPO", "6 months post-listing"
  taxBenefits: text("taxBenefits"), // e.g. "Section 1202 QSBS", "天使投資人抵稅 NT$3M"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Shareholder = typeof shareholders.$inferSelect;
export type InsertShareholder = typeof shareholders.$inferInsert;

// ─── Funding Rounds ───────────────────────────────────────────────────────────
export const fundingRounds = pgTable("funding_rounds", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // e.g. "Angel", "Seed", "Pre-A"
  roundDate: date("roundDate"),
  pricePerShareNtd: decimal("pricePerShareNtd", { precision: 20, scale: 6 }),
  moneyRaisedNtd: decimal("moneyRaisedNtd", { precision: 20, scale: 2 }),
  preMoneyValuationNtd: decimal("preMoneyValuationNtd", { precision: 20, scale: 2 }),
  postMoneyValuationNtd: decimal("postMoneyValuationNtd", { precision: 20, scale: 2 }),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 7 }), // NTD to USD
  status: fundingRoundStatusEnum("status").default("completed").notNull(),
  notes: text("notes"),
  sortOrder: serial("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type FundingRound = typeof fundingRounds.$inferSelect;
export type InsertFundingRound = typeof fundingRounds.$inferInsert;

// ─── Share Holdings (snapshot per round) ─────────────────────────────────────
export const shareHoldings = pgTable("share_holdings", {
  id: serial("id").primaryKey(),
  shareholderId: serial("shareholderId").notNull(),
  fundingRoundId: serial("fundingRoundId").notNull(), // which round this snapshot belongs to
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
  shareholderId: serial("shareholderId").notNull(),
  fundingRoundId: serial("fundingRoundId"),
  transactionDate: timestamp("transactionDate").defaultNow(),
  transactionType: shareTransactionTypeEnum("transactionType").notNull(),
  shareClass: shareClassEnum("shareClass").notNull(),
  sharesAmount: bigint("sharesAmount", { mode: "number" }).notNull(),
  pricePerShareNtd: decimal("pricePerShareNtd", { precision: 20, scale: 6 }),
  totalAmountNtd: decimal("totalAmountNtd", { precision: 20, scale: 2 }),
  // Tax deduction info (from Register of Shareholders)
  taxQualified: boolean("taxQualified").default(false),
  taxCapNtd: decimal("taxCapNtd", { precision: 20, scale: 2 }),
  lockUpEndDate: date("lockUpEndDate"),
  taxDeductionYear: serial("taxDeductionYear"),
  taxDeductionAmountNtd: decimal("taxDeductionAmountNtd", { precision: 20, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShareTransaction = typeof shareTransactions.$inferSelect;
export type InsertShareTransaction = typeof shareTransactions.$inferInsert;

// ─── ESOP Pool ────────────────────────────────────────────────────────────────
export const esopPool = pgTable("esop_pool", {
  id: serial("id").primaryKey(),
  fundingRoundId: serial("fundingRoundId"), // which round the pool was created/expanded
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
  esopPoolId: serial("esopPoolId").notNull(),
  shareholderId: serial("shareholderId"),
  granteeName: varchar("granteeName", { length: 255 }),
  grantDate: date("grantDate"),
  sharesGranted: bigint("sharesGranted", { mode: "number" }).notNull(),
  sharesVested: bigint("sharesVested", { mode: "number" }).default(0).notNull(),
  sharesExercised: bigint("sharesExercised", { mode: "number" }).default(0).notNull(),
  sharesCancelled: bigint("sharesCancelled", { mode: "number" }).default(0).notNull(),
  exercisePriceNtd: decimal("exercisePriceNtd", { precision: 20, scale: 6 }),
  vestingStartDate: date("vestingStartDate"),
  vestingCliffMonths: serial("vestingCliffMonths").default(12),
  vestingTotalMonths: serial("vestingTotalMonths").default(48),
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
  name: varchar("name", { length: 100 }).notNull(), // e.g. "A Round Target 2027"
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
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl"),
  status: importLogStatusEnum("status").default("pending").notNull(),
  recordsImported: serial("recordsImported").default(0),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImportLog = typeof importLogs.$inferSelect;
export type InsertImportLog = typeof importLogs.$inferInsert;

// ─── Cap Table Snapshots ──────────────────────────────────────────────────────
// Stores a point-in-time snapshot of the full cap table structure
export const capTableSnapshots = pgTable("cap_table_snapshots", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // e.g. "Pre-A Closing 2024-03"
  description: text("description"),
  snapshotDate: timestamp("snapshotDate").notNull(),
  triggerEvent: varchar("triggerEvent", { length: 100 }), // e.g. "funding_round", "transfer", "manual"
  fundingRoundId: serial("fundingRoundId"), // optional link to a round
  totalShares: bigint("totalShares", { mode: "number" }).default(0).notNull(),
  totalShareholders: serial("totalShareholders").default(0).notNull(),
  esopPoolTotal: bigint("esopPoolTotal", { mode: "number" }).default(0).notNull(),
  esopAllocated: bigint("esopAllocated", { mode: "number" }).default(0).notNull(),
  postMoneyValuationNtd: decimal("postMoneyValuationNtd", { precision: 20, scale: 2 }),
  snapshotData: text("snapshotData"), // JSON blob of full shareholder breakdown
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CapTableSnapshot = typeof capTableSnapshots.$inferSelect;
export type InsertCapTableSnapshot = typeof capTableSnapshots.$inferInsert;

// ─── Anti-Dilution Provisions ─────────────────────────────────────────────────
// Tracks anti-dilution clauses per investor per round
export const antiDilutionProvisions = pgTable("anti_dilution_provisions", {
  id: serial("id").primaryKey(),
  shareholderId: serial("shareholderId").notNull(),
  fundingRoundId: serial("fundingRoundId").notNull(), // round where the provision was granted
  provisionType: antiDilutionProvisionTypeEnum("provisionType").default("broad_based_wa").notNull(),
  originalPriceNtd: decimal("originalPriceNtd", { precision: 20, scale: 6 }).notNull(), // price paid
  adjustedPriceNtd: decimal("adjustedPriceNtd", { precision: 20, scale: 6 }), // recalculated price after down-round
  originalShares: bigint("originalShares", { mode: "number" }).notNull(),
  adjustedShares: bigint("adjustedShares", { mode: "number" }), // additional shares to be issued
  triggerRoundId: serial("triggerRoundId"), // the down-round that triggered the provision
  status: antiDilutionStatusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AntiDilutionProvision = typeof antiDilutionProvisions.$inferSelect;
export type InsertAntiDilutionProvision = typeof antiDilutionProvisions.$inferInsert;

// ─── Shareholder Documents ─────────────────────────────────────────────────────
// Tracks compliance documents per shareholder (SHA, subscription, NDA, etc.)
export const shareholderDocuments = pgTable("shareholder_documents", {
  id: serial("id").primaryKey(),
  shareholderId: serial("shareholderId").notNull(),
  documentType: shareholderDocumentTypeEnum("documentType").notNull(),
  documentName: varchar("documentName", { length: 255 }).notNull(),
  status: shareholderDocumentStatusEnum("status").default("pending").notNull(),
  signedDate: date("signedDate"),
  expiryDate: date("expiryDate"),
  fundingRoundId: serial("fundingRoundId"), // optional: which round this document belongs to
  fileUrl: text("fileUrl"), // optional: link to document
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShareholderDocument = typeof shareholderDocuments.$inferSelect;
export type InsertShareholderDocument = typeof shareholderDocuments.$inferInsert;

// ─── 409A Valuations ──────────────────────────────────────────────────────────
// Records independent 409A valuations for FMV (Fair Market Value) tracking
export const valuations409a = pgTable("valuations_409a", {
  id: serial("id").primaryKey(),
  valuationDate: date("valuationDate").notNull(),
  fmvPerShareNtd: decimal("fmvPerShareNtd", { precision: 18, scale: 4 }),
  fmvPerShareUsd: decimal("fmvPerShareUsd", { precision: 18, scale: 6 }),
  commonStockValueNtd: decimal("commonStockValueNtd", { precision: 20, scale: 2 }),
  preferredStockValueNtd: decimal("preferredStockValueNtd", { precision: 20, scale: 2 }),
  totalCompanyValueNtd: decimal("totalCompanyValueNtd", { precision: 20, scale: 2 }),
  valuationFirm: varchar("valuationFirm", { length: 255 }),
  reportUrl: text("reportUrl"),
  method: valuation409aMethodEnum("method").default("dcf"),
  relatedRoundId: serial("relatedRoundId"), // optional: linked funding round
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Valuation409a = typeof valuations409a.$inferSelect;
export type InsertValuation409a = typeof valuations409a.$inferInsert;

// ─── Liquidation Preferences ──────────────────────────────────────────────────
// Stores per-round liquidation preference terms for Waterfall analysis
export const liquidationPreferences = pgTable("liquidation_preferences", {
  id: serial("id").primaryKey(),
  fundingRoundId: serial("fundingRoundId").notNull().unique(),
  preferenceType: liquidationPreferenceTypeEnum("preferenceType").default("non_participating").notNull(),
  liquidationMultiple: decimal("liquidationMultiple", { precision: 6, scale: 2 }).default("1.00").notNull(),
  participationCap: decimal("participationCap", { precision: 6, scale: 2 }), // null = uncapped
  seniorityRank: serial("seniorityRank").default(1).notNull(), // 1 = most senior
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LiquidationPreference = typeof liquidationPreferences.$inferSelect;
export type InsertLiquidationPreference = typeof liquidationPreferences.$inferInsert;
