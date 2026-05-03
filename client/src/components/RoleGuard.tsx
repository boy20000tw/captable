/**
 * RoleGuard — wraps page content and redirects if the current role
 * does not have access to the current path.
 *
 * Also enforces company existence: authenticated users without a company
 * can only access "/" (where the onboarding wizard lives) and public paths.
 *
 * Usage: wrap the Router in App.tsx so every route is checked.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

// Paths that don't require auth or company context
const PUBLIC_PATHS = ["/join", "/404", "/privacy", "/terms", "/help", "/pricing", "/compare-plans"];

export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasCompany, companyRole, canAccess, defaultPath, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;
    // Unauthenticated users handled by DashboardLayout / Clerk
    if (!isAuthenticated) return;
    // Public paths always allowed
    if (PUBLIC_PATHS.some(p => location.startsWith(p))) return;
    // Admin routes governed by platform role, not company role
    if (location.startsWith("/admin")) return;
    // Home ("/") always allowed — onboarding wizard lives here
    if (location === "/") return;

    // No company → redirect to home (onboarding wizard)
    if (!hasCompany) {
      setLocation("/");
      return;
    }

    // Has company but no role yet (loading race) → wait
    if (!companyRole) return;

    // Role-based path check
    if (!canAccess(location)) {
      setLocation(defaultPath);
    }
  }, [isAuthenticated, hasCompany, companyRole, location, canAccess, defaultPath, setLocation, loading]);

  return <>{children}</>;
}
