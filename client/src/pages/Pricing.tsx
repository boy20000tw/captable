import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Check, HelpCircle, Mail } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { normalizePlan, type PlanKey } from "../../../shared/plans";

const ADMIN_EMAIL = "boy20000tw@gmail.com";

type TierColor = "gray" | "blue" | "indigo" | "purple";

// ── Pricing constants ──────────────────────────────────────────────────
// Monthly prices (NTD) — annual = 90% of monthly × 12
const MONTHLY = { standard: 299, plus: 699 } as const;
const ANNUAL_DISCOUNT = 0.9; // 10% off

function annualMonthly(monthly: number) {
  return Math.round(monthly * ANNUAL_DISCOUNT);
}
function annualTotal(monthly: number) {
  return annualMonthly(monthly) * 12;
}
function annualSaving(monthly: number) {
  return monthly * 12 - annualTotal(monthly);
}

// ── Components ─────────────────────────────────────────────────────────

function CheckIcon({ color }: { color: TierColor }) {
  const cls: Record<TierColor, string> = {
    gray: "text-gray-500",
    blue: "text-blue-600",
    indigo: "text-indigo-600",
    purple: "text-purple-600",
  };
  return <Check className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cls[color]}`} />;
}

function BillingToggle({
  isAnnual,
  onToggle,
  t,
}: {
  isAnnual: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      <span className={`text-sm font-medium ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
        {t("pricing.monthly")}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isAnnual}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isAnnual ? "bg-blue-600" : "bg-gray-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
            isAnnual ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className={`text-sm font-medium ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
        {t("pricing.annual")}
      </span>
      {isAnnual && (
        <Badge className="bg-green-50 text-green-700 hover:bg-green-50 border-transparent text-[11px]">
          {t("pricing.save10")}
        </Badge>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { t } = useTranslation("subscription");
  const [, setLocation] = useLocation();
  const [isAnnual, setIsAnnual] = useState(false);

  const company = trpc.companies.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const currentPlan = normalizePlan(company.data?.plan as string);

  const standardPrice = isAnnual ? annualMonthly(MONTHLY.standard) : MONTHLY.standard;
  const plusPrice = isAnnual ? annualMonthly(MONTHLY.plus) : MONTHLY.plus;

  const starterFeatures = [
    t("pricing.starter.f1"), t("pricing.starter.f2"), t("pricing.starter.f3"),
    t("pricing.starter.f4"), t("pricing.starter.f5"),
  ];
  const standardFeatures = [
    t("pricing.standard.f1"), t("pricing.standard.f2"), t("pricing.standard.f3"),
    t("pricing.standard.f4"), t("pricing.standard.f5"), t("pricing.standard.f6"),
  ];
  const plusFeatures = [
    t("pricing.plus.f1"), t("pricing.plus.f2"), t("pricing.plus.f3"),
    t("pricing.plus.f4"), t("pricing.plus.f5"), t("pricing.plus.f6"),
    t("pricing.plus.f7"),
  ];
  const enterpriseFeatures = [
    t("pricing.enterprise.f1"), t("pricing.enterprise.f2"), t("pricing.enterprise.f3"),
    t("pricing.enterprise.f4"), t("pricing.enterprise.f5"), t("pricing.enterprise.f6"),
  ];

  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{t("pricing.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("pricing.subtitle")}</p>
        </div>

        {/* Billing toggle */}
        <BillingToggle isAnnual={isAnnual} onToggle={() => setIsAnnual(!isAnnual)} t={t} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Starter */}
          <Card className="flex flex-col">
            <CardContent className="flex flex-col flex-1 pt-6">
              <Badge variant="secondary" className="w-fit mb-3 bg-gray-100 text-gray-600 hover:bg-gray-100">
                {t("pricing.starter")}
              </Badge>
              <p className="text-3xl font-semibold">NT$0</p>
              <p className="text-xs text-muted-foreground mb-4">{t("pricing.foreverFree")}</p>

              <div className="border-t pt-4 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  {t("pricing.includes")}
                </p>
                <div className="space-y-2.5">
                  {starterFeatures.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <CheckIcon color="gray" />
                      <span className="text-sm">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                {currentPlan === "starter" ? (
                  <Button variant="outline" className="w-full" disabled>
                    {t("pricing.currentPlan")}
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setLocation("/subscription")}>
                    {t("pricing.currentPlan")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Standard (featured) */}
          <Card className="flex flex-col border-2 border-blue-500 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-transparent">
                {t("pricing.mostPopular")}
              </Badge>
            </div>
            <CardContent className="flex flex-col flex-1 pt-6">
              <Badge variant="secondary" className="w-fit mb-3 bg-blue-50 text-blue-700 hover:bg-blue-50">
                {t("pricing.standard")}
              </Badge>
              <div className="mb-1">
                <p className="text-3xl font-semibold inline">
                  NT${standardPrice}
                </p>
                <span className="text-sm font-normal text-muted-foreground">{t("pricing.perMonth")}</span>
              </div>
              {isAnnual ? (
                <p className="text-xs text-muted-foreground mb-4">
                  {t("pricing.billedAnnuallyAt", { total: `NT$${annualTotal(MONTHLY.standard).toLocaleString()}` })}{" "}
                  <span className="text-green-600 font-medium">
                    {t("pricing.saveAmount", { amount: `NT$${annualSaving(MONTHLY.standard).toLocaleString()}` })}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mb-4">{t("pricing.billedMonthly")}</p>
              )}

              <div className="border-t pt-4 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  {t("pricing.everythingInStarter")}
                </p>
                <div className="space-y-2.5">
                  {standardFeatures.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <CheckIcon color="blue" />
                      <span className="text-sm">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                {currentPlan === "standard" ? (
                  <Button variant="outline" className="w-full" disabled>
                    {t("pricing.currentPlan")}
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                    onClick={() => window.location.href = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(t("pricing.contactSubject", { plan: t("pricing.standard") }))}`}
                  >
                    <Mail className="h-4 w-4" />
                    {t("pricing.contactAdmin")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Plus */}
          <Card className="flex flex-col">
            <CardContent className="flex flex-col flex-1 pt-6">
              <Badge variant="secondary" className="w-fit mb-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-50">
                {t("pricing.plus")}
              </Badge>
              <div className="mb-1">
                <p className="text-3xl font-semibold inline">
                  NT${plusPrice}
                </p>
                <span className="text-sm font-normal text-muted-foreground">{t("pricing.perMonth")}</span>
              </div>
              {isAnnual ? (
                <p className="text-xs text-muted-foreground mb-4">
                  {t("pricing.billedAnnuallyAt", { total: `NT$${annualTotal(MONTHLY.plus).toLocaleString()}` })}{" "}
                  <span className="text-green-600 font-medium">
                    {t("pricing.saveAmount", { amount: `NT$${annualSaving(MONTHLY.plus).toLocaleString()}` })}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mb-4">{t("pricing.billedMonthly")}</p>
              )}

              <div className="border-t pt-4 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  {t("pricing.everythingInStandard")}
                </p>
                <div className="space-y-2.5">
                  {plusFeatures.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <CheckIcon color="indigo" />
                      <span className="text-sm">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                {currentPlan === "plus" ? (
                  <Button variant="outline" className="w-full" disabled>
                    {t("pricing.currentPlan")}
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                    onClick={() => window.location.href = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(t("pricing.contactSubject", { plan: t("pricing.plus") }))}`}
                  >
                    <Mail className="h-4 w-4" />
                    {t("pricing.contactAdmin")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Enterprise */}
          <Card className="flex flex-col">
            <CardContent className="flex flex-col flex-1 pt-6">
              <Badge variant="secondary" className="w-fit mb-3 bg-purple-50 text-purple-700 hover:bg-purple-50">
                {t("pricing.enterprise")}
              </Badge>
              <p className="text-3xl font-semibold">{t("pricing.contactSales")}</p>
              <p className="text-xs text-muted-foreground mb-4">&nbsp;</p>

              <div className="border-t pt-4 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  {t("pricing.everythingInPlus")}
                </p>
                <div className="space-y-2.5">
                  {enterpriseFeatures.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <CheckIcon color="purple" />
                      <span className="text-sm">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                {currentPlan === "enterprise" ? (
                  <Button variant="outline" className="w-full" disabled>
                    {t("pricing.currentPlan")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={() => window.location.href = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(t("pricing.contactSubject", { plan: t("pricing.enterprise") }))}`}
                  >
                    <Mail className="h-4 w-4" />
                    {t("pricing.contactAdmin")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer note */}
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3 mb-8">
          <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            {t("pricing.footer")}{" "}
            <a href={`mailto:${ADMIN_EMAIL}`} className="text-blue-600 hover:underline">
              {t("pricing.talkToUs")}
            </a>
          </p>
        </div>

      </div>
    </DashboardLayout>
  );
}
