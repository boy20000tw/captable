import { useState } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  PieChart,
  TrendingUp,
  Users,
  Sparkles,
  BookOpen,
  Shield,
  FileText,
  MoreHorizontal,
} from "lucide-react";

// On mobile we only surface Overview / Ownership / Fundraising. The Analysis
// and System groups stay desktop-only — per SPEC-mobile-responsive §背景.

type TabItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
};

type TabSection = {
  section: string;
  items: TabItem[];
};

const mobileSections: TabSection[] = [
  {
    section: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: PieChart, label: "Cap Table", path: "/cap-table" },
    ],
  },
  {
    section: "Ownership",
    items: [
      { icon: BookOpen, label: "Register", path: "/register" },
      { icon: Sparkles, label: "ESOP", path: "/esop" },
    ],
  },
  {
    section: "Fundraising",
    items: [
      { icon: TrendingUp, label: "Rounds", path: "/funding-rounds" },
      { icon: Users, label: "Investors", path: "/investors" },
      { icon: Shield, label: "Anti-Dilution", path: "/anti-dilution" },
      { icon: FileText, label: "Instruments", path: "/instruments" },
    ],
  },
];

// Bottom-bar tabs — the 4 most-used destinations. Everything else lives in
// the "More" sheet.
const primaryTabs: TabItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: PieChart, label: "Cap Table", path: "/cap-table" },
  { icon: TrendingUp, label: "Rounds", path: "/funding-rounds" },
  { icon: Users, label: "Investors", path: "/investors" },
];

export default function MobileBottomNav() {
  const [location, setLocation] = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isInPrimary = primaryTabs.some((t) => t.path === location);

  return (
    <>
      {/* "More" bottom-sheet */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setShowMore(false)}
        >
          <div
            className="absolute bottom-16 left-0 right-0 bg-background border-t rounded-t-2xl shadow-xl p-4 space-y-3 safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {mobileSections.map((section) => {
              const visibleItems = section.items.filter(
                (item) => !primaryTabs.some((p) => p.path === item.path),
              );
              if (visibleItems.length === 0) return null;
              return (
                <div key={section.section}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-1.5">
                    {section.section}
                  </p>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.path;
                      return (
                        <button
                          key={item.path}
                          onClick={() => {
                            setLocation(item.path);
                            setShowMore(false);
                          }}
                          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground hover:bg-muted"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t safe-area-bottom"
        aria-label="Mobile primary navigation"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => {
                  setLocation(tab.path);
                  setShowMore(false);
                }}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`}
                />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => setShowMore((v) => !v)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${
              showMore || !isInPrimary ? "text-primary" : "text-muted-foreground"
            }`}
            aria-label="More"
          >
            <MoreHorizontal
              className={`h-5 w-5 ${showMore || !isInPrimary ? "stroke-[2.5]" : ""}`}
            />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
