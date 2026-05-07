/**
 * Admin-Level RBAC — platform admin permissions.
 *
 * Separate from company-level rolePermissions.ts.
 * These roles apply only to users with `role === "admin"` in the users table.
 *
 * Hierarchy: super_admin > admin
 */

export type AdminRole = "super_admin" | "admin";

// ── Admin nav visibility ─────────────────────────────────────────────
export type AdminNavKey =
  | "overview"
  | "companies"
  | "tickets"
  | "team"
  | "templates"
  | "activity"
  | "versions"
  | "security"
  | "payment"
  | "notifications";

const ALL_ADMIN_NAV: AdminNavKey[] = [
  "overview", "companies", "tickets", "team", "templates",
  "activity", "versions", "security", "payment", "notifications",
];

export const ADMIN_ROLE_VISIBLE_NAV: Record<AdminRole, AdminNavKey[]> = {
  super_admin: ALL_ADMIN_NAV,
  admin:       ALL_ADMIN_NAV,
};

// ── Capability flags per admin role ──────────────────────────────────
export type AdminCapabilities = {
  canManageCompanies: boolean;    // edit plan, suspend/reactivate
  canManageTickets: boolean;      // respond to support tickets
  canManageAdminTeam: boolean;    // add/remove admins, change admin roles
  canTransferSuperAdmin: boolean; // transfer super_admin to another admin
  canViewAuditLog: boolean;       // view admin activity log
  canViewArchitecture: boolean;   // view security & payment architecture pages
  canEditPlatformConfig: boolean; // versions, security settings (future)
};

export const ADMIN_ROLE_CAPABILITIES: Record<AdminRole, AdminCapabilities> = {
  super_admin: {
    canManageCompanies: true,
    canManageTickets: true,
    canManageAdminTeam: true,
    canTransferSuperAdmin: true,
    canViewAuditLog: true,
    canViewArchitecture: true,
    canEditPlatformConfig: true,
  },
  admin: {
    canManageCompanies: true,
    canManageTickets: true,
    canManageAdminTeam: false,
    canTransferSuperAdmin: false,
    canViewAuditLog: true,
    canViewArchitecture: true,
    canEditPlatformConfig: false,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Normalize any admin role string to a valid AdminRole. Null/unknown values default to "super_admin" (backwards compat for pre-migration admins). */
export function normalizeAdminRole(role: string | null | undefined): AdminRole {
  if (role === "super_admin") return "super_admin";
  if (role === "admin") return "admin";
  // Legacy values (support, viewer) or null → default to super_admin
  return "super_admin";
}

/** Check if an admin role can see a specific nav item */
export function canSeeAdminNav(role: AdminRole, nav: AdminNavKey): boolean {
  const normalized = normalizeAdminRole(role);
  return ADMIN_ROLE_VISIBLE_NAV[normalized].includes(nav);
}

/** Get capabilities for an admin role */
export function getAdminCapabilities(role: AdminRole): AdminCapabilities {
  const normalized = normalizeAdminRole(role);
  return ADMIN_ROLE_CAPABILITIES[normalized];
}

/** Check if roleA outranks roleB (for role-change validation) */
const ADMIN_ROLE_RANK: Record<AdminRole, number> = {
  super_admin: 2,
  admin: 1,
};

export function adminRoleOutranks(a: AdminRole, b: AdminRole): boolean {
  return ADMIN_ROLE_RANK[a] > ADMIN_ROLE_RANK[b];
}

/** Validate that an actor can assign a target role */
export function canAssignAdminRole(actorRole: AdminRole, targetRole: AdminRole): boolean {
  // Only super_admin can assign any role (including promoting to admin)
  if (actorRole === "super_admin") return true;
  return false;
}

/** Roles ordered for display (highest first) */
export const ADMIN_ROLES_ORDERED: AdminRole[] = ["super_admin", "admin"];
