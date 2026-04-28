import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizePlan } from "../../../shared/plans";

type PlanKey = "starter" | "standard" | "plus" | "enterprise";

const PLAN_CONFIG: Record<PlanKey, { badgeKey: string; bg: string; text: string }> = {
  starter:    { badgeKey: "badge.starter",    bg: "bg-gray-100 dark:bg-gray-800",       text: "text-gray-600 dark:text-gray-300" },
  standard:   { badgeKey: "badge.standard",   bg: "bg-blue-50 dark:bg-blue-900/30",     text: "text-blue-700 dark:text-blue-300" },
  plus:       { badgeKey: "badge.plus",       bg: "bg-indigo-50 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300" },
  enterprise: { badgeKey: "badge.enterprise", bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
};

export function SubscriptionBadge() {
  const { t } = useTranslation("subscription");
  const [, setLocation] = useLocation();

  const company = trpc.companies.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const plan = normalizePlan(company.data?.plan as string);
  const config = PLAN_CONFIG[plan];

  return (
    <button
      onClick={() => setLocation("/subscription")}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-80 ${config.bg} ${config.text}`}
    >
      <span>{t(config.badgeKey)}</span>
      <ChevronRight className="h-3 w-3" />
    </button>
  );
}
