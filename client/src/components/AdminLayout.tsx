/**
 * Admin Layout — platform-level admin panel with its own sidebar.
 * Completely separate from the company-scoped DashboardLayout.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { SignIn } from "@clerk/clerk-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard, LogOut, Building2, ClipboardList,
  ArrowLeft, ShieldCheck, MessageSquare, Tag,
  Lock, CreditCard, Users,
} from "lucide-react";
import { useLocation } from "wouter";
import LanguageToggle from "./LanguageToggle";
import { type AdminNavKey, canSeeAdminNav, normalizeAdminRole } from "../../../shared/adminPermissions";

type NavItem = { icon: typeof LayoutDashboard; labelKey: string; path: string; navKey: AdminNavKey };
type NavGroup = { labelKey: string; items: NavItem[] };

const adminNavGroups: NavGroup[] = [
  {
    labelKey: "nav.general",
    items: [
      { icon: LayoutDashboard, labelKey: "nav.overview",   path: "/admin",            navKey: "overview" },
    ],
  },
  {
    labelKey: "nav.management",
    items: [
      { icon: Building2,      labelKey: "nav.companies",   path: "/admin/companies",  navKey: "companies" },
      { icon: MessageSquare,   labelKey: "nav.tickets",     path: "/admin/tickets",    navKey: "tickets" },
      { icon: Users,           labelKey: "nav.team",        path: "/admin/team",       navKey: "team" },
    ],
  },
  {
    labelKey: "nav.logs",
    items: [
      { icon: ClipboardList,   labelKey: "nav.activity",    path: "/admin/activity",   navKey: "activity" },
      { icon: Tag,             labelKey: "nav.versions",    path: "/admin/versions",   navKey: "versions" },
    ],
  },
  {
    labelKey: "nav.architecture",
    items: [
      { icon: Lock,           labelKey: "nav.security",    path: "/admin/security",   navKey: "security" },
      { icon: CreditCard,     labelKey: "nav.payment",     path: "/admin/payment",    navKey: "payment" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout, adminRole } = useAuth();
  const { t } = useTranslation("admin");
  const [location, setLocation] = useLocation();

  // Filter nav groups by admin role
  // Default to super_admin for existing admins who don't have adminRole set yet (pre-migration)
  const effectiveAdminRole = normalizeAdminRole(adminRole);
  const filteredNavGroups = adminNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSeeAdminNav(effectiveAdminRole, item.navKey)),
    }))
    .filter((group) => group.items.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--background)" }}>
        <div className="flex flex-col items-center gap-10 p-12 max-w-md w-full">
          <div className="flex flex-col items-center gap-4 text-center">
            <ShieldCheck className="h-12 w-12 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Panel</h1>
          </div>
          <SignIn routing="hash" />
        </div>
      </div>
    );
  }

  // Check admin role
  if (user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--background)" }}>
        <div className="text-center py-20 max-w-md">
          <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            Your account does not have admin privileges. Contact the platform administrator.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="mt-6 text-sm text-primary hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Admin Sidebar */}
      <aside className="w-56 border-r bg-sidebar flex flex-col shrink-0">
        {/* Header */}
        <div className="h-16 flex items-center gap-2 px-4 border-b border-sidebar-border">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm tracking-tight">Admin Panel</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-3 overflow-y-auto">
          {filteredNavGroups.map((group) => (
            <div key={group.labelKey}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {t(group.labelKey)}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => setLocation(item.path)}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{t(item.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-1">
            <Avatar className="h-7 w-7 border border-sidebar-border shrink-0">
              <AvatarFallback className="text-xs font-medium bg-sidebar-accent text-sidebar-accent-foreground">
                {user?.name?.charAt(0).toUpperCase() || "A"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-sidebar-foreground leading-none">
                {user?.name || "Admin"}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate mt-0.5">
                {user?.email || ""}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Right side: header + content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Admin Header Bar */}
        <header className="h-14 border-b bg-background flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold tracking-tight text-foreground">Caploom Admin</span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/")}
                  className="gap-1.5 text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{t("header.backToApp")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("header.backToAppTip")}</TooltipContent>
            </Tooltip>

            <LanguageToggle collapsed />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("header.signOut")}</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
