/**
 * 409A Valuation — track FMV assessments, expiry dates, and active valuation.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { trpc } from "@/lib/trpc";
import { formatDate, formatNumber } from "@/lib/utils";
import { DollarSign, Plus, AlertTriangle, CheckCircle2, Clock, Pencil, Trash2 } from "lucide-react";
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
  valuationDate: string;
  expiryDate: string;
  status: string;
  fmvPerShare: string;
  currency: string;
  method: string;
  valuationFirm: string;
  reportUrl: string;
  notes: string;
};

const emptyForm: FormData = {
  valuationDate: "", expiryDate: "", status: "active", fmvPerShare: "",
  currency: "USD", method: "dcf", valuationFirm: "", reportUrl: "", notes: "",
};

export default function Valuation409APage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="compliance.409a">
        <Valuation409AContent />
      </FeatureGate>
    </DashboardLayout>
  );
}

function Valuation409AContent() {
  const { t: tPage } = useTranslation("pages");
  const { t } = useTranslation("compliance");
  const utils = trpc.useUtils();
  const { data: valuations, isLoading } = trpc.valuation409a.list.useQuery();
  const { data: active } = trpc.valuation409a.active.useQuery();
  const createMut = trpc.valuation409a.create.useMutation({ onSuccess: () => { utils.valuation409a.invalidate(); setDialogOpen(false); } });
  const updateMut = trpc.valuation409a.update.useMutation({ onSuccess: () => { utils.valuation409a.invalidate(); setDialogOpen(false); } });
  const deleteMut = trpc.valuation409a.delete.useMutation({ onSuccess: () => utils.valuation409a.invalidate() });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  // Status and method label maps
  const STATUS_STYLE: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
    active:     { label: t("v409a.statusActive"),     icon: CheckCircle2,  color: "bg-green-100 text-green-700 border-transparent" },
    expired:    { label: t("v409a.statusExpired"),    icon: AlertTriangle, color: "bg-red-100 text-red-700 border-transparent" },
    superseded: { label: t("v409a.statusSuperseded"), icon: Clock,         color: "bg-gray-100 text-gray-600 border-transparent" },
  };

  const METHOD_LABELS: Record<string, string> = {
    dcf: t("v409a.methodDcf"),
    market_comparable: t("v409a.methodMarket"),
    asset_based: t("v409a.methodAsset"),
    "409a_safe_harbor": t("v409a.methodSafe"),
    other: t("v409a.methodOther"),
  };

  const openCreate = () => {
    setEditId(null);
    const today = new Date().toISOString().slice(0, 10);
    const expiry = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    setForm({ ...emptyForm, valuationDate: today, expiryDate: expiry });
    setDialogOpen(true);
  };

  const openEdit = (v: any) => {
    setEditId(v.id);
    setForm({
      valuationDate: v.valuationDate ?? "",
      expiryDate: v.expiryDate ?? "",
      status: v.status ?? "active",
      fmvPerShare: v.fmvPerShare ?? "",
      currency: v.currency ?? "USD",
      method: v.method ?? "dcf",
      valuationFirm: v.valuationFirm ?? "",
      reportUrl: v.reportUrl ?? "",
      notes: v.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = {
      valuationDate: form.valuationDate,
      expiryDate: form.expiryDate || undefined,
      status: form.status as any,
      fmvPerShare: form.fmvPerShare || undefined,
      currency: form.currency || undefined,
      method: form.method as any,
      valuationFirm: form.valuationFirm || undefined,
      reportUrl: form.reportUrl || undefined,
      notes: form.notes || undefined,
    };
    if (editId) {
      updateMut.mutate({ id: editId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  // Check if active valuation is expiring soon (within 60 days)
  const isExpiringSoon = active?.expiryDate
    ? (new Date(active.expiryDate).getTime() - Date.now()) < 60 * 86400000
    : false;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> {tPage("compliance.409a.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tPage("compliance.409a.desc")}
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> {t("v409a.newValuation")}
        </Button>
      </div>

      {/* Active valuation card */}
      {active && (
        <Card className={isExpiringSoon ? "border-amber-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {t("v409a.activeValuation")}
              {isExpiringSoon && (
                <Badge className="bg-amber-100 text-amber-700 border-transparent gap-1">
                  <AlertTriangle className="h-3 w-3" /> {t("v409a.expiringSoon")}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {active.valuationFirm ? `${t("v409a.by")} ${active.valuationFirm} — ` : ""}
              {METHOD_LABELS[active.method ?? ""] ?? active.method}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("v409a.fmvPerShare")}</p>
                <p className="text-xl font-bold mt-1">
                  {active.currency ?? "USD"} {active.fmvPerShare ?? "—"}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("v409a.valuationDate")}</p>
                <p className="text-lg font-semibold mt-1">{formatDate(active.valuationDate)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("v409a.expires")}</p>
                <p className="text-lg font-semibold mt-1">{active.expiryDate ? formatDate(active.expiryDate) : "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("v409a.method")}</p>
                <p className="text-lg font-semibold mt-1">{METHOD_LABELS[active.method ?? ""] ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Valuation history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("v409a.history")}</CardTitle>
          <CardDescription>{t("v409a.historyDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !valuations || valuations.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("v409a.emptyState")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("shared.date")}</TableHead>
                  <TableHead>{t("v409a.fmvPerShare")}</TableHead>
                  <TableHead>{t("v409a.method")}</TableHead>
                  <TableHead>{t("v409a.firm")}</TableHead>
                  <TableHead>{t("v409a.expires")}</TableHead>
                  <TableHead>{t("shared.status")}</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valuations.map((v: any) => {
                  const s = STATUS_STYLE[v.status] ?? STATUS_STYLE.active;
                  const Icon = s.icon;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium text-sm">{formatDate(v.valuationDate)}</TableCell>
                      <TableCell className="text-sm">
                        {v.fmvPerShare ? `${v.currency ?? "USD"} ${v.fmvPerShare}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {METHOD_LABELS[v.method ?? ""] ?? v.method ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{v.valuationFirm || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {v.expiryDate ? formatDate(v.expiryDate) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${s.color} gap-1 text-xs`}>
                          <Icon className="h-3 w-3" /> {s.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { if (confirm(t("v409a.confirmDelete"))) deleteMut.mutate({ id: v.id }); }}
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
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? t("v409a.editDialog") : t("v409a.newDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("v409a.valuationDateRequired")}</Label>
                <Input type="date" value={form.valuationDate} onChange={e => setForm(f => ({ ...f, valuationDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("v409a.expiryDate")}</Label>
                <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("v409a.fmvPerShare")}</Label>
                <Input type="number" step="0.0001" value={form.fmvPerShare} onChange={e => setForm(f => ({ ...f, fmvPerShare: e.target.value }))} placeholder={t("v409a.fmvPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("shared.currency")}</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">{t("shared.usd")}</SelectItem>
                    <SelectItem value="NTD">{t("shared.ntd")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("shared.status")}</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("v409a.statusActive")}</SelectItem>
                    <SelectItem value="expired">{t("v409a.statusExpired")}</SelectItem>
                    <SelectItem value="superseded">{t("v409a.statusSuperseded")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("v409a.method")}</Label>
                <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dcf">{t("v409a.methodDcf")}</SelectItem>
                    <SelectItem value="market_comparable">{t("v409a.methodMarket")}</SelectItem>
                    <SelectItem value="asset_based">{t("v409a.methodAsset")}</SelectItem>
                    <SelectItem value="409a_safe_harbor">{t("v409a.methodSafe")}</SelectItem>
                    <SelectItem value="other">{t("v409a.methodOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("v409a.valuationFirm")}</Label>
                <Input value={form.valuationFirm} onChange={e => setForm(f => ({ ...f, valuationFirm: e.target.value }))} placeholder={t("v409a.firmPlaceholder")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("v409a.reportUrl")}</Label>
              <Input value={form.reportUrl} onChange={e => setForm(f => ({ ...f, reportUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label>{t("shared.notes")}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("shared.cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.valuationDate || createMut.isPending || updateMut.isPending}>
              {editId ? t("shared.save") : t("shared.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
