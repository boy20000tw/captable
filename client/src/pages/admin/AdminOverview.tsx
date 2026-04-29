/**
 * Admin Overview — platform stats, recent activity, quick actions.
 */

import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { formatNumber, formatDate } from "@/lib/utils";
import {
  Building2, Users, Crown, ArrowRight, MessageSquare,
  ClipboardList, ShieldCheck, Tag,
} from "lucide-react";
import { normalizePlan } from "../../../../shared/plans";
import { ADMIN_CHANGELOG } from "../../../../shared/adminChangelog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useLocation } from "wouter";

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700",
  standard: "bg-blue-100 text-blue-700",
  plus: "bg-indigo-100 text-indigo-700",
  enterprise: "bg-purple-100 text-purple-700",
};

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
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.admin.platformStats.useQuery();
  const { data: companies } = trpc.admin.listCompanies.useQuery({});
  const { data: logs } = trpc.admin.adminAuditLogs.useQuery({ limit: 5, offset: 0 });
  const { data: tickets } = trpc.admin.adminTickets.useQuery(undefined, { retry: false });

  const currentVersion = ADMIN_CHANGELOG[0];
  const recentCompanies = companies?.slice(0, 5) ?? [];
  const openTickets = tickets?.filter((t: any) => t.status === "open" || t.status === "in_progress") ?? [];

  if (isLoading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tPages("admin.overview.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tPages("admin.overview.desc")}
        </p>
      </div>

      {/* Stat cards — row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <MessageSquare className="h-4 w-4" /> {t("overview.openTickets")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{openTickets.length}</p>
            {openTickets.length > 0 && (
              <Button variant="link" className="p-0 h-auto text-xs" onClick={() => setLocation("/admin/tickets")}>
                {t("overview.viewTickets")} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" /> {t("overview.currentVersion")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">v{currentVersion.version}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{currentVersion.date}</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Plan breakdown + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Plan breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Crown className="h-4 w-4 text-muted-foreground" /> {t("overview.plans")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.planBreakdown.map((p: any) => {
                const plan = normalizePlan(p.plan);
                return (
                  <div key={p.plan} className="flex items-center justify-between">
                    <Badge className={`${PLAN_COLORS[plan] ?? ""} border-transparent text-xs`}>
                      {t(`overview.plan${plan.charAt(0).toUpperCase()}${plan.slice(1)}`)}
                    </Badge>
                    <span className="text-sm font-semibold">{p.count}</span>
                  </div>
                );
              })}
              {(!stats?.planBreakdown || stats.planBreakdown.length === 0) && (
                <p className="text-sm text-muted-foreground">{t("overview.noCompanies")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" /> {t("overview.quickActions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => setLocation("/admin/companies")}>
                <Building2 className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-xs font-medium">{t("overview.manageCompanies")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("overview.manageCompaniesDesc")}</p>
                </div>
              </Button>
              <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => setLocation("/admin/tickets")}>
                <MessageSquare className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-xs font-medium">{t("overview.manageTickets")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("overview.manageTicketsDesc")}</p>
                </div>
              </Button>
              <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => setLocation("/admin/activity")}>
                <ClipboardList className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-xs font-medium">{t("overview.viewActivity")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("overview.viewActivityDesc")}</p>
                </div>
              </Button>
              <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => setLocation("/admin/versions")}>
                <Tag className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-xs font-medium">{t("overview.versionLog")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("overview.versionLogDesc")}</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recent companies + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent companies */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{t("overview.recentCompanies")}</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setLocation("/admin/companies")}>
                {t("overview.viewAll")} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t("overview.colCompany")}</TableHead>
                  <TableHead className="text-xs">{t("overview.colPlan")}</TableHead>
                  <TableHead className="text-xs">{t("overview.colCreated")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCompanies.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation("/admin/companies")}>
                    <TableCell className="text-sm font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge className={`${PLAN_COLORS[normalizePlan(c.plan)] ?? ""} border-transparent text-[10px]`}>
                        {normalizePlan(c.plan)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {recentCompanies.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">{t("overview.noCompanies")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent admin activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{t("overview.recentActivity")}</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setLocation("/admin/activity")}>
                {t("overview.viewAll")} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t("overview.colAction")}</TableHead>
                  <TableHead className="text-xs">{t("overview.colTarget")}</TableHead>
                  <TableHead className="text-xs">{t("overview.colTime")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{t(`activity.action.${log.action}`, { defaultValue: log.action })}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.targetCompanyName ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {(!logs || logs.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">{t("overview.noActivity")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
