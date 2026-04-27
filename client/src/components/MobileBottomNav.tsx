import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  Rocket,
  PenLine,
  Droplets,
  Calculator,
  UserCheck,
  Settings,
  UserCog,
  Upload,
  Camera,
  ClipboardList,
  BarChart3,
} from "lucide-react";

type TabItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
};

type TabSection = {
  section: string;
  items: TabItem[];
};

export default function MobileBottomNav() {
  const [location, setLocation] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { t } = useTranslation("nav");

  const mobileSections: TabSection[] = useMemo(() => [
    {
      section: t("equity"),
      items: [
        { icon: PieChart,  label: t("equity.capTable"),   path: "/cap-table" },
        { icon: BookOpen,  label: t("equity.register"),   path: "/register" },
        { icon: Sparkles,  label: t("equity.esop"),       path: "/esop" },
        { icon: PenLine,   label: t("equity.esign"),      path: "/esign" },
      ],
    },
    {
      section: t("fundraising"),
      items: [
        { icon: Rocket,    label: t("fundraising.rounds"),      path: "/funding-rounds" },
        { icon: Users,     label: t("fundraising.investors"),   path: "/investors" },
        { icon: FileText,  label: t("fundraising.instruments"), path: "/instruments" },
      ],
    },
    {
      section: t("analysis"),
      items: [
        { icon: Droplets,   label: t("analysis.waterfall"),    path: "/waterfall" },
        { icon: Calculator, label: t("analysis.valuation"),    path: "/valuation" },
        { icon: TrendingUp, label: t("analysis.projections"),  path: "/projections" },
        { icon: Shield,     label: t("analysis.antiDilution"), path: "/anti-dilution" },
      ],
    },
    {
      section: t("settings"),
      items: [
        { icon: UserCheck,     label: t("investorPortal"),     path: "/investor-portal" },
        { icon: Settings,      label: t("settings.company"),   path: "/settings" },
        { icon: UserCog,       label: t("settings.team"),      path: "/team" },
        { icon: Upload,        label: t("settings.import"),    path: "/import" },
        { icon: Camera,        label: t("settings.snapshots"), path: "/snapshots" },
        { icon: ClipboardList, label: t("settings.auditLog"),  path: "/audit-log" },
      ],
    },
  ], [t]);

  const primaryTabs: TabItem[] = useMemo(() => [
    { icon: LayoutDashboard, label: t("dashboard"),         path: "/" },
    { icon: PieChart,        label: t("equity.capTable"),   path: "/cap-table" },
    { icon: Rocket,          label: t("fundraising.rounds"), path: "/funding-rounds" },
    { icon: BarChart3,       label: t("analysis"),          path: "/waterfall" },
  ], [t]);

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
            aria-label={t("more")}
          >
            <MoreHorizontal
              className={`h-5 w-5 ${showMore || !isInPrimary ? "stroke-[2.5]" : ""}`}
            />
            <span className="text-[10px] font-medium">{t("more")}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
