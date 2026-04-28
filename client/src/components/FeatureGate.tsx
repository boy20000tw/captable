import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { planHasFeature, minimumPlanFor, normalizePlan, type Feature, type PlanKey } from "../../../shared/plans";

const PLAN_LABELS: Record<PlanKey, string> = {
  starter: "badge.starter",
  standard: "badge.standard",
  plus: "badge.plus",
  enterprise: "badge.enterprise",
};

type FeatureGateProps = {
  feature: Feature;
  children: React.ReactNode;
};

/**
 * Wraps page content and shows an upgrade overlay if the company's plan
 * doesn't include the required feature. The underlying content is rendered
 * but blurred, giving users a preview of what they'd get on upgrade.
 */
export function FeatureGate({ feature, children }: FeatureGateProps) {
  const { t } = useTranslation("subscription");
  const [, setLocation] = useLocation();

  const company = trpc.companies.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const plan = normalizePlan(company.data?.plan as string);
  const hasAccess = planHasFeature(plan, feature);

  if (hasAccess || company.isLoading) {
    return <>{children}</>;
  }

  const requiredPlan = minimumPlanFor(feature);
  const requiredLabel = t(PLAN_LABELS[requiredPlan]);

  return (
    <div className="relative">
      {/* Blurred content preview */}
      <div className="pointer-events-none select-none blur-[2px] opacity-60">
        {children}
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 flex items-start justify-center pt-24 z-10">
        <div className="flex flex-col items-center gap-4 rounded-xl border bg-background/95 backdrop-blur px-8 py-6 shadow-sm max-w-sm text-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold mb-1">{t("gate.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("gate.description", { plan: requiredLabel })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation("/compare-plans")}>
              {t("gate.comparePlans")}
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLocation("/pricing")}>
              {t("gate.upgrade")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
