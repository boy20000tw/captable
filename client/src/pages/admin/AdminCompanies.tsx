/**
 * Admin Companies — list all companies, view details, manage plans.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { formatDate, formatNumber } from "@/lib/utils";
import { Building2, Search, Users, Eye, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizePlan } from "../../../../shared/plans";
import { toast } from "sonner";

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700 border-transparent",
  standard: "bg-blue-100 text-blue-700 border-transparent",
  plus: "bg-indigo-100 text-indigo-700 border-transparent",
  enterprise: "bg-purple-100 text-purple-700 border-transparent",
};

export default function AdminCompaniesPage() {
  return (
    <AdminLayout>
      <AdminCompaniesContent />
    </AdminLayout>
  );
}

function AdminCompaniesContent() {
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  if (selectedCompanyId !== null) {
    return <CompanyDetailView companyId={selectedCompanyId} onBack={() => setSelectedCompanyId(null)} />;
  }

  return <CompanyListView search={search} setSearch={setSearch} onSelect={setSelectedCompanyId} />;
}

// ─── Company List ────────────────────────────────────────────────────────────

function CompanyListView({
  search, setSearch, onSelect,
}: {
  search: string;
  setSearch: (s: string) => void;
  onSelect: (id: number) => void;
}) {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("admin");
  const { data: companies, isLoading } = trpc.admin.listCompanies.useQuery(
    { search: search || undefined },
    { placeholderData: (prev) => prev }
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> {tPages("admin.companies.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tPages("admin.companies.desc")}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("companies.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !companies || companies.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("companies.noCompanies")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("companies.colCompany")}</TableHead>
                  <TableHead>{t("companies.colPlan")}</TableHead>
                  <TableHead>{t("companies.colMembers")}</TableHead>
                  <TableHead>{t("companies.colStatus")}</TableHead>
                  <TableHead>{t("companies.colCreated")}</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(c.id)}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        {c.nameEn && c.nameEn !== c.name && (
                          <p className="text-xs text-muted-foreground">{c.nameEn}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={PLAN_COLORS[normalizePlan(c.plan)] ?? ""}>
                        {t(`companies.plan${normalizePlan(c.plan).charAt(0).toUpperCase()}${normalizePlan(c.plan).slice(1)}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.memberCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      {c.isSuspended ? (
                        <Badge variant="destructive">{t("companies.suspended")}</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-transparent">{t("companies.active")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onSelect(c.id); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Company Detail ──────────────────────────────────────────────────────────

function CompanyDetailView({ companyId, onBack }: { companyId: number; onBack: () => void }) {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("admin");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.companyDetail.useQuery({ companyId });
  const { data: auditLogs, isLoading: logsLoading } = trpc.admin.companyAuditLogs.useQuery(
    { companyId, limit: 50, offset: 0 }
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editPlan, setEditPlan] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editSuspended, setEditSuspended] = useState(false);

  const updateMut = trpc.admin.updatePlan.useMutation({
    onSuccess: () => {
      toast.success(t("companies.planUpdated") || "Plan updated");
      utils.admin.companyDetail.invalidate({ companyId });
      utils.admin.listCompanies.invalidate();
      setEditOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update plan");
    },
  });

  const openEdit = () => {
    if (!data) return;
    setEditPlan(normalizePlan(data.company.plan));
    setEditNote(data.company.planNote ?? "");
    setEditSuspended(data.company.isSuspended);
    setEditOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> {t("companies.back")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("companies.notFound")}</p>
      </div>
    );
  }

  const { company, members } = data;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={onBack} className="mb-2 gap-1 -ml-2">
          <ChevronLeft className="h-4 w-4" /> {t("companies.allCompanies")}
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
            {company.nameEn && company.nameEn !== company.name && (
              <p className="text-sm text-muted-foreground">{company.nameEn}</p>
            )}
          </div>
          <Button onClick={openEdit} size="sm">{t("companies.editPlan")}</Button>
        </div>
      </div>

      {/* Company info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("companies.subscription")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={`${PLAN_COLORS[normalizePlan(company.plan)]} text-base px-3 py-1`}>
              {t(`companies.plan${normalizePlan(company.plan).charAt(0).toUpperCase()}${normalizePlan(company.plan).slice(1)}`)}
            </Badge>
            {company.planNote && (
              <p className="text-xs text-muted-foreground mt-2">{company.planNote}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("companies.status")}</CardTitle>
          </CardHeader>
          <CardContent>
            {company.isSuspended ? (
              <Badge variant="destructive" className="text-base px-3 py-1">{t("companies.suspended")}</Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 border-transparent text-base px-3 py-1">{t("companies.active")}</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("companies.contact")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{company.contactEmail || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("companies.since", { date: formatDate(company.createdAt) })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Team members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("companies.teamMembers")}</CardTitle>
          <CardDescription>{t("companies.memberCount", { count: members.length })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("companies.colName")}</TableHead>
                <TableHead>{t("companies.colEmail")}</TableHead>
                <TableHead>{t("companies.colRole")}</TableHead>
                <TableHead>{t("companies.colJoined")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-sm">{m.userName || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.userEmail || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{m.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(m.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("companies.recentActivity")}</CardTitle>
          <CardDescription>{t("companies.auditDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">{t("companies.noActivity")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("companies.colAction")}</TableHead>
                  <TableHead>{t("companies.colUser")}</TableHead>
                  <TableHead>{t("companies.colResource")}</TableHead>
                  <TableHead>{t("companies.colTime")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.userName || t("companies.system")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.resourceType ? `${log.resourceType}${log.resourceName ? `: ${log.resourceName}` : ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Plan Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("companies.editSubscription", { name: company.name })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("companies.plan")}</Label>
              <Select value={editPlan} onValueChange={setEditPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">{t("companies.planStarter")}</SelectItem>
                  <SelectItem value="standard">{t("companies.planStandard")}</SelectItem>
                  <SelectItem value="plus">{t("companies.planPlus")}</SelectItem>
                  <SelectItem value="enterprise">{t("companies.planEnterprise")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("companies.note")}</Label>
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="e.g. Enterprise contract, 3-year term"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="suspended"
                checked={editSuspended}
                onChange={(e) => setEditSuspended(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="suspended" className="text-sm">
                {t("companies.suspendCompany")}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("companies.cancel")}</Button>
            <Button
              onClick={() => updateMut.mutate({
                companyId,
                plan: editPlan as any,
                planNote: editNote || undefined,
                isSuspended: editSuspended,
              })}
              disabled={updateMut.isPending}
            >
              {t("companies.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
