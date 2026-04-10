import { useUser, useClerk } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

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

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: !isLoaded || (isSignedIn && meQuery.isLoading),
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(isSignedIn && meQuery.data),
    clerkUser,
  }), [isLoaded, isSignedIn, meQuery.data, meQuery.error, meQuery.isLoading, clerkUser]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
    signIn: openSignIn,
  };
}
