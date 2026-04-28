/**
 * ActionGuard — conditionally renders action buttons (create, edit, delete)
 * based on the current user's company role.
 *
 * Usage:
 *   <ActionGuard>
 *     <Button>Create Round</Button>
 *   </ActionGuard>
 *
 * Children are hidden for roles that cannot edit (viewer, lawyer, investor).
 * Optionally, pass `action="manage"` for team management actions (owner/admin only).
 */
import { useAuth } from "@/_core/hooks/useAuth";

type ActionType = "edit" | "manage" | "export" | "company";

export default function ActionGuard({
  action = "edit",
  children,
  fallback = null,
}: {
  action?: ActionType;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { canEdit, canManageTeam, canExport, canManageCompany } = useAuth();

  const allowed = (() => {
    switch (action) {
      case "edit":    return canEdit;
      case "manage":  return canManageTeam;
      case "export":  return canExport;
      case "company": return canManageCompany;
      default:        return false;
    }
  })();

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * useActionGuard — hook version for inline conditional rendering.
 *
 * Usage:
 *   const { canEdit, canManage } = useActionGuard();
 *   {canEdit && <Button>Edit</Button>}
 */
export function useActionGuard() {
  const auth = useAuth();
  return {
    canEdit: auth.canEdit,
    canManage: auth.canManageTeam,
    canExport: auth.canExport,
    canManageCompany: auth.canManageCompany,
    canTransferOwnership: auth.canTransferOwnership,
    companyRole: auth.companyRole,
  };
}
