import { useAuth } from "@/_core/hooks/useAuth";
import { SignIn } from "@clerk/clerk-react";
import { CompanySwitcher } from "./CompanySwitcher";
import { VersionBadge } from "./ChangelogDrawer";
import { SubscriptionBadge } from "./SubscriptionBadge";
import MobileBottomNav from "./MobileBottomNav";
import NotificationBell from "./NotificationBell";
import LanguageToggle from "./LanguageToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
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
  FileText,
  PenLine,
  Settings,
  UserCheck,
  ChevronRight,
  BarChart3,
  Scale,
  DollarSign,
  FileCheck,
  ShieldCheck,
  ArrowRightLeft,
  Search,
  X,
  Receipt,
  Landmark,
  HelpCircle,
} from "lucide-react";
import React, { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

type NavItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  section?: string;  // optional section header shown above this item
};

type NavGroup =
  | { type: "single"; icon: typeof LayoutDashboard; label: string; path: string }
  | { type: "group"; icon: typeof LayoutDashboard; label: string; items: NavItem[] };

function buildNavStructure(t: TFunction<"nav">): NavGroup[] {
  return [
    {
      type: "single",
      icon: LayoutDashboard,
      label: t("dashboard"),
      path: "/",
    },
    {
      type: "group",
      icon: PieChart,
      label: t("equity"),
      items: [
        { icon: PieChart,  label: t("equity.capTable"),   path: "/cap-table" },
        { icon: BookOpen,  label: t("equity.register"),   path: "/register" },
        { icon: Sparkles,  label: t("equity.esop"),       path: "/esop" },
        { icon: PenLine,   label: t("equity.esign"),      path: "/esign" },
      ],
    },
    {
      type: "group",
      icon: Rocket,
      label: t("fundraising"),
      items: [
        { icon: Rocket,    label: t("fundraising.rounds"),      path: "/funding-rounds" },
        { icon: Users,     label: t("fundraising.investors"),   path: "/investors" },
        { icon: FileText,  label: t("fundraising.instruments"), path: "/instruments" },
      ],
    },
    {
      type: "group",
      icon: BarChart3,
      label: t("analysis"),
      items: [
        { icon: Droplets,   label: t("analysis.waterfall"),      path: "/waterfall" },
        { icon: Calculator, label: t("analysis.valuation"),      path: "/valuation" },
        { icon: TrendingUp, label: t("analysis.projections"),    path: "/projections" },
        { icon: Shield,     label: t("analysis.antiDilution"),   path: "/anti-dilution" },
      ],
    },
    {
      type: "single",
      icon: UserCheck,
      label: t("investorPortal"),
      path: "/investor-portal",
    },
    {
      type: "group",
      icon: Scale,
      label: t("compliance"),
      items: [
        { icon: Receipt,         label: t("compliance.tw.techShare"),     path: "/tech-share-tax",  section: t("compliance.tw") },
        { icon: Landmark,        label: t("compliance.tw.closedCompany"), path: "/closed-company" },
        { icon: DollarSign,      label: t("compliance.us.409a"),          path: "/409a",            section: t("compliance.us") },
        { icon: FileCheck,       label: t("compliance.us.83b"),           path: "/83b" },
        { icon: ArrowRightLeft,  label: t("compliance.us.transfers"),     path: "/transfers" },
      ],
    },
    {
      type: "group",
      icon: Settings,
      label: t("settings"),
      items: [
        { icon: Settings,       label: t("settings.company"),   path: "/settings" },
        { icon: UserCog,        label: t("settings.team"),      path: "/team" },
        { icon: Upload,         label: t("settings.import"),    path: "/import" },
        { icon: Camera,         label: t("settings.snapshots"), path: "/snapshots" },
        { icon: ClipboardList,  label: t("settings.auditLog"),  path: "/audit-log" },
      ],
    },
  ];
}

/** Helper: check if current location is inside a group */
function isGroupActive(group: NavGroup, loc: string): boolean {
  if (group.type === "single") return group.path === loc;
  return group.items.some(i => i.path === loc);
}

