/**
 * Role-Based Access Control (RBAC) — single source of truth.
 *
 * Defines what each company-level role can see and do.
 * Used by both frontend (sidebar filtering, button hiding) and backend (guard reference).
 */

export type CompanyRole = "owner" | "admin" | "cfo" | "lawyer" | "investor" | "viewer";

// ── Navigation groups each role can see ────────────────────────────────
// Keys match the `type` or label used in buildNavStructure
export type NavGroupKey =
  | "dashboard"
  | "equity"
  | "fundraising"
  | "analysis"
  | "investorPortal"
  | "compliance"
  | "settings";

const ALL_NAV: NavGroupKey[] = [
  "dashboard", "equity", "fundraising", "analysis",
  "investorPortal", "compliance", "settings",
];

export const ROLE_VISIBLE_NAV: Record<CompanyRole, NavGroupKey[]> = {
  owner:    ALL_NAV,
  admin:    ALL_NAV,
  cfo:      ["dashboard", "equity", "fundraising", "analysis", "compliance"],
  lawyer:   ["dashboard", "compliance"],
  investor: ["investorPortal"],
  viewer:   ["dashboard", "equity", "fundraising", "analysis", "compliance"],
};

// ── Settings sub-pages each role can see ───────────────────────────────
export type SettingsPageKey =
  | "company" | "team" | "import" | "snapshots" | "auditLog";

export const ROLE_VISIBLE_SETTINGS: Record<CompanyRole, SettingsPageKey[]> = {
  owner:    ["company", "team", "import", "snapshots", "auditLog"],
  admin:    ["company", "team", "import", "snapshots", "auditLog"],
  cfo:      ["snapshots", "auditLog"],
  lawyer:   [],
  investor: [],
  viewer:   ["snapshots", "auditLog"],
};

// Path → settings key mapping (used by frontend to filter settings items)
export const SETTINGS_PATH_MAP: Record<string, SettingsPageKey> = {
  "/settings": "company",
  "/team": "team",
  "/import": "import",
  "/snapshots": "snapshots",
  "/audit-log": "auditLog",
};

// ── Allowed pages (paths) per role ─────────────────────────────────────
// Used for route-level protection. If a role isn't listed, the user gets redirected.
export const ROLE_ALLOWED_PATHS: Record<CompanyRole, string[] | "all"> = {
  owner: "all",
  admin: "all",
  cfo: [
    "/", "/cap-table", "/register", "/esop", "/esign",
    "/funding-rounds", "/investors", "/instruments",
    "/waterfall", "/valuation", "/projections", "/anti-dilution",
    "/tech-share-tax", "/closed-company", "/409a", "/83b", "/transfers",
    "/snapshots", "/audit-log",
    "/subscription", "/pricing", "/help",
  ],
  lawyer: [
    "/",
    "/tech-share-tax", "/closed-company", "/409a", "/83b", "/transfers",
    "/help",
  ],
  investor: [
    "/investor-portal", "/help",
  ],
  viewer: [
    "/", "/cap-table", "/register", "/esop", "/esign",
    "/funding-rounds", "/investors", "/instruments",
    "/waterfall", "/valuation", "/projections", "/anti-dilution",
    "/tech-share-tax", "/closed-company", "/409a", "/83b", "/transfers",
    "/snapshots", "/audit-log",
    "/subscription", "/pricing", "/help",
  ],
};

// ── Capability flags per role ──────────────────────────────────────────
export type RoleCapabilities = {
  canEdit: boolean;           // create / update / delete business data
  canManageTeam: boolean;     // invite members, change roles
  canTransferOwnership: boolean;
  canExport: boolean;         // PDF / Excel export
  canManageCompany: boolean;  // company settings
};

export const ROLE_CAPABILITIES: Record<CompanyRole, RoleCapabilities> = {
  owner: {
    canEdit: true,
    canManageTeam: true,
    canTransferOwnership: true,
    canExport: true,
    canManageCompany: true,
  },
  admin: {
    canEdit: true,
    canManageTeam: true,
    canTransferOwnership: false,
    canExport: true,
    canManageCompany: true,
  },
  cfo: {
    canEdit: true,
    canManageTeam: false,
    canTransferOwnership: false,
    canExport: true,
    canManageCompany: false,
  },
  lawyer: {
    canEdit: false,
    canManageTeam: false,
    canTransferOwnership: false,
    canExport: true,
    canManageCompany: false,
  },
  investor: {
    canEdit: false,
    canManageTeam: false,
    canTransferOwnership: false,
    canExport: false,
    canManageCompany: false,
  },
  viewer: {
    canEdit: false,
    canManageTeam: false,
    canTransferOwnership: false,
    canExport: true,
    canManageCompany: false,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────

/** Check if a role can see a specific nav group */
export function canSeeNavGroup(role: CompanyRole, group: NavGroupKey): boolean {
  return ROLE_VISIBLE_NAV[role].includes(group);
}

/** Check if a role can access a specific path */
export function canAccessPath(role: CompanyRole, path: string): boolean {
  const allowed = ROLE_ALLOWED_PATHS[role];
  if (allowed === "all") return true;
  // Handle dynamic paths like /funding-rounds/123
  return allowed.some(p => path === p || path.startsWith(p + "/"));
}

/** Get the default landing page for a role */
export function getDefaultPath(role: CompanyRole): string {
  if (role === "investor") return "/investor-portal";
  return "/";
}

/** Get capabilities for a role */
export function getCapabilities(role: CompanyRole): RoleCapabilities {
  return ROLE_CAPABILITIES[role];
}
