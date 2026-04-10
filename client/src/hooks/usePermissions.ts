import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo } from "react";

/**
 * Role hierarchy (highest to lowest):
 *   owner > admin > cfo > lawyer > investor > viewer
 *
 * Permission matrix:
 * ┌────────────┬───────┬───────┬─────┬────────┬──────────┬────────┐
 * │ Action     │ owner │ admin │ cfo │ lawyer │ investor │ viewer │
 * ├────────────┼───────┼───────┼─────┼────────┼──────────┼────────┤
 * │ canRead    │  ✓    │  ✓    │  ✓  │   ✓    │    ✓     │   ✓    │
 * │ canEdit    │  ✓    │  ✓    │  ✓  │   ✗    │    ✗     │   ✗    │
 * │ canDelete  │  ✓    │  ✓    │  ✗  │   ✗    │    ✗     │   ✗    │
 * │ canImport  │  ✓    │  ✓    │  ✓  │   ✗    │    ✗     │   ✗    │
 * │ canExport  │  ✓    │  ✓    │  ✓  │   ✓    │    ✓     │   ✓    │
 * │ canManageTeam│ ✓   │  ✓    │  ✗  │   ✗    │    ✗     │   ✗    │
 * │ canInvite  │  ✓    │  ✓    │  ✗  │   ✗    │    ✗     │   ✗    │
 * │ canSnapshot│  ✓    │  ✓    │  ✓  │   ✗    │    ✗     │   ✗    │
 * │ canViewAudit│ ✓    │  ✓    │  ✓  │   ✓    │    ✗     │   ✗    │
 * └────────────┴───────┴───────┴─────┴────────┴──────────┴────────┘
 */

type AppRole = "owner" | "admin" | "cfo" | "lawyer" | "investor" | "viewer";

export interface Permissions {
  /** Current user's app role */
  role: AppRole | null;
  /** Can read all data (all roles) */
  canRead: boolean;
  /** Can create/update records (owner, admin, cfo) */
  canEdit: boolean;
  /** Can delete records (owner, admin) */
  canDelete: boolean;
  /** Can import data from Excel (owner, admin, cfo) */
  canImport: boolean;
  /** Can export data (all roles) */
  canExport: boolean;
  /** Can manage team members and roles (owner, admin) */
  canManageTeam: boolean;
  /** Can send invitations (owner, admin) */
  canInvite: boolean;
  /** Can create/manage snapshots (owner, admin, cfo) */
  canSnapshot: boolean;
  /** Can view audit log (owner, admin, cfo, lawyer) */
  canViewAudit: boolean;
  /** User is authenticated */
  isAuthenticated: boolean;
  /** User is loading */
  isLoading: boolean;
}

const ROLE_HIERARCHY: Record<AppRole, number> = {
  owner: 6,
  admin: 5,
  cfo: 4,
  lawyer: 3,
  investor: 2,
  viewer: 1,
};

function hasRole(userRole: AppRole | null | undefined, minRole: AppRole): boolean {
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole] ?? 0) >= ROLE_HIERARCHY[minRole];
}

export function usePermissions(): Permissions {
  const { user, loading, isAuthenticated } = useAuth();

  return useMemo(() => {
    // appRole from the user object (Phase 6 field); fall back to "viewer" if not set
    const role = (user as (typeof user & { appRole?: AppRole }) | null)?.appRole ?? null;

    return {
      role,
      canRead: isAuthenticated,
      canEdit: hasRole(role, "cfo"),
      canDelete: hasRole(role, "admin"),
      canImport: hasRole(role, "cfo"),
      canExport: isAuthenticated,
      canManageTeam: hasRole(role, "admin"),
      canInvite: hasRole(role, "admin"),
      canSnapshot: hasRole(role, "cfo"),
      canViewAudit: hasRole(role, "lawyer"),
      isAuthenticated,
      isLoading: loading,
    };
  }, [user, loading, isAuthenticated]);
}

/**
 * Returns a human-readable label and color for a given appRole.
 */
export function getRoleMeta(role: AppRole | null): { label: string; color: string } {
  switch (role) {
    case "owner":    return { label: "Owner",    color: "bg-amber-100 text-amber-800" };
    case "admin":    return { label: "Admin",    color: "bg-purple-100 text-purple-800" };
    case "cfo":      return { label: "CFO",      color: "bg-blue-100 text-blue-800" };
    case "lawyer":   return { label: "Lawyer",   color: "bg-green-100 text-green-800" };
    case "investor": return { label: "Investor", color: "bg-orange-100 text-orange-800" };
    case "viewer":   return { label: "Viewer",   color: "bg-gray-100 text-gray-600" };
    default:         return { label: "Unknown",  color: "bg-gray-100 text-gray-400" };
  }
}
