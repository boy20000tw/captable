/**
 * Caploom Subscription Plans — single source of truth for feature gating.
 *
 * Used by both server (tRPC middleware) and client (FeatureGate component).
 * DB enum: "starter" | "standard" | "plus" | "enterprise"
 */

export type PlanKey = "starter" | "standard" | "plus" | "enterprise";

/**
 * Map legacy DB plan values to current PlanKey.
 * Old enum: "free" | "paid" | "custom"  →  New: "starter" | "standard" | "enterprise"
 * Any unrecognised value falls back to "starter".
 */
const LEGACY_PLAN_MAP: Record<string, PlanKey> = {
  free: "starter",
  paid: "standard",
  custom: "enterprise",
};

export function normalizePlan(raw: string | null | undefined): PlanKey {
  if (!raw) return "starter";
  if (raw === "starter" || raw === "standard" || raw === "plus" || raw === "enterprise") {
    return raw;
  }
  return LEGACY_PLAN_MAP[raw] ?? "starter";
}

// ── Feature identifiers ────────────────────────────────────────────────────
// Each gated capability gets a unique string. Prefix by module for readability.

export type Feature =
  // Equity
  | "equity.preferredShares"
  | "equity.customClasses"
  | "equity.vestingExercise"
  // Fundraising
  | "fundraising.rounds"
  | "fundraising.investors"
  | "fundraising.instruments"
  | "fundraising.certificates"
  // Analysis
  | "analysis.waterfall"
  | "analysis.valuation"
  | "analysis.projections"
  | "analysis.antiDilution"
  // Signing & portal
  | "esign"
  | "esignUnlimitedTemplates"
  | "investorPortal"
  | "shareTransfers"
  // Compliance & tax
  | "compliance.409a"
  | "compliance.83b"
  | "compliance.techShareTax"
  | "compliance.closedCompany"
  // Admin & ops
  | "snapshots"
  | "sso"
  | "api";

// ── Usage limit keys ───────────────────────────────────────────────────────

export type UsageLimitKey = "companies" | "shareholders" | "teamMembers" | "esopGrants" | "esignTemplates";

// ── Plan definitions ───────────────────────────────────────────────────────

export type PlanDef = {
  key: PlanKey;
  features: Set<Feature>;
  limits: Record<UsageLimitKey, number>; // Infinity = unlimited
  auditLogDays: number;                  // Infinity = unlimited
};

const STARTER_FEATURES = new Set<Feature>([
  // Core equity — cap table, share register, basic ESOP
  "fundraising.rounds",
  "fundraising.investors",
]);

const STANDARD_FEATURES = new Set<Feature>([
  ...Array.from(STARTER_FEATURES),
  // 🔥 主力方案 — "真正開始用來做事"
  // Equity extras
  "equity.preferredShares",
  "equity.vestingExercise",
  // Fundraising extras
  "fundraising.instruments",
  "fundraising.certificates",
  // Basic dilution analysis
  "analysis.waterfall",
  // eSign (limited templates)
  "esign",
  // Taiwan compliance (primary TA)
  "compliance.techShareTax",
  "compliance.closedCompany",
  // Admin
  "snapshots",
]);

const PLUS_FEATURES = new Set<Feature>([
  ...Array.from(STANDARD_FEATURES),
  // Anchor 方案 — 讓 Standard 看起來划算
  // Unlimited eSign templates
  "esignUnlimitedTemplates",
  // Scenario simulation & advanced analysis
  "analysis.valuation",
  "analysis.projections",
  "analysis.antiDilution",
  // Investor portal & reports
  "investorPortal",
  // Transfers
  "shareTransfers",
  // US compliance (expansion stage)
  "compliance.409a",
  "compliance.83b",
  // Custom share classes
  "equity.customClasses",
]);

const ENTERPRISE_FEATURES = new Set<Feature>([
  ...Array.from(PLUS_FEATURES),
  // Enterprise extras
  "sso",
  "api",
]);

