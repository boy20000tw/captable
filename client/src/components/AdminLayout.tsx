/**
 * Admin Layout — platform-level admin panel with its own sidebar.
 * Completely separate from the company-scoped DashboardLayout.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { SignIn } from "@clerk/clerk-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  LogOut,
  Building2,
  ClipboardList,
  ArrowLeft,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { useLocation } from "wouter";

const adminNav = [
  { icon: LayoutDashboard, label: "Overview",        path: "/admin" },
  { icon: Building2,       label: "Companies",       path: "/admin/companies" },
  { icon: ClipboardList,   label: "Admin Activity",  path: "/admin/activity" },
  { icon: MessageSquare,   label: "Support Tickets", path: "/admin/tickets" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();

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
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {adminNav.map((item) => {
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
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Back to app + user */}
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to App</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left focus:outline-none">
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
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        {children}
      </main>
    </div>
  );
}
