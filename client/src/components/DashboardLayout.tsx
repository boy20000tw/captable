import { useAuth } from "@/_core/hooks/useAuth";
import { SignIn } from "@clerk/clerk-react";
import { CompanySwitcher } from "./CompanySwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Users,
  TrendingUp,
  PieChart,
  Upload,
  Sparkles,
  BookOpen,
  Camera,
  Shield,
  Droplets,
  UserCog,
  ClipboardList,
  Calculator,
  Rocket,
  Wrench,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Separator } from "./ui/separator";

const menuGroups = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    ],
  },
  {
    label: "Ownership",
    items: [
      { icon: PieChart,  label: "Cap Table",      path: "/cap-table" },
      { icon: BookOpen,  label: "Share Register", path: "/register" },
      { icon: Sparkles,  label: "ESOP",           path: "/esop" },
    ],
  },
  {
    label: "Fundraising",
    items: [
      { icon: Rocket,    label: "Funding Rounds", path: "/funding-rounds" },
      { icon: Users,     label: "Investors",      path: "/investors" },
      { icon: Shield,    label: "Anti-Dilution",  path: "/anti-dilution" },
      { icon: Wrench,    label: "Instruments",    path: "/instruments" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { icon: Calculator, label: "Scenario Modeling", path: "/valuation" },
      { icon: TrendingUp, label: "Projections & DCF",             path: "/projections" },
      { icon: Droplets,   label: "Waterfall",                     path: "/waterfall" },
    ],
  },
  {
    label: "System",
    items: [
      { icon: Camera,        label: "Snapshots",         path: "/snapshots" },
      { icon: ClipboardList, label: "Audit Log",         path: "/audit-log" },
      { icon: Upload,        label: "Import & Analysis", path: "/import" },
      { icon: UserCog,       label: "Team",              path: "/team" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: "var(--background)" }}
      >
        <div className="flex flex-col items-center gap-10 p-12 max-w-md w-full">
          {/* Logo / Title */}
          <div className="flex flex-col items-center gap-4 text-center">
            <img
              src="/caploom-logo.png"
              alt="Caploom"
              className="h-12 w-auto object-contain"
            />
            <div className="flex flex-col items-center gap-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Cap Table Manager
              </h1>
              <div className="w-8 h-0.5 rounded-full" style={{ background: "var(--primary)" }} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center leading-relaxed max-w-xs">
            A precision instrument for equity management. Sign in to access your cap table.
          </p>
          <SignIn routing="hash" />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const allItems = menuGroups.flatMap(g => g.items);
  const activeMenuItem = allItems.find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* Sidebar Header */}
          <SidebarHeader className="border-b border-sidebar-border">
            <div className="h-16 flex items-center gap-2 px-3 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <img
                    src="/caploom-logo.png"
                    alt="Caploom"
                    className="h-7 w-auto object-contain"
                  />
                </div>
              )}
              {isCollapsed && (
                <img
                  src="/caploom-logo.png"
                  alt="Caploom"
                  className="h-6 w-auto object-contain"
                />
              )}
            </div>
            {/* Company Switcher */}
            <div className={`${isCollapsed ? "px-2 pb-2 flex justify-center" : "px-2 pb-2"}`}>
              <CompanySwitcher collapsed={isCollapsed} />
            </div>
          </SidebarHeader>

          {/* Sidebar Navigation */}
          <SidebarContent className="gap-0 py-4">
            {menuGroups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && !isCollapsed && (
                  <div className="mx-3 my-2">
                    <Separator className="bg-sidebar-border" />
                  </div>
                )}
                {!isCollapsed && (
                  <p
                    className="px-4 py-1.5 text-[9px] font-600 tracking-[0.18em] uppercase text-sidebar-foreground/40"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    {group.label}
                  </p>
                )}
                <SidebarMenu className="px-2">
                  {group.items.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-9 transition-all text-sm ${
                            isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>

          {/* Sidebar Footer */}
          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 border border-sidebar-border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-sidebar-accent text-sidebar-accent-foreground">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-sidebar-foreground leading-none">
                        {user?.name || "User"}
                      </p>
                      <p className="text-[10px] text-sidebar-foreground/50 truncate mt-1">
                        {user?.email || ""}
                      </p>
                    </div>
                  )}
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
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-sidebar-primary/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded" />
              <span className="text-sm font-medium tracking-tight">
                {activeMenuItem?.label ?? "Cap Table Manager"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
