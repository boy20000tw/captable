/**
 * Admin Activity — platform admin audit log.
 * Shows what admin users have done (viewed company, changed plan, etc.)
 */

import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  view_company:         { label: "Viewed company",      color: "bg-gray-100 text-gray-700" },
  update_plan:          { label: "Updated plan",         color: "bg-blue-100 text-blue-700" },
  update_permissions:   { label: "Updated permissions",  color: "bg-amber-100 text-amber-700" },
  view_audit_log:       { label: "Viewed audit log",     color: "bg-gray-100 text-gray-700" },
  suspend_company:      { label: "Suspended company",    color: "bg-red-100 text-red-700" },
  reactivate_company:   { label: "Reactivated company",  color: "bg-green-100 text-green-700" },
};

export default function AdminActivityPage() {
  return (
    <AdminLayout>
      <AdminActivityContent />
    </AdminLayout>
  );
}

function AdminActivityContent() {
  const { data: logs, isLoading } = trpc.admin.adminAuditLogs.useQuery({ limit: 200, offset: 0 });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> Admin Activity
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Log of all platform admin actions — who did what, when
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity Log</CardTitle>
          <CardDescription>Most recent admin actions</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No admin activity logged yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Target Company</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => {
                  const actionInfo = ACTION_LABELS[log.action] ?? { label: log.action, color: "bg-gray-100 text-gray-700" };
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
                        <Badge className={`${actionInfo.color} border-transparent text-xs`}>
                          {actionInfo.label}
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
