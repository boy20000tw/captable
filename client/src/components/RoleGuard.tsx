/**
 * RoleGuard — wraps page content and redirects if the current role
 * does not have access to the current path.
 *
 * Usage: wrap the Router in App.tsx so every route is checked.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

// Public paths that don't require role checks (e.g. /join is pre-auth)
const PUBLIC_PATHS = ["/join", "/404", "/privacy", "/terms"];

export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, companyRole, canAccess, defaultPath } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Skip guard for public paths or unauthenticated users (handled by DashboardLayout)
    if (!isAuthenticated || !companyRole) return;
    if (PUBLIC_PATHS.some(p => location.startsWith(p))) return;
    // Admin routes are governed by platform role, not company role
    if (location.startsWith("/admin")) return;

    if (!canAccess(location)) {
      setLocation(defaultPath);
    }
  }, [isAuthenticated, companyRole, location, canAccess, defaultPath, setLocation]);

  return <>{children}</>;
}
