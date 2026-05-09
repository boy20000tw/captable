/**
 * Admin Activity — platform admin audit log.
 * Shows what admin users have done (viewed company, changed plan, etc.)
 */

import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const ACTION_LABEL_COLORS: Record<string, string> = {
  view_company:         "bg-gray-100 text-gray-700",
  update_plan:          "bg-blue-100 text-blue-700",
  update_permissions:   "bg-amber-100 text-amber-700",
  view_audit_log:       "bg-gray-100 text-gray-700",
  suspend_company:      "bg-red-100 text-red-700",
  reactivate_company:   "bg-green-100 text-green-700",
};

export default function AdminActivityPage() {
  return (
    <AdminLayout>
      <AdminActivityContent />
    </AdminLayout>
  );
}

function AdminActivityContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("admin");
  const { data: logs, isLoading, isError } = trpc.admin.adminAuditLogs.useQuery({ limit: 200, offset: 0 });

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-destructive">{t("activity.loadError", { defaultValue: "Failed to load data. Please try again." })}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> {tPages("admin.activity.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tPages("admin.activity.desc")}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("activity.activityLog")}</CardTitle>
          <CardDescription>{t("activity.recentActions")}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("activity.noActivity")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("activity.colAction")}</TableHead>
                  <TableHead>{t("activity.colAdmin")}</TableHead>
                  <TableHead>{t("activity.colTarget")}</TableHead>
                  <TableHead>{t("activity.colDetails")}</TableHead>
                  <TableHead>{t("activity.colTime")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => {
                  const getActionLabel = (action: string): string => {
                    switch (action) {
                      case "view_company": return t("activity.viewedCompany");
                      case "update_plan": return t("activity.updatedPlan");
                      case "update_permissions": return t("activity.updatedPermissions");
                      case "view_audit_log": return t("activity.viewedAuditLog");
                      case "suspend_company": return t("activity.suspendedCompany");
                      case "reactivate_company": return t("activity.reactivatedCompany");
                      default: return action;
                    }
                  };
                  const actionLabel = getActionLabel(log.action);
                  const actionColor = ACTION_LABEL_COLORS[log.action] ?? "bg-gray-100 text-gray-700";
                  let detailSummary = "";
                  if (log.details) {
                    try {
                      const d = JSON.parse(log.details);
                      if (d.after?.plan) detailSummary = `→ ${d.after.plan}`;
                      else if (d.limit) detailSummary = `${d.limit} entries`;
                    } catch { /* ignore */ }
                  }
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge className={`${actionColor} border-transparent text-xs`}>
                          {actionLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{log.adminUserName || "—"}</p>
                          <p className="text-xs text-muted-foreground">{log.adminUserEmail || ""}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.targetCompanyName || (log.targetCompanyId ? `#${log.targetCompanyId}` : "—")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {detailSummary || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
