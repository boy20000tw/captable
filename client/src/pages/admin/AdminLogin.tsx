import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { SignIn, useUser, useClerk } from "@clerk/clerk-react";
import { Shield, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

/**
 * Standalone Admin Login page — /admin/login
 *
 * Uses Clerk for Google OAuth authentication, then checks if the
 * authenticated user is a platform admin (role='admin' in users table).
 * If not admin → shows error and signs out.
 * If admin → redirects to /admin.
 *
 * This page does NOT use DashboardLayout — it's a completely independent entry point.
 */
export default function AdminLogin() {
  const { t } = useTranslation("admin");
  const { t: tLegal } = useTranslation("legal");
  const [, setLocation] = useLocation();
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [denied, setDenied] = useState(false);

  // Once Clerk is signed in, call auth.me to check admin status
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: isSignedIn === true,
  });

  useEffect(() => {
    if (!meQuery.data) return;

    if (meQuery.data.role === "admin") {
      // Admin confirmed — redirect to admin panel
      setLocation("/admin");
    } else {
      // Not an admin — deny access
      setDenied(true);
    }
  }, [meQuery.data, setLocation]);

  const handleSignOut = async () => {
    setDenied(false);
    await signOut();
  };

  // State: checking admin status after Clerk auth
  if (isSignedIn && !denied && !meQuery.data) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--background)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">{t("login.verifying")}</p>
        </div>
      </div>
    );
  }

  // State: access denied
  if (denied) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--background)" }}>
        <div className="flex flex-col items-center gap-6 p-12 max-w-md w-full text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">{t("login.denied")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("login.deniedDescription", { email: clerkUser?.primaryEmailAddress?.emailAddress ?? "" })}
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            {t("login.tryAnother")}
          </Button>
        </div>
      </div>
    );
  }

  // State: show Clerk sign-in
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--background)" }}>
      <div className="flex flex-col items-center gap-10 p-12 max-w-md w-full">
        {/* Admin branding */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("login.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
            <div className="w-8 h-0.5 rounded-full mt-2" style={{ background: "var(--primary)" }} />
          </div>
        </div>

        <SignIn routing="hash" />

        {/* Legal footer */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <a href="/privacy" className="hover:text-foreground transition-colors">{tLegal("footer.privacy")}</a>
          <span>·</span>
          <a href="/terms" className="hover:text-foreground transition-colors">{tLegal("footer.terms")}</a>
          <span>·</span>
          <span>{tLegal("footer.copyright", { year: new Date().getFullYear() })}</span>
        </div>
      </div>
    </div>
  );
}
