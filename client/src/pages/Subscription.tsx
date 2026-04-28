import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { normalizePlan } from "../../../shared/plans";

type PlanKey = "starter" | "standard" | "plus" | "enterprise";

const PLAN_DISPLAY: Record<PlanKey, { badgeKey: string; descKey: string; badgeCls: string }> = {
  starter:    { badgeKey: "badge.starter",    descKey: "starterDescription",    badgeCls: "bg-gray-100 text-gray-600 hover:bg-gray-100 border-transparent" },
  standard:   { badgeKey: "badge.standard",   descKey: "standardDescription",   badgeCls: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-transparent" },
  plus:       { badgeKey: "badge.plus",       descKey: "plusDescription",       badgeCls: "bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-transparent" },
  enterprise: { badgeKey: "badge.enterprise", descKey: "enterpriseDescription", badgeCls: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-transparent" },
};

const PLAN_LIMITS: Record<PlanKey, { companies: number; shareholders: number; esop: number; esignTemplates: number }> = {
  starter:    { companies: 1,   shareholders: 5,   esop: 5,    esignTemplates: 0 },
  standard:   { companies: 1,   shareholders: 15,  esop: 999,  esignTemplates: 3 },
  plus:       { companies: 3,   shareholders: 999, esop: 999,  esignTemplates: 999 },
  enterprise: { companies: 999, shareholders: 999, esop: 999,  esignTemplates: 999 },
};

export default function SubscriptionPage() {
  const { t } = useTranslation("subscription");
  const [, setLocation] = useLocation();

  const company = trpc.companies.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const plan = normalizePlan(company.data?.plan as string);
  const config = PLAN_DISPLAY[plan];
  const limits = PLAN_LIMITS[plan];

  // Mock usage data — in production these would come from the API
  const usage = {
    companies: 1,
    shareholders: 4,
    esop: 2,
    esignTemplates: 0,
  };

  function usagePct(used: number, limit: number) {
    if (limit === 0) return 0;
    if (limit >= 999) return Math.min((used / 50) * 100, 100); // scale for display
    return Math.min((used / limit) * 100, 100);
  }

  function limitLabel(used: number, limit: number) {
    if (limit === 0) return `${used} / 0`;
    if (limit >= 999) return `${used} / ${t("usage.unlimited")}`;
    return `${used} / ${limit}`;
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        {/* Current Plan */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  {t("currentPlan")}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{t(config.badgeKey)}</span>
                  <Badge className={config.badgeCls}>{t("active")}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setLocation("/compare-plans")}>
                  <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                  {t("viewComparison")}
                </Button>
                <Button onClick={() => setLocation("/pricing")}>
                  {t("changePlan")}
                </Button>
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-sm text-muted-foreground">{t(config.descKey)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Usage */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("usage")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Companies */}
            <UsageMeter
              label={t("usage.companies")}
              used={usage.companies}
              limit={limits.companies}
              limitLabel={limitLabel(usage.companies, limits.companies)}
              pct={usagePct(usage.companies, limits.companies)}
              color={usage.companies >= limits.companies && limits.companies < 999 ? "warning" : "default"}
            />
            {/* Shareholders */}
            <UsageMeter
              label={t("usage.shareholders")}
              used={usage.shareholders}
              limit={limits.shareholders}
              limitLabel={limitLabel(usage.shareholders, limits.shareholders)}
              pct={usagePct(usage.shareholders, limits.shareholders)}
              color="default"
            />
            {/* ESOP */}
            <UsageMeter
              label={t("usage.esopGrants")}
              used={usage.esop}
              limit={limits.esop}
              limitLabel={limitLabel(usage.esop, limits.esop)}
              pct={usagePct(usage.esop, limits.esop)}
              color="default"
            />
            {/* eSign Templates */}
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-sm">{t("usage.esignTemplates")}</span>
                <span className="text-sm text-muted-foreground">{limitLabel(usage.esignTemplates, limits.esignTemplates)}</span>
              </div>
              <Progress value={usagePct(usage.esignTemplates, limits.esignTemplates)} className="h-1.5" />
              {limits.esignTemplates === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">{t("usage.standardOnly")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("billing")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">{t("billing.nextInvoice")}</p>
                <p className="text-lg font-semibold">$0.00</p>
                <p className="text-[11px] text-muted-foreground">{t("billing.noCharge")}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">{t("billing.paymentMethod")}</p>
                <p className="text-sm font-medium">{t("billing.none")}</p>
                <button className="text-[11px] text-blue-600 hover:underline mt-0.5">
                  {t("billing.addPayment")}
                </button>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-3">{t("billing.invoiceHistory")}</p>
              <div className="flex items-center justify-center py-6">
                <p className="text-sm text-muted-foreground">{t("billing.noInvoices")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function UsageMeter({
  label,
  used,
  limit,
  limitLabel,
  pct,
  color,
}: {
  label: string;
  used: number;
  limit: number;
  limitLabel: string;
  pct: number;
  color: "default" | "warning";
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-sm">{label}</span>
        <span className="text-sm text-muted-foreground">{limitLabel}</span>
      </div>
      <Progress
        value={pct}
        className={`h-1.5 ${color === "warning" ? "[&>div]:bg-amber-500" : ""}`}
      />
    </div>
  );
}
