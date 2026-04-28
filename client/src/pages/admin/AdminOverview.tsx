/**
 * Admin Overview — platform stats at a glance.
 */

import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/utils";
import { Building2, Users, Crown } from "lucide-react";
import { normalizePlan } from "../../../../shared/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminOverviewPage() {
  return (
    <AdminLayout>
      <AdminOverviewContent />
    </AdminLayout>
  );
}

function AdminOverviewContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("admin");
  const { data: stats, isLoading } = trpc.admin.platformStats.useQuery();

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tPages("admin.overview.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tPages("admin.overview.desc")}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> {t("overview.totalCompanies")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(stats?.totalCompanies ?? 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> {t("overview.totalUsers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(stats?.totalUsers ?? 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Crown className="h-4 w-4" /> {t("overview.plans")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {stats?.planBreakdown.map((p: any) => (
                <div key={p.plan} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t(`overview.plan${normalizePlan(p.plan).charAt(0).toUpperCase()}${normalizePlan(p.plan).slice(1)}`)}
                  </span>
                  <span className="font-semibold">{p.count}</span>
                </div>
              ))}
              {(!stats?.planBreakdown || stats.planBreakdown.length === 0) && (
                <p className="text-sm text-muted-foreground">{t("overview.noCompanies")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