/** Find the active label for mobile header */
function getActiveLabel(nav: NavGroup[], loc: string): string {
  for (const g of nav) {
    if (g.type === "single" && g.path === loc) return g.label;
    if (g.type === "group") {
      const item = g.items.find(i => i.path === loc);
      if (item) return item.label;
    }
  }
  return "";
}

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
  const [menuFilter, setMenuFilter] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation("nav");

  // Build nav structure from i18n translations (re-builds on language change)
  const navStructure = useMemo(() => buildNavStructure(t), [t]);

  // Filter nav items by search query
  const filteredNav = useMemo(() => {
    const q = menuFilter.trim().toLowerCase();
    if (!q) return navStructure;
    return navStructure
      .map((nav) => {
        if (nav.type === "single") {
          return nav.label.toLowerCase().includes(q) ? nav : null;
        }
        // Group: filter items, keep group if any match or group label matches
        if (nav.label.toLowerCase().includes(q)) return nav;
        const matchedItems = nav.items.filter(
          (item) => item.label.toLowerCase().includes(q)
        );
        if (matchedItems.length === 0) return null;
        return { ...nav, items: matchedItems };
      })
      .filter(Boolean) as NavGroup[];
  }, [menuFilter, navStructure]);

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
      {/* Desktop sidebar — hidden on mobile; bottom nav takes over there. */}
      {!isMobile && (
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* Sidebar Header */}
          <SidebarHeader className="border-b border-sidebar-border">
            {/* Row 1: CompanySwitcher (left, with user avatar) + Toggle (right) */}
            <div className={`h-16 flex items-center gap-2 w-full ${isCollapsed ? "px-2 flex-col justify-center" : "px-3"}`}>
              {isCollapsed ? (
                <>
                  <CompanySwitcher collapsed={isCollapsed} user={user} onSignOut={logout} />
                  <button
                    onClick={toggleSidebar}
                    className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded transition-colors focus:outline-none shrink-0"
                    aria-label="Toggle navigation"
                  >
                    <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <CompanySwitcher collapsed={isCollapsed} user={user} onSignOut={logout} />
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded transition-colors focus:outline-none shrink-0"
                    aria-label="Toggle navigation"
                  >
                    <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
                  </button>
                </>
              )}
            </div>
            {/* Row 2: Search toggle */}
            {isCollapsed ? (
              <div className="flex justify-center pb-2">
                <button
                  onClick={toggleSidebar}
                  className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded transition-colors focus:outline-none"
                  aria-label={t("searchPlaceholder")}
                  title={t("searchPlaceholder")}
                >
                  <Search className="h-4 w-4 text-sidebar-foreground/60" />
                </button>
              </div>
            ) : (
              <div className="px-3 pb-2">
                {searchOpen ? (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder={t("searchPlaceholder")}
                      value={menuFilter}
                      onChange={(e) => setMenuFilter(e.target.value)}
                      onBlur={() => { if (!menuFilter) setSearchOpen(false); }}
                      onKeyDown={(e) => { if (e.key === "Escape") { setMenuFilter(""); setSearchOpen(false); } }}
                      className="w-full h-8 pl-8 pr-7 text-xs rounded-md border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-sidebar-primary/30 transition-colors"
                    />
                    {menuFilter && (
                      <button
                        onClick={() => { setMenuFilter(""); setSearchOpen(false); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-sidebar-foreground transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSearchOpen(true);
                      setTimeout(() => searchInputRef.current?.focus(), 0);
                    }}
                    className="flex items-center gap-2 h-8 px-2.5 text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground/60 rounded-md hover:bg-sidebar-accent/40 transition-colors w-full"
                  >
                    <Search className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("searchPlaceholder")}</span>
                  </button>
                )}
              </div>
            )}
          </SidebarHeader>

          {/* Sidebar Navigation — collapsible groups */}
          <SidebarContent className="gap-0 py-2">
            <SidebarMenu className="px-2 gap-0.5">
              {filteredNav.map((nav) => {
                if (nav.type === "single") {
                  const isActive = location === nav.path;
                  return (
                    <SidebarMenuItem key={nav.label}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(nav.path)}
                        tooltip={nav.label}
                        className={`h-9 transition-all text-sm ${
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}
                      >
                        <nav.icon className="h-4 w-4 shrink-0" />
                        <span>{nav.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // Collapsible group
                const groupActive = isGroupActive(nav, location);
                return (
                  <Collapsible
                    key={nav.label}
                    asChild
                    defaultOpen={groupActive}
                    open={menuFilter ? true : undefined}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={nav.label}
                          className={`h-9 transition-all text-sm ${
                            groupActive
                              ? "text-sidebar-foreground font-medium"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                          }`}
                        >
                          <nav.icon className="h-4 w-4 shrink-0" />
                          <span>{nav.label}</span>
                          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {nav.items.map((item) => {
                            const isActive = location === item.path;
                            return (
                              <React.Fragment key={item.path}>
                                {item.section && (
                                  <li className="px-3 pt-2 pb-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                                      {item.section}
                                    </span>
                                  </li>
                                )}
                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton
                                    onClick={() => setLocation(item.path)}
                                    isActive={isActive}
                                    className={`cursor-pointer transition-colors ${
                                      isActive
                                        ? "bg-sidebar-primary/10 text-sidebar-primary font-medium"
                                        : ""
                                    }`}
                                  >
                                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                                    <span>{item.label}</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              </React.Fragment>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* Sidebar Footer — only VersionBadge */}
          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <VersionBadge collapsed={isCollapsed} />
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-sidebar-primary/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>
      )}

      <SidebarInset>
        {/* Desktop content header — Caploom logo + Admin/Language/Bell/Signout */}
        {!isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <img
                src="/caploom-logo.png"
                alt="Caploom"
                className="h-7 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-2">
              <SubscriptionBadge />
              {user?.role === "admin" && (
                <button
                  onClick={() => setLocation("/admin")}
                  className="flex items-center gap-2 rounded-md text-xs transition-colors px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>Admin Panel</span>
                </button>
              )}
              <LanguageToggle />
              <button
                onClick={() => setLocation("/help")}
                className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Help"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              <NotificationBell />
            </div>
          </div>
        )}
        {/* Mobile header */}
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <img
                src="/caploom-logo.png"
                alt="Caploom"
                className="h-6 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium tracking-tight truncate">
                {getActiveLabel(navStructure, location)}
              </span>
              <LanguageToggle collapsed />
              <NotificationBell />
            </div>
          </div>
        )}
        <main className={`flex-1 min-h-screen ${isMobile ? "pb-20" : ""}`}>
          {children}
        </main>
        {isMobile && <MobileBottomNav />}
      </SidebarInset>
    </>
  );
}
