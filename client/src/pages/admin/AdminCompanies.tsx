/**
 * Admin Companies — list all companies, view details, manage plans.
 */

import { useState } from "react";
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

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700 border-transparent",
  paid: "bg-blue-100 text-blue-700 border-transparent",
  custom: "bg-purple-100 text-purple-700 border-transparent",
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
  const { data: companies, isLoading } = trpc.admin.listCompanies.useQuery(
    { search: search || undefined },
    { placeholderData: (prev) => prev }
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Companies
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all registered companies
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
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
              No companies found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
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
                      <Badge className={PLAN_COLORS[c.plan] ?? ""}>
                        {c.plan === "custom" ? "Custom" : c.plan === "paid" ? "Paid" : "Free"}
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
                        <Badge variant="destructive">Suspended</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-transparent">Active</Badge>
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
      utils.admin.companyDetail.invalidate({ companyId });
      utils.admin.listCompanies.invalidate();
      setEditOpen(false);
    },
  });

  const openEdit = () => {
    if (!data) return;
    setEditPlan(data.company.plan);
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
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Company not found.</p>
      </div>
    );
  }

  const { company, members } = data;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={onBack} className="mb-2 gap-1 -ml-2">
          <ChevronLeft className="h-4 w-4" /> All Companies
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
            {company.nameEn && company.nameEn !== company.name && (
              <p className="text-sm text-muted-foreground">{company.nameEn}</p>
            )}
          </div>
          <Button onClick={openEdit} size="sm">Edit Plan</Button>
        </div>
      </div>

      {/* Company info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={`${PLAN_COLORS[company.plan]} text-base px-3 py-1`}>
              {company.plan === "custom" ? "Custom" : company.plan === "paid" ? "Paid" : "Free"}
            </Badge>
            {company.planNote && (
              <p className="text-xs text-muted-foreground mt-2">{company.planNote}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {company.isSuspended ? (
              <Badge variant="destructive" className="text-base px-3 py-1">Suspended</Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 border-transparent text-base px-3 py-1">Active</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{company.contactEmail || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Since {formatDate(company.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Team members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Team Members</CardTitle>
          <CardDescription>{members.length} member{members.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
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
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription>Audit log for this company (last 50 entries)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No activity logged yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.userName || "System"}</TableCell>
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
            <DialogTitle>Edit Subscription — {company.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={editPlan} onValueChange={setEditPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
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
                Suspend this company (blocks access)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => updateMut.mutate({
                companyId,
                plan: editPlan as any,
                planNote: editNote || undefined,
                isSuspended: editSuspended,
              })}
              disabled={updateMut.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
