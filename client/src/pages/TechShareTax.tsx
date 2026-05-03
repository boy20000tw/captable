/**
 * 技術股 / RSA 課稅追蹤 — Taiwan 產創條例 §19-1 deferral tracking
 * Tracks acquisition, deferral eligibility, vesting, disposition, and tax filing status
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { Receipt, Plus, AlertTriangle, CheckCircle2, Clock, XCircle, Pencil, Trash2 } from "lucide-react";
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

const STATUS_STYLE: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  deferred:  { label: "緩課中",   icon: Clock,         color: "bg-amber-100 text-amber-700 border-transparent" },
  taxable:   { label: "應課稅",   icon: AlertTriangle, color: "bg-blue-100 text-blue-700 border-transparent" },
  filed:     { label: "已課稅",   icon: CheckCircle2,  color: "bg-green-100 text-green-700 border-transparent" },
  exempt:    { label: "豁免",     icon: XCircle,       color: "bg-gray-100 text-gray-600 border-transparent" },
};

const SHARE_TYPE_LABELS: Record<string, string> = {
  tech_share: "技術股",
  rsa: "RSA",
};

const DISPOSITION_TYPE_LABELS: Record<string, string> = {
  sale: "出售",
  donation: "捐贈",
  transfer: "轉移",
  other: "其他",
};

type FormData = {
  holderName: string;
  shareType: string;
  acquisitionDate: string;
  sharesAcquired: string;
  acquisitionFmv: string;
  paidAmount: string;
  isDeferralEligible: boolean;
  deferralStartDate: string;
  deferralExpiryDate: string;
  holdingPeriodMet: boolean;
  vestingDate: string;
  vestingFmv: string;
  dispositionDate: string;
  dispositionFmv: string;
  dispositionType: string;
  taxStatus: string;
  filingDeadline: string;
  filingDate: string;
  filingReference: string;
  notes: string;
};

const emptyForm: FormData = {
  holderName: "",
  shareType: "tech_share",
  acquisitionDate: "",
  sharesAcquired: "",
  acquisitionFmv: "",
  paidAmount: "",
  isDeferralEligible: false,
  deferralStartDate: "",
  deferralExpiryDate: "",
  holdingPeriodMet: false,
  vestingDate: "",
  vestingFmv: "",
  dispositionDate: "",
  dispositionFmv: "",
  dispositionType: "sale",
  taxStatus: "deferred",
  filingDeadline: "",
  filingDate: "",
  filingReference: "",
  notes: "",
};

export default function TechShareTaxPage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="compliance.techShareTax">
        <TechShareTaxContent />
      </FeatureGate>
    </DashboardLayout>
  );
}

function TechShareTaxContent() {
  const { t } = useTranslation("compliance");
  const { t: tPages } = useTranslation("pages");
  const utils = trpc.useUtils();
  const { data: records, isLoading } = trpc.techShareTax.list.useQuery();
  const { data: expiring } = trpc.techShareTax.expiring.useQuery({ withinDays: 60 });
  const createMut = trpc.techShareTax.create.useMutation({ onSuccess: () => { utils.techShareTax.invalidate(); setDialogOpen(false); } });
  const updateMut = trpc.techShareTax.update.useMutation({ onSuccess: () => { utils.techShareTax.invalidate(); setDialogOpen(false); } });
  const deleteMut = trpc.techShareTax.delete.useMutation({ onSuccess: () => utils.techShareTax.invalidate() });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  // Status labels map
  const statusLabels: Record<string, string> = {
    deferred: t("techShare.deferred"),
    taxable: t("techShare.taxable"),
    filed: t("techShare.filed"),
    exempt: t("techShare.exempt"),
  };

  // Share type labels map
  const shareTypeLabels: Record<string, string> = {
    tech_share: t("techShare.techShare"),
    rsa: t("techShare.rsa"),
  };

  // Disposition type labels map
  const dispositionTypeLabels: Record<string, string> = {
    sale: t("techShare.sale"),
    donation: t("techShare.gift"),
    transfer: t("techShare.transfer"),
    other: t("techShare.other"),
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (!records) return { deferred: 0, expiring: 0, filed: 0 };
    return {
      deferred: records.filter((r: any) => r.taxStatus === "deferred").length,
      expiring: expiring?.length ?? 0,
      filed: records.filter((r: any) => r.taxStatus === "filed").length,
    };
  }, [records, expiring]);

  const openCreate = () => {
    setEditId(null);
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...emptyForm, acquisitionDate: today, deferralStartDate: today });
    setDialogOpen(true);
  };

  const openEdit = (r: any) => {
    setEditId(r.id);
    setForm({
      holderName: r.holderName ?? "",
      shareType: r.shareType ?? "tech_share",
      acquisitionDate: r.acquisitionDate ?? "",
      sharesAcquired: String(r.sharesAcquired ?? ""),
      acquisitionFmv: r.acquisitionFmv ?? "",
      paidAmount: r.paidAmount ?? "",
      isDeferralEligible: r.isDeferralEligible ?? false,
      deferralStartDate: r.deferralStartDate ?? "",
      deferralExpiryDate: r.deferralExpiryDate ?? "",
      holdingPeriodMet: r.holdingPeriodMet ?? false,
      vestingDate: r.vestingDate ?? "",
      vestingFmv: r.vestingFmv ?? "",
      dispositionDate: r.dispositionDate ?? "",
      dispositionFmv: r.dispositionFmv ?? "",
      dispositionType: r.dispositionType ?? "sale",
      taxStatus: r.taxStatus ?? "deferred",
      filingDeadline: r.filingDeadline ?? "",
      filingDate: r.filingDate ?? "",
      filingReference: r.filingReference ?? "",
      notes: r.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = {
      holderName: form.holderName,
      shareType: form.shareType as any,
      acquisitionDate: form.acquisitionDate,
      sharesAcquired: parseInt(form.sharesAcquired) || 0,
      acquisitionFmv: form.acquisitionFmv || undefined,
      paidAmount: form.paidAmount || undefined,
      isDeferralEligible: form.isDeferralEligible,
      deferralStartDate: form.deferralStartDate || undefined,
      deferralExpiryDate: form.deferralExpiryDate || undefined,
      holdingPeriodMet: form.holdingPeriodMet,
      vestingDate: form.vestingDate || undefined,
      vestingFmv: form.vestingFmv || undefined,
      dispositionDate: form.dispositionDate || undefined,
      dispositionFmv: form.dispositionFmv || undefined,
      dispositionType: form.dispositionType as any,
      taxStatus: form.taxStatus as any,
      filingDeadline: form.filingDeadline || undefined,
      filingDate: form.filingDate || undefined,
      filingReference: form.filingReference || undefined,
      notes: form.notes || undefined,
    };
    if (editId) {
      updateMut.mutate({ id: editId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  // Auto-calculate deferral expiry as acquisition + 5 years
  const handleDeferralEligibleChange = (checked: boolean) => {
    setForm(f => {
      if (checked && f.acquisitionDate) {
        const acqDate = new Date(f.acquisitionDate);
        const expiryDate = new Date(acqDate.getFullYear() + 5, acqDate.getMonth(), acqDate.getDate());
        return {
          ...f,
          isDeferralEligible: checked,
          deferralStartDate: f.deferralStartDate || f.acquisitionDate,
          deferralExpiryDate: expiryDate.toISOString().slice(0, 10),
        };
      }
      return { ...f, isDeferralEligible: checked };
    });
  };

  const handleAcquisitionDateChange = (val: string) => {
    setForm(f => {
      const newForm = { ...f, acquisitionDate: val };
      if (f.isDeferralEligible && val) {
        const acqDate = new Date(val);
        const expiryDate = new Date(acqDate.getFullYear() + 5, acqDate.getMonth(), acqDate.getDate());
        newForm.deferralExpiryDate = expiryDate.toISOString().slice(0, 10);
      }
      return newForm;
    });
  };

  const daysUntil = (dateStr: string) => {
    if (!dateStr) return -1;
    const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    return d;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> {tPages("compliance.techShare.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tPages("compliance.techShare.desc")}
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> {t("techShare.newRecord")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("techShare.statsDeferred")}</p>
            <p className="text-3xl font-bold mt-2">{stats.deferred}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("techShare.statsExpiring")}</p>
            <p className="text-3xl font-bold mt-2">{stats.expiring}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("techShare.statsFiled")}</p>
            <p className="text-3xl font-bold mt-2">{stats.filed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Expiry Alert Banner */}
      {(expiring && expiring.length > 0) && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {t("techShare.expiringAlert", { count: expiring.length })}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {t("techShare.expiringAlertDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("techShare.recordsTitle")}</CardTitle>
          <CardDescription>{t("techShare.recordsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !records || records.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("techShare.emptyState")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("techShare.holder")}</TableHead>
                  <TableHead>{t("techShare.type")}</TableHead>
                  <TableHead>{t("techShare.acquireDate")}</TableHead>
                  <TableHead>{t("techShare.shares")}</TableHead>
                  <TableHead>{t("techShare.acquireFmv")}</TableHead>
                  <TableHead>{t("techShare.deferralStatus")}</TableHead>
                  <TableHead>{t("techShare.expiryDate")}</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r: any) => {
                  const s = STATUS_STYLE[r.taxStatus] ?? STATUS_STYLE.deferred;
                  const Icon = s.icon;
                  const days = r.deferralExpiryDate ? daysUntil(r.deferralExpiryDate) : -1;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{r.holderName}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {shareTypeLabels[r.shareType] ?? r.shareType}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(r.acquisitionDate)}</TableCell>
                      <TableCell className="text-sm">{Number(r.sharesAcquired).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">
                        {r.acquisitionFmv ? `${r.acquisitionFmv}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${s.color} gap-1 text-xs`}>
                          <Icon className="h-3 w-3" /> {statusLabels[r.taxStatus] ?? r.taxStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          {r.deferralExpiryDate ? formatDate(r.deferralExpiryDate) : "—"}
                          {days !== -1 && days <= 60 && days > 0 && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                              {t("shared.daysLeft", { count: days })}
                            </Badge>
                          )}
                          {days !== -1 && days <= 0 && (
                            <Badge variant="destructive" className="text-[10px]">{t("shared.expired")}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { if (confirm(t("techShare.confirmDelete"))) deleteMut.mutate({ id: r.id }); }}
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
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? t("techShare.editRecord") : t("techShare.newRecordDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Holder & Share Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("techShare.holderRequired")}</Label>
                <Input value={form.holderName} onChange={e => setForm(f => ({ ...f, holderName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("techShare.typeRequired")}</Label>
                <Select value={form.shareType} onValueChange={v => setForm(f => ({ ...f, shareType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tech_share">{t("techShare.techShare")}</SelectItem>
                    <SelectItem value="rsa">{t("techShare.rsa")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Acquisition Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("techShare.acquireDateRequired")}</Label>
                <Input type="date" value={form.acquisitionDate} onChange={e => handleAcquisitionDateChange(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("techShare.sharesRequired")}</Label>
                <Input type="number" value={form.sharesAcquired} onChange={e => setForm(f => ({ ...f, sharesAcquired: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("techShare.acquireFmvLabel")}</Label>
                <Input type="number" step="0.0001" value={form.acquisitionFmv} onChange={e => setForm(f => ({ ...f, acquisitionFmv: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("techShare.paidAmount")}</Label>
                <Input type="number" step="0.01" value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} />
              </div>
            </div>

            {/* Deferral Section */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox" id="isDeferral"
                  checked={form.isDeferralEligible}
                  onChange={e => handleDeferralEligibleChange(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="isDeferral" className="font-medium">{t("techShare.deferralCheckbox")}</Label>
              </div>

              {form.isDeferralEligible && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1.5">
                    <Label>{t("techShare.deferralStart")}</Label>
                    <Input
                      type="date"
                      value={form.deferralStartDate}
                      onChange={e => setForm(f => ({ ...f, deferralStartDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("techShare.deferralExpiry")}</Label>
                    <Input
                      type="date"
                      value={form.deferralExpiryDate}
                      onChange={e => setForm(f => ({ ...f, deferralExpiryDate: e.target.value }))}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox" id="holdingPeriod"
                  checked={form.holdingPeriodMet}
                  onChange={e => setForm(f => ({ ...f, holdingPeriodMet: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="holdingPeriod" className="text-sm">{t("techShare.holdingPeriodMet")}</Label>
              </div>
            </div>

            {/* RSA Vesting Section */}
            {form.shareType === "rsa" && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">{t("techShare.vestingInfo")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("techShare.vestingDate")}</Label>
                    <Input type="date" value={form.vestingDate} onChange={e => setForm(f => ({ ...f, vestingDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("techShare.vestingFmv")}</Label>
                    <Input type="number" step="0.0001" value={form.vestingFmv} onChange={e => setForm(f => ({ ...f, vestingFmv: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            {/* Disposition Section */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">{t("techShare.dispositionInfo")}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("techShare.dispositionDate")}</Label>
                  <Input type="date" value={form.dispositionDate} onChange={e => setForm(f => ({ ...f, dispositionDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("techShare.dispositionFmv")}</Label>
                  <Input type="number" step="0.0001" value={form.dispositionFmv} onChange={e => setForm(f => ({ ...f, dispositionFmv: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("techShare.dispositionType")}</Label>
                  <Select value={form.dispositionType} onValueChange={v => setForm(f => ({ ...f, dispositionType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">{t("techShare.sale")}</SelectItem>
                      <SelectItem value="donation">{t("techShare.gift")}</SelectItem>
                      <SelectItem value="transfer">{t("techShare.transfer")}</SelectItem>
                      <SelectItem value="other">{t("techShare.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Tax Filing Section */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">{t("techShare.taxFiling")}</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-1.5">
                  <Label>{t("techShare.taxStatus")}</Label>
                  <Select value={form.taxStatus} onValueChange={v => setForm(f => ({ ...f, taxStatus: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deferred">{t("techShare.deferred")}</SelectItem>
                      <SelectItem value="taxable">{t("techShare.taxable")}</SelectItem>
                      <SelectItem value="filed">{t("techShare.filed")}</SelectItem>
                      <SelectItem value="exempt">{t("techShare.exempt")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("techShare.filingDeadline")}</Label>
                  <Input type="date" value={form.filingDeadline} onChange={e => setForm(f => ({ ...f, filingDeadline: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("techShare.filingDate")}</Label>
                  <Input type="date" value={form.filingDate} onChange={e => setForm(f => ({ ...f, filingDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("techShare.filingRef")}</Label>
                  <Input value={form.filingReference} onChange={e => setForm(f => ({ ...f, filingReference: e.target.value }))} placeholder={t("techShare.filingRefPlaceholder")} />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t pt-4">
              <div className="space-y-1.5">
                <Label>{t("shared.notes")}</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("shared.cancel")}</Button>
            <Button
              onClick={handleSave}
              disabled={!form.holderName || !form.acquisitionDate || createMut.isPending || updateMut.isPending}
            >
              {editId ? t("techShare.saveChanges") : t("shared.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
