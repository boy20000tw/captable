/**
 * 83(b) Election — generate election letters, track 30-day filing deadlines.
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { FileCheck, Plus, AlertTriangle, CheckCircle2, Clock, XCircle, Pencil, Trash2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";


type FormData = {
  recipientName: string;
  recipientEmail: string;
  grantDate: string;
  filingDeadline: string;
  sharesSubject: string;
  fmvPerShare: string;
  amountPaid: string;
  currency: string;
  propertyDescription: string;
  status: string;
  filedDate: string;
  notes: string;
};

const emptyForm: FormData = {
  recipientName: "", recipientEmail: "", grantDate: "", filingDeadline: "",
  sharesSubject: "", fmvPerShare: "", amountPaid: "", currency: "USD",
  propertyDescription: "", status: "pending", filedDate: "", notes: "",
};

export default function Election83bPage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="compliance.83b">
        <Election83bContent />
      </FeatureGate>
    </DashboardLayout>
  );
}

function Election83bContent() {
  const { t: tPage } = useTranslation("pages");
  const { t } = useTranslation("compliance");
  const utils = trpc.useUtils();
  const { data: elections, isLoading, isError } = trpc.election83b.list.useQuery();
  const { data: pending } = trpc.election83b.pending.useQuery();
  const createMut = trpc.election83b.create.useMutation({ onSuccess: () => { utils.election83b.invalidate(); setDialogOpen(false); } });
  const updateMut = trpc.election83b.update.useMutation({ onSuccess: () => { utils.election83b.invalidate(); setDialogOpen(false); } });
  const deleteMut = trpc.election83b.delete.useMutation({ onSuccess: () => utils.election83b.invalidate() });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  // Status label map
  const STATUS_STYLE: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
    pending:   { label: t("e83b.pending"),   icon: Clock,         color: "bg-amber-100 text-amber-700 border-transparent" },
    filed:     { label: t("e83b.filed"),     icon: CheckCircle2,  color: "bg-blue-100 text-blue-700 border-transparent" },
    confirmed: { label: t("e83b.confirmed"), icon: CheckCircle2,  color: "bg-green-100 text-green-700 border-transparent" },
    missed:    { label: t("e83b.missed"),    icon: XCircle,       color: "bg-red-100 text-red-700 border-transparent" },
  };

  // Count urgent deadlines (within 10 days)
  const urgentCount = useMemo(() => {
    if (!pending) return 0;
    const tenDays = Date.now() + 10 * 86400000;
    return pending.filter((e: any) => new Date(e.filingDeadline).getTime() <= tenDays).length;
  }, [pending]);

  const openCreate = () => {
    setEditId(null);
    const today = new Date().toISOString().slice(0, 10);
    const deadline = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    setForm({ ...emptyForm, grantDate: today, filingDeadline: deadline });
    setDialogOpen(true);
  };

  const openEdit = (e: any) => {
    setEditId(e.id);
    setForm({
      recipientName: e.recipientName ?? "",
      recipientEmail: e.recipientEmail ?? "",
      grantDate: e.grantDate ?? "",
      filingDeadline: e.filingDeadline ?? "",
      sharesSubject: String(e.sharesSubject ?? ""),
      fmvPerShare: e.fmvPerShare ?? "",
      amountPaid: e.amountPaid ?? "",
      currency: e.currency ?? "USD",
      propertyDescription: e.propertyDescription ?? "",
      status: e.status ?? "pending",
      filedDate: e.filedDate ?? "",
      notes: e.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = {
      recipientName: form.recipientName,
      recipientEmail: form.recipientEmail || undefined,
      grantDate: form.grantDate,
      filingDeadline: form.filingDeadline,
      sharesSubject: parseInt(form.sharesSubject) || 0,
      fmvPerShare: form.fmvPerShare || undefined,
      amountPaid: form.amountPaid || undefined,
      currency: form.currency || undefined,
      propertyDescription: form.propertyDescription || undefined,
      status: form.status as any,
      filedDate: form.filedDate || undefined,
      notes: form.notes || undefined,
    };
    if (editId) {
      updateMut.mutate({ id: editId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  // Auto-calculate deadline when grant date changes
  const handleGrantDateChange = (val: string) => {
    setForm(f => {
      const deadline = val ? new Date(new Date(val).getTime() + 30 * 86400000).toISOString().slice(0, 10) : f.filingDeadline;
      return { ...f, grantDate: val, filingDeadline: deadline };
    });
  };

  const daysUntil = (dateStr: string) => {
    const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    return d;
  };

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-destructive">{t("shared.loadError", { defaultValue: "Failed to load data. Please try again." })}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-primary" /> {tPage("compliance.83b.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tPage("compliance.83b.desc")}
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> {t("e83b.newElection")}
        </Button>
      </div>

      {/* Urgent deadlines alert */}
      {urgentCount > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {t("e83b.deadlineAlert", { count: urgentCount })}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {t("e83b.deadlineAlertDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Elections table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("e83b.elections")}</CardTitle>
          <CardDescription>{t("e83b.electionsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !elections || elections.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("e83b.emptyState")}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("e83b.recipient")}</TableHead>
                  <TableHead>{t("e83b.grantDate")}</TableHead>
                  <TableHead>{t("e83b.shares")}</TableHead>
                  <TableHead>{t("e83b.fmvPerShare")}</TableHead>
                  <TableHead>{t("e83b.filingDeadline")}</TableHead>
                  <TableHead>{t("shared.status")}</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {elections.map((e: any) => {
                  const s = STATUS_STYLE[e.status] ?? STATUS_STYLE.pending;
                  const Icon = s.icon;
                  const days = e.status === "pending" ? daysUntil(e.filingDeadline) : null;
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{e.recipientName}</p>
                          {e.recipientEmail && <p className="text-xs text-muted-foreground">{e.recipientEmail}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(e.grantDate)}</TableCell>
                      <TableCell className="text-sm">{Number(e.sharesSubject).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">
                        {e.fmvPerShare ? `${e.currency ?? "USD"} ${e.fmvPerShare}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          {formatDate(e.filingDeadline)}
                          {days !== null && days <= 10 && days > 0 && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                              {t("shared.daysLeft", { count: days })}
                            </Badge>
                          )}
                          {days !== null && days <= 0 && (
                            <Badge variant="destructive" className="text-[10px]">{t("shared.overdue")}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${s.color} gap-1 text-xs`}>
                          <Icon className="h-3 w-3" /> {s.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { if (confirm(t("e83b.confirmDelete"))) deleteMut.mutate({ id: e.id }); }}
                            disabled={deleteMut.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? t("e83b.editDialog") : t("e83b.newDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("e83b.recipientRequired")}</Label>
                <Input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("e83b.email")}</Label>
                <Input type="email" value={form.recipientEmail} onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("e83b.grantDateRequired")}</Label>
                <Input type="date" value={form.grantDate} onChange={e => handleGrantDateChange(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("e83b.deadlineAuto")}</Label>
                <Input type="date" value={form.filingDeadline} onChange={e => setForm(f => ({ ...f, filingDeadline: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("e83b.sharesRequired")}</Label>
                <Input type="number" value={form.sharesSubject} onChange={e => setForm(f => ({ ...f, sharesSubject: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("e83b.fmvPerShare")}</Label>
                <Input type="number" step="0.0001" value={form.fmvPerShare} onChange={e => setForm(f => ({ ...f, fmvPerShare: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("e83b.amountPaid")}</Label>
                <Input type="number" step="0.01" value={form.amountPaid} onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("shared.status")}</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t("e83b.pending")}</SelectItem>
                    <SelectItem value="filed">{t("e83b.filed")}</SelectItem>
                    <SelectItem value="confirmed">{t("e83b.confirmed")}</SelectItem>
                    <SelectItem value="missed">{t("e83b.missed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("e83b.filedDate")}</Label>
                <Input type="date" value={form.filedDate} onChange={e => setForm(f => ({ ...f, filedDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("e83b.propertyDesc")}</Label>
              <Input value={form.propertyDescription} onChange={e => setForm(f => ({ ...f, propertyDescription: e.target.value }))} placeholder={t("e83b.propertyPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("shared.notes")}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("shared.cancel")}</Button>
            <Button
              onClick={handleSave}
              disabled={!form.recipientName || !form.grantDate || !form.filingDeadline || createMut.isPending || updateMut.isPending}
            >
              {editId ? t("shared.save") : t("shared.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
