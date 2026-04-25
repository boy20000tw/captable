/**
 * Admin Overview — platform stats at a glance.
 */

import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/utils";
import { Building2, Users, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  paid: "Paid",
  custom: "Custom",
};

export default function AdminOverviewPage() {
  return (
    <AdminLayout>
      <AdminOverviewContent />
    </AdminLayout>
  );
}

function AdminOverviewContent() {
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
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          High-level stats across all companies on Caploom
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Total Companies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(stats?.totalCompanies ?? 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(stats?.totalUsers ?? 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Crown className="h-4 w-4" /> Plans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {stats?.planBreakdown.map((p: any) => (
                <div key={p.plan} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{PLAN_LABELS[p.plan] ?? p.plan}</span>
                  <span className="font-semibold">{p.count}</span>
                </div>
              ))}
              {(!stats?.planBreakdown || stats.planBreakdown.length === 0) && (
                <p className="text-sm text-muted-foreground">No companies yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
