/**
 * Share Transfers — secondary trading / share transfer records.
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { ArrowRightLeft, Plus, CheckCircle2, Clock, AlertTriangle, XCircle, Shield, Pencil, Trash2 } from "lucide-react";
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
  sellerInvestorId: string;
  buyerInvestorId: string;
  buyerName: string;
  buyerEmail: string;
  shareClass: string;
  shares: string;
  pricePerShare: string;
  totalPrice: string;
  currency: string;
  transferDate: string;
  status: string;
  hasRofr: boolean;
  rofrDeadline: string;
  boardApprovalDate: string;
  notes: string;
};

const emptyForm: FormData = {
  sellerInvestorId: "", buyerInvestorId: "", buyerName: "", buyerEmail: "",
  shareClass: "", shares: "", pricePerShare: "", totalPrice: "",
  currency: "USD", transferDate: "", status: "pending",
  hasRofr: false, rofrDeadline: "", boardApprovalDate: "", notes: "",
};

export default function ShareTransfersPage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="shareTransfers">
        <ShareTransfersContent />
      </FeatureGate>
    </DashboardLayout>
  );
}

function ShareTransfersContent() {
  const { t: tPage } = useTranslation("pages");
  const { t } = useTranslation("compliance");
  const utils = trpc.useUtils();
  const { data: transfers, isLoading, isError } = trpc.shareTransfers.list.useQuery();
  const { data: investors } = trpc.v1.investors.list.useQuery();
  const createMut = trpc.shareTransfers.create.useMutation({ onSuccess: () => { utils.shareTransfers.invalidate(); setDialogOpen(false); } });
  const updateMut = trpc.shareTransfers.update.useMutation({ onSuccess: () => { utils.shareTransfers.invalidate(); setDialogOpen(false); } });
  const deleteMut = trpc.shareTransfers.delete.useMutation({ onSuccess: () => utils.shareTransfers.invalidate() });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  // Status label map
  const STATUS_STYLE: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
    pending:      { label: t("transfers.pending"),      icon: Clock,         color: "bg-amber-100 text-amber-700 border-transparent" },
    rofr_notice:  { label: t("transfers.rofrNotice"),  icon: Shield,        color: "bg-blue-100 text-blue-700 border-transparent" },
    approved:     { label: t("transfers.approved"),     icon: CheckCircle2,  color: "bg-green-100 text-green-700 border-transparent" },
    completed:    { label: t("transfers.completed"),    icon: CheckCircle2,  color: "bg-emerald-100 text-emerald-700 border-transparent" },
    rejected:     { label: t("transfers.rejected"),     icon: XCircle,       color: "bg-red-100 text-red-700 border-transparent" },
  };

  // Investor lookup map
  const investorMap = useMemo(() => {
    if (!investors) return new Map<number, string>();
    return new Map(investors.map((inv: any) => [inv.id, inv.name]));
  }, [investors]);

  // Summary stats
  const stats = useMemo(() => {
    if (!transfers) return { total: 0, pending: 0, completed: 0 };
    return {
      total: transfers.length,
      pending: transfers.filter((t: any) => t.status === "pending" || t.status === "rofr_notice" || t.status === "approved").length,
      completed: transfers.filter((t: any) => t.status === "completed").length,
    };
  }, [transfers]);

  const openCreate = () => {
    setEditId(null);
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...emptyForm, transferDate: today });
    setDialogOpen(true);
  };

  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({
      sellerInvestorId: String(t.sellerInvestorId ?? ""),
      buyerInvestorId: String(t.buyerInvestorId ?? ""),
      buyerName: t.buyerName ?? "",
      buyerEmail: t.buyerEmail ?? "",
      shareClass: t.shareClass ?? "",
      shares: String(t.shares ?? ""),
      pricePerShare: t.pricePerShare ?? "",
      totalPrice: t.totalPrice ?? "",
      currency: t.currency ?? "USD",
      transferDate: t.transferDate ?? "",
      status: t.status ?? "pending",
      hasRofr: t.hasRofr ?? false,
      rofrDeadline: t.rofrDeadline ?? "",
      boardApprovalDate: t.boardApprovalDate ?? "",
      notes: t.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editId) {
      updateMut.mutate({
        id: editId,
        data: {
          buyerInvestorId: form.buyerInvestorId ? parseInt(form.buyerInvestorId) : undefined,
          buyerName: form.buyerName || undefined,
          buyerEmail: form.buyerEmail || undefined,
          shareClass: form.shareClass || undefined,
          shares: form.shares ? parseInt(form.shares) : undefined,
          pricePerShare: form.pricePerShare || undefined,
          totalPrice: form.totalPrice || undefined,
          currency: form.currency || undefined,
          transferDate: form.transferDate || undefined,
          status: form.status as any,
          hasRofr: form.hasRofr,
          rofrDeadline: form.rofrDeadline || undefined,
          boardApprovalDate: form.boardApprovalDate || undefined,
          notes: form.notes || undefined,
        },
      });
    } else {
      createMut.mutate({
        sellerInvestorId: parseInt(form.sellerInvestorId),
        buyerInvestorId: form.buyerInvestorId ? parseInt(form.buyerInvestorId) : undefined,
        buyerName: form.buyerName || undefined,
        buyerEmail: form.buyerEmail || undefined,
        shareClass: form.shareClass,
        shares: parseInt(form.shares) || 0,
        pricePerShare: form.pricePerShare || undefined,
        totalPrice: form.totalPrice || undefined,
        currency: form.currency || undefined,
        transferDate: form.transferDate,
        status: form.status as any,
        hasRofr: form.hasRofr,
        rofrDeadline: form.rofrDeadline || undefined,
        boardApprovalDate: form.boardApprovalDate || undefined,
        notes: form.notes || undefined,
      });
    }
  };

  // Auto-calculate total price
  const handlePriceChange = (field: "shares" | "pricePerShare", val: string) => {
    setForm(f => {
      const updated = { ...f, [field]: val };
      const s = parseFloat(field === "shares" ? val : f.shares);
      const p = parseFloat(field === "pricePerShare" ? val : f.pricePerShare);
      if (!isNaN(s) && !isNaN(p)) {
        updated.totalPrice = (s * p).toFixed(4);
      }
      return updated;
    });
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
            <ArrowRightLeft className="h-6 w-6 text-primary" /> {tPage("compliance.transfers.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tPage("compliance.transfers.desc")}
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> {t("transfers.newTransfer")}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("transfers.totalTransfers")}</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("transfers.inProgress")}</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("transfers.completed")}</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{stats.completed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transfers table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("transfers.recordsTitle")}</CardTitle>
          <CardDescription>{t("transfers.recordsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !transfers || transfers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("transfers.emptyState")}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("transfers.seller")}</TableHead>
                  <TableHead>{t("transfers.buyer")}</TableHead>
                  <TableHead>{t("transfers.shares")}</TableHead>
                  <TableHead>{t("transfers.price")}</TableHead>
                  <TableHead>{t("shared.date")}</TableHead>
                  <TableHead>{t("shared.status")}</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t: any) => {
                  const s = STATUS_STYLE[t.status] ?? STATUS_STYLE.pending;
                  const Icon = s.icon;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <p className="font-medium text-sm">
                          {investorMap.get(t.sellerInvestorId) ?? `Investor #${t.sellerInvestorId}`}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {t.buyerInvestorId
                              ? (investorMap.get(t.buyerInvestorId) ?? `Investor #${t.buyerInvestorId}`)
                              : t.buyerName || t("transfers.external")}
                          </p>
                          {t.buyerEmail && <p className="text-xs text-muted-foreground">{t.buyerEmail}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>
                          <p>{Number(t.shares).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{t.shareClass}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.pricePerShare
                          ? `${t.currency ?? "USD"} ${t.pricePerShare}${t("transfers.perShare")}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(t.transferDate)}</TableCell>
                      <TableCell>
                        <Badge className={`${s.color} gap-1 text-xs`}>
                          <Icon className="h-3 w-3" /> {s.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { if (confirm(t("transfers.confirmDelete"))) deleteMut.mutate({ id: t.id }); }}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? t("transfers.editDialog") : t("transfers.newDialog")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Seller / Buyer */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("transfers.sellerRequired")}</Label>
                <Select value={form.sellerInvestorId} onValueChange={v => setForm(f => ({ ...f, sellerInvestorId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("transfers.selectSeller")} /></SelectTrigger>
                  <SelectContent>
                    {investors?.map((inv: any) => (
                      <SelectItem key={inv.id} value={String(inv.id)}>{inv.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("transfers.buyerInvestor")}</Label>
                <Select value={form.buyerInvestorId} onValueChange={v => setForm(f => ({ ...f, buyerInvestorId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("transfers.selectBuyer")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t("transfers.externalBuyer")}</SelectItem>
                    {investors?.map((inv: any) => (
                      <SelectItem key={inv.id} value={String(inv.id)}>{inv.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* External buyer info */}
            {!form.buyerInvestorId && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("transfers.buyerName")}</Label>
                  <Input value={form.buyerName} onChange={e => setForm(f => ({ ...f, buyerName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("transfers.buyerEmail")}</Label>
                  <Input type="email" value={form.buyerEmail} onChange={e => setForm(f => ({ ...f, buyerEmail: e.target.value }))} />
                </div>
              </div>
            )}

            {/* Shares + Class */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("transfers.shareClass")}</Label>
                <Input value={form.shareClass} onChange={e => setForm(f => ({ ...f, shareClass: e.target.value }))} placeholder={t("transfers.shareClassPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("transfers.sharesRequired")}</Label>
                <Input type="number" value={form.shares} onChange={e => handlePriceChange("shares", e.target.value)} />
              </div>
            </div>

            {/* Price */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("transfers.pricePerShare")}</Label>
                <Input type="number" step="0.0001" value={form.pricePerShare} onChange={e => handlePriceChange("pricePerShare", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("transfers.totalPrice")}</Label>
                <Input type="number" step="0.01" value={form.totalPrice} onChange={e => setForm(f => ({ ...f, totalPrice: e.target.value }))} />
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
            </div>

            {/* Date + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("transfers.transferDate")}</Label>
                <Input type="date" value={form.transferDate} onChange={e => setForm(f => ({ ...f, transferDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("shared.status")}</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t("transfers.pending")}</SelectItem>
                    <SelectItem value="rofr_notice">{t("transfers.rofrNotice")}</SelectItem>
                    <SelectItem value="approved">{t("transfers.approved")}</SelectItem>
                    <SelectItem value="completed">{t("transfers.completed")}</SelectItem>
                    <SelectItem value="rejected">{t("transfers.rejected")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ROFR + Board */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasRofr"
                    checked={form.hasRofr}
                    onChange={e => setForm(f => ({ ...f, hasRofr: e.target.checked }))}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="hasRofr" className="text-sm">{t("transfers.rofrApplicable")}</Label>
                </div>
                {form.hasRofr && (
                  <div className="mt-2 space-y-1.5">
                    <Label className="text-xs">{t("transfers.rofrDeadline")}</Label>
                    <Input type="date" value={form.rofrDeadline} onChange={e => setForm(f => ({ ...f, rofrDeadline: e.target.value }))} />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t("transfers.boardApprovalDate")}</Label>
                <Input type="date" value={form.boardApprovalDate} onChange={e => setForm(f => ({ ...f, boardApprovalDate: e.target.value }))} />
              </div>
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
              disabled={!form.sellerInvestorId || !form.shareClass || !form.shares || !form.transferDate || createMut.isPending || updateMut.isPending}
            >
              {editId ? t("shared.save") : t("shared.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
