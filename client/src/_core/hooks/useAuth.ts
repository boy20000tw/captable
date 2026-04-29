import { useUser, useClerk } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";
import {
  type CompanyRole,
  getCapabilities,
  canAccessPath,
  getDefaultPath,
} from "../../../../shared/rolePermissions";
import {
  type AdminRole,
  getAdminCapabilities,
  normalizeAdminRole,
} from "../../../../shared/adminPermissions";

export type { CompanyRole, AdminRole };

export function useAuth() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut, openSignIn } = useClerk();

  // Get our app's user data (with appRole etc.) from the DB
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: isSignedIn === true,
  });

  const logout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  // Derive companyRole from the server response
  const companyRole = (meQuery.data?.companyRole ?? null) as CompanyRole | null;

  const capabilities = useMemo(
    () => (companyRole ? getCapabilities(companyRole) : null),
    [companyRole]
  );

  // Admin role (only meaningful when user.role === 'admin')
  const rawAdminRole = meQuery.data?.adminRole ?? null;
  const adminRole = rawAdminRole ? normalizeAdminRole(rawAdminRole as string) : null;
  const adminCapabilities = useMemo(
    () => (adminRole ? getAdminCapabilities(adminRole) : null),
    [adminRole]
  );

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: !isLoaded || (isSignedIn && meQuery.isLoading),
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(isSignedIn && meQuery.data),
    clerkUser,
    // RBAC — company level
    companyRole,
    canEdit: capabilities?.canEdit ?? false,
    canManageTeam: capabilities?.canManageTeam ?? false,
    canTransferOwnership: capabilities?.canTransferOwnership ?? false,
    canExport: capabilities?.canExport ?? false,
    canManageCompany: capabilities?.canManageCompany ?? false,
    // RBAC — admin level
    adminRole,
    adminCapabilities,
  }), [isLoaded, isSignedIn, meQuery.data, meQuery.error, meQuery.isLoading, clerkUser, companyRole, capabilities, adminRole, adminCapabilities]);

  return {
    ...state,
    /** Check if the current role can access a specific path */
    canAccess: (path: string) => companyRole ? canAccessPath(companyRole, path) : false,
    /** Get the default landing page for the current role */
    defaultPath: companyRole ? getDefaultPath(companyRole) : "/",
    refresh: () => meQuery.refetch(),
    logout,
    signIn: openSignIn,
  };
}
