import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Rocket, ArrowRight } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import ErrorState from "@/components/ErrorState";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function V1RoundsPage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="fundraising.rounds">
        <V1RoundsContent />
      </FeatureGate>
    </DashboardLayout>
  );
}

type RoundStatus = "completed" | "projected" | "bridge";

type RoundForm = {
  name: string;
  roundDate: string;
  pricePerShareNtd: string;
  moneyRaisedNtd: string;
  preMoneyValuationNtd: string;
  postMoneyValuationNtd: string;
  status: RoundStatus;
  notes: string;
};

const EMPTY_FORM: RoundForm = {
  name: "",
  roundDate: "",
  pricePerShareNtd: "",
  moneyRaisedNtd: "",
  preMoneyValuationNtd: "",
  postMoneyValuationNtd: "",
  status: "projected",
  notes: "",
};

function statusBadge(status: RoundStatus, t: (key: string) => string) {
  if (status === "completed")
    return <Badge className="bg-green-100 text-green-700 border-transparent">{t("rounds.completed")}</Badge>;
  if (status === "bridge")
    return <Badge className="bg-orange-100 text-orange-700 border-transparent">{t("rounds.bridge")}</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-transparent">{t("rounds.projected")}</Badge>;
}

function V1RoundsContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("fundraising");
  const [, setLocation] = useLocation();
  const { canEdit, canDelete } = usePermissions();
  const { formatAmount } = useCurrency();
  const utils = trpc.useUtils();
  const { data: rounds, isLoading, isError, refetch } = trpc.fundingRounds.list.useQuery();

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<RoundForm>(EMPTY_FORM);

  const createMut = trpc.fundingRounds.create.useMutation({
    onSuccess: () => {
      utils.fundingRounds.list.invalidate();
      toast.success(t("rounds.roundCreated"));
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.fundingRounds.update.useMutation({
    onSuccess: () => {
      utils.fundingRounds.list.invalidate();
      toast.success(t("rounds.roundUpdated"));
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.fundingRounds.delete.useMutation({
    onSuccess: () => {
      utils.fundingRounds.list.invalidate();
      toast.success(t("rounds.roundDeleted"));
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(r: NonNullable<typeof rounds>[number], e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditId(r.id);
    setForm({
      name: r.name ?? "",
      roundDate: r.roundDate ? String(r.roundDate).slice(0, 10) : "",
      pricePerShareNtd: r.pricePerShareNtd ?? "",
      moneyRaisedNtd: r.moneyRaisedNtd ?? "",
      preMoneyValuationNtd: r.preMoneyValuationNtd ?? "",
      postMoneyValuationNtd: r.postMoneyValuationNtd ?? "",
      status: (r.status as RoundStatus) ?? "projected",
      notes: r.notes ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error(t("rounds.nameRequiredError"));
      return;
    }
    const payload = {
      name: form.name.trim(),
      roundDate: form.roundDate || undefined,
      pricePerShareNtd: form.pricePerShareNtd || undefined,
      moneyRaisedNtd: form.moneyRaisedNtd || undefined,
      preMoneyValuationNtd: form.preMoneyValuationNtd || undefined,
      postMoneyValuationNtd: form.postMoneyValuationNtd || undefined,
      status: form.status,
      notes: form.notes || undefined,
    };
    if (editId != null) {
      updateMut.mutate({ id: editId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function handleDelete(r: NonNullable<typeof rounds>[number], e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(t("rounds.deleteConfirm", { name: r.name }))) return;
    deleteMut.mutate({ id: r.id });
  }

  const sorted = rounds ?? [];
  const isEmpty = !isLoading && sorted.length === 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Rocket className="h-7 w-7 text-primary" />
            {tPages("rounds.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tPages("rounds.desc")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CurrencyToggle />
          {canEdit && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> {t("rounds.newRound")}
            </Button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("rounds.allRounds")}</CardTitle>
              <CardDescription>
                {t("rounds.roundCount", { count: sorted.length })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {t("rounds.loading")}
            </div>
          ) : isEmpty ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-muted-foreground text-sm">
                {t("rounds.emptyState")}{". "}{t("rounds.emptyDesc")}
              </p>
              {canEdit && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> {t("rounds.newRound")}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("rounds.name")}</TableHead>
                    <TableHead>{t("rounds.date")}</TableHead>
                    <TableHead className="text-right">{t("rounds.pricePerShare")}</TableHead>
                    <TableHead className="text-right">{t("rounds.raised")}</TableHead>
                    <TableHead className="text-right">{t("rounds.preMoney")}</TableHead>
                    <TableHead className="text-right font-semibold">{t("rounds.postMoney")}</TableHead>
                    <TableHead>{t("rounds.status")}</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => {
                    const postMoney = (r as any).postMoneyCalc ?? parseFloat(r.postMoneyValuationNtd || "0");
                    const raised = parseFloat(r.moneyRaisedNtd || "0");
                    const preMoney = postMoney > 0 && raised > 0 ? postMoney - raised : parseFloat(r.preMoneyValuationNtd || "0");
                    return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-secondary/30"
                      onClick={() => setLocation(`/funding-rounds/${r.id}`)}
                    >
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground ">
                        {formatDate(r.roundDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-mono">
                        {r.pricePerShareNtd
                          ? `NT$ ${Number(r.pricePerShareNtd).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(r.moneyRaisedNtd)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {preMoney > 0 ? formatAmount(preMoney) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {postMoney > 0 ? formatAmount(postMoney) : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(r.status as RoundStatus, t)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => openEdit(r, e)}
                              title={t("rounds.edit")}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => handleDelete(r, e)}
                              title={t("rounds.delete")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/funding-rounds/${r.id}`);
                            }}
                            title={t("rounds.view")}
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
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
      <Dialog open={dialogOpen} onOpenChange={(v) => (v ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId != null ? t("rounds.editDialog") : t("rounds.newDialog")}
            </DialogTitle>
            <DialogDescription>
              {editId != null
                ? t("rounds.editDesc")
                : t("rounds.newDialogDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("rounds.nameRequired")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("rounds.namePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("rounds.roundDate")}</Label>
              <Input
                type="date"
                value={form.roundDate}
                onChange={(e) => setForm((f) => ({ ...f, roundDate: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("rounds.status")}</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as RoundStatus }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="projected">{t("rounds.projected")}</SelectItem>
                  <SelectItem value="bridge">{t("rounds.bridge")}</SelectItem>
                  <SelectItem value="completed">{t("rounds.completed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("rounds.preMoneyVal")}</Label>
              <Input
                type="number"
                value={form.preMoneyValuationNtd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, preMoneyValuationNtd: e.target.value }))
                }
                placeholder={t("rounds.preMoneyPlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("rounds.postMoneyVal")}</Label>
              <Input
                type="number"
                value={form.postMoneyValuationNtd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, postMoneyValuationNtd: e.target.value }))
                }
                placeholder={t("rounds.postMoneyPlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("rounds.pricePerShareVal")}</Label>
              <Input
                type="number"
                value={form.pricePerShareNtd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pricePerShareNtd: e.target.value }))
                }
                placeholder={t("rounds.pricePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("rounds.moneyRaised")}</Label>
              <Input
                type="number"
                value={form.moneyRaisedNtd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, moneyRaisedNtd: e.target.value }))
                }
                placeholder={t("rounds.raisedPlaceholder")}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("rounds.notes")}</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("rounds.notesPlaceholder")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeDialog}>
              {t("rounds.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending || !form.name.trim()}
            >
              {editId != null ? t("rounds.saveChanges") : t("rounds.createRound")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
