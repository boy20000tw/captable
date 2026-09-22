import { authClient, useSession } from "@/lib/authClient";
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
  const { data: session, isPending, error: sessionError } = useSession();
  const isLoaded = !isPending;
  const isSignedIn = Boolean(session?.user);
  const authUser = session?.user
    ? { firstName: session.user.name?.split(" ")[0] ?? null, fullName: session.user.name ?? null, email: session.user.email, imageUrl: session.user.image ?? null }
    : null;

  // Get our app's user data (with appRole etc.) from the DB
  const meQuery = trpc.auth.me.useQuery(undefined, {
    // One quick retry covers a Neon cold start; anything more just makes the
    // user stare at a skeleton longer before they see the error screen.
    retry: 1,
    retryDelay: 1500,
    refetchOnWindowFocus: false,
    enabled: isSignedIn === true,
  });

  // Auth says we're signed in but our backend couldn't answer → the platform
  // is down/degraded, NOT "user isn't logged in". Callers must not render the
  // sign-in form in this state.
  // Also: the session endpoint itself failed (not "logged out" — that returns null).
  const serviceUnavailable = Boolean((isSignedIn && meQuery.isError) || (isLoaded && sessionError && (sessionError as any).status >= 500));

  const logout = useCallback(async () => {
    await authClient.signOut();
    window.location.assign("/");
  }, []);

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

  // Whether the user belongs to at least one company
  const hasCompany = Array.isArray((meQuery.data as any)?.companies) && (meQuery.data as any).companies.length > 0;

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: !isLoaded || (isSignedIn && meQuery.isLoading),
    error: meQuery.error ?? null,
    serviceUnavailable,
    isFetchingMe: meQuery.isFetching,
    isAuthenticated: Boolean(isSignedIn && meQuery.data),
    hasCompany,
    authUser,
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
  }), [isLoaded, isSignedIn, meQuery.data, meQuery.error, meQuery.isLoading, meQuery.isFetching, serviceUnavailable, authUser?.email, authUser?.fullName, hasCompany, companyRole, capabilities, adminRole, adminCapabilities]);

  return {
    ...state,
    /** Check if the current role can access a specific path */
    canAccess: (path: string) => companyRole ? canAccessPath(companyRole, path) : false,
    /** Get the default landing page for the current role */
    defaultPath: companyRole ? getDefaultPath(companyRole) : "/",
    refresh: () => meQuery.refetch(),
    logout,
    /** Send the user to the sign-in screen (the app root renders it when signed out). */
    signIn: (opts?: { redirectUrl?: string }) => {
      window.location.assign(opts?.redirectUrl ?? "/");
    },
  };
}