export const PLANS: Record<PlanKey, PlanDef> = {
  starter: {
    key: "starter",
    features: STARTER_FEATURES,
    limits: {
      companies: 1,
      shareholders: 5,
      teamMembers: 2,
      esopGrants: 5,
      esignTemplates: 0,
    },
    auditLogDays: 30,
  },
  standard: {
    key: "standard",
    features: STANDARD_FEATURES,
    limits: {
      companies: 1,              // 同 Starter，單一公司
      shareholders: 15,
      teamMembers: 10,
      esopGrants: Infinity,
      esignTemplates: 3,         // 有限模板
    },
    auditLogDays: 365,
  },
  plus: {
    key: "plus",
    features: PLUS_FEATURES,
    limits: {
      companies: 3,
      shareholders: Infinity,    // 無限股東
      teamMembers: 30,
      esopGrants: Infinity,
      esignTemplates: Infinity,  // 無限模板
    },
    auditLogDays: Infinity,
  },
  enterprise: {
    key: "enterprise",
    features: ENTERPRISE_FEATURES,
    limits: {
      companies: Infinity,
      shareholders: Infinity,
      teamMembers: Infinity,
      esopGrants: Infinity,
      esignTemplates: Infinity,
    },
    auditLogDays: Infinity,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Check if a plan includes a specific feature */
export function planHasFeature(plan: PlanKey, feature: Feature): boolean {
  return PLANS[plan].features.has(feature);
}

/** Get usage limit for a plan */
export function planLimit(plan: PlanKey, key: UsageLimitKey): number {
  return PLANS[plan].limits[key];
}

/** Find the minimum plan that includes a feature */
export function minimumPlanFor(feature: Feature): PlanKey {
  if (PLANS.starter.features.has(feature)) return "starter";
  if (PLANS.standard.features.has(feature)) return "standard";
  if (PLANS.plus.features.has(feature)) return "plus";
  return "enterprise";
}

// ── Feature → route path mapping (for frontend nav gating) ────────────────

export const FEATURE_ROUTE_MAP: Record<string, Feature> = {
  "/instruments": "fundraising.instruments",
  "/waterfall": "analysis.waterfall",
  "/valuation": "analysis.valuation",
  "/projections": "analysis.projections",
  "/anti-dilution": "analysis.antiDilution",
  "/esign": "esign",
  "/investor-portal": "investorPortal",
  "/transfers": "shareTransfers",
  "/409a": "compliance.409a",
  "/83b": "compliance.83b",
  "/tech-share-tax": "compliance.techShareTax",
  "/closed-company": "compliance.closedCompany",
  "/snapshots": "snapshots",
};

// ── Feature comparison table data (for Compare Plans page) ───────────────

export type ComparisonSection = {
  sectionKey: string; // i18n key prefix
  rows: ComparisonRow[];
};

export type ComparisonRow = {
  labelKey: string; // i18n key
  starter: string | boolean;
  standard: string | boolean;
  plus: string | boolean;
  enterprise: string | boolean;
};

export const COMPARISON_TABLE: ComparisonSection[] = [
  {
    sectionKey: "compare.limits",
    rows: [
      { labelKey: "compare.companies",       starter: "1",       standard: "1",                 plus: "3",                     enterprise: "compare.unlimited" },
      { labelKey: "compare.shareholders",    starter: "5",       standard: "15",                plus: "compare.unlimited",     enterprise: "compare.unlimited" },
      { labelKey: "compare.teamMembers",     starter: "2",       standard: "10",                plus: "30",                    enterprise: "compare.unlimited" },
      { labelKey: "compare.esopGrants",      starter: "5",       standard: "compare.unlimited", plus: "compare.unlimited",     enterprise: "compare.unlimited" },
      { labelKey: "compare.esignTemplates",  starter: false,     standard: "3",                 plus: "compare.unlimited",     enterprise: "compare.unlimited" },
    ],
  },
  {
    sectionKey: "compare.coreEquity",
    rows: [
      { labelKey: "compare.capTable",        starter: true,  standard: true,  plus: true,  enterprise: true },
      { labelKey: "compare.shareRegister",   starter: true,  standard: true,  plus: true,  enterprise: true },
      { labelKey: "compare.shareClasses",    starter: "compare.commonOnly", standard: "compare.commonPreferred", plus: "compare.customClasses", enterprise: "compare.customClasses" },
      { labelKey: "compare.esop",            starter: "compare.basicGrants", standard: "compare.vestingExercise", plus: true, enterprise: true },
      { labelKey: "compare.pdfExcel",        starter: false, standard: true,  plus: true,  enterprise: true },
    ],
  },
  {
    sectionKey: "compare.fundraising",
    rows: [
      { labelKey: "compare.fundingRounds",   starter: true,  standard: true, plus: true, enterprise: true },
      { labelKey: "compare.investorPipeline", starter: true,  standard: true, plus: true, enterprise: true },
      { labelKey: "compare.instruments",     starter: false, standard: true, plus: true, enterprise: true },
      { labelKey: "compare.certificates",    starter: false, standard: true, plus: true, enterprise: true },
    ],
  },
  {
    sectionKey: "compare.analysis",
    rows: [
      { labelKey: "compare.waterfall",       starter: false, standard: true,  plus: true,  enterprise: true },
      { labelKey: "compare.valuation",       starter: false, standard: false, plus: true,  enterprise: true },
      { labelKey: "compare.projections",     starter: false, standard: false, plus: true,  enterprise: true },
      { labelKey: "compare.antiDilution",    starter: false, standard: false, plus: true,  enterprise: true },
    ],
  },
  {
    sectionKey: "compare.signingPortal",
    rows: [
      { labelKey: "compare.esign",           starter: false, standard: "compare.limitedTemplates", plus: "compare.allTemplates", enterprise: true },
      { labelKey: "compare.investorPortal",  starter: false, standard: false, plus: true, enterprise: true },
      { labelKey: "compare.shareTransfers",  starter: false, standard: false, plus: true, enterprise: true },
    ],
  },
  {
    sectionKey: "compare.compliance",
    rows: [
      { labelKey: "compare.techShareTax",    starter: false, standard: true,  plus: true, enterprise: true },
      { labelKey: "compare.closedCompany",   starter: false, standard: true,  plus: true, enterprise: true },
      { labelKey: "compare.409a",            starter: false, standard: false, plus: true, enterprise: true },
      { labelKey: "compare.83b",             starter: false, standard: false, plus: true, enterprise: true },
    ],
  },
  {
    sectionKey: "compare.adminOps",
    rows: [
      { labelKey: "compare.teamRoles",      starter: "compare.ownerPlus1", standard: "compare.allRoles", plus: "compare.allRoles", enterprise: "compare.customRoles" },
      { labelKey: "compare.auditLog",       starter: "compare.30days",     standard: "compare.1year",    plus: "compare.unlimited", enterprise: "compare.unlimited" },
      { labelKey: "compare.snapshots",      starter: false, standard: true, plus: true, enterprise: true },
      { labelKey: "compare.dataImport",     starter: true,  standard: true, plus: true, enterprise: true },
      { labelKey: "compare.sso",            starter: false, standard: false, plus: false, enterprise: true },
      { labelKey: "compare.apiAccess",      starter: false, standard: false, plus: false, enterprise: true },
      { labelKey: "compare.dedicatedSupport", starter: false, standard: false, plus: false, enterprise: true },
    ],
  },
];
