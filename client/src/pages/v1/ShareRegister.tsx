import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, UserPen, Edit2, FileSpreadsheet, Award } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorState from "@/components/ErrorState";
import { trpc } from "@/lib/trpc";
import { getActiveCompanyId } from "@/lib/activeCompany";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import AllocationDialog, {
  type AllocationRow,
} from "@/components/v1/AllocationDialog";
import {
  ALLOCATION_STATUSES,
  statusIndex,
  type AllocationStatus,
} from "@shared/allocationLifecycle";

export default function V1ShareRegisterPage() {
  return (
    <DashboardLayout>
      <V1ShareRegisterContent />
    </DashboardLayout>
  );
}

type RegisterEventType =
  | "issuance"
  | "transfer_in"
  | "transfer_out"
  | "cancellation"
  | "reversal";

function eventTypeBadge(t: RegisterEventType) {
  const map: Record<RegisterEventType, string> = {
    issuance: "bg-green-100 text-green-700 border-transparent",
    transfer_in: "bg-blue-100 text-blue-700 border-transparent",
    transfer_out: "bg-orange-100 text-orange-700 border-transparent",
    cancellation: "bg-red-100 text-red-700 border-transparent",
    reversal: "bg-amber-100 text-amber-700 border-transparent",
  };
  return (
    <Badge className={map[t]}>
      {t.replace(/_/g, " ")}
    </Badge>
  );
}

function allocationStatusBadge(status: AllocationStatus) {
  const map: Record<AllocationStatus, string> = {
    planned: "bg-slate-100 text-slate-700 border-transparent",
    committed: "bg-blue-100 text-blue-700 border-transparent",
    signed: "bg-indigo-100 text-indigo-700 border-transparent",
    funded: "bg-amber-100 text-amber-700 border-transparent",
    issued: "bg-green-100 text-green-700 border-transparent",
  };
  return <Badge className={map[status]}>{status}</Badge>;
}

function V1ShareRegisterContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("equity");
  const { data: entries, isLoading: entriesLoading, isError: entriesError, refetch: refetchEntries } =
    trpc.v1.register.list.useQuery();
  const { data: allocations, isLoading: allocLoading, isError: allocError, refetch: refetchAlloc } =
    trpc.v1.allocations.list.useQuery({});
  const { data: investors } = trpc.v1.investors.list.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();
  const { canEdit } = usePermissions();
  const { formatAmount, formatPrice } = useCurrency();
  const utils = trpc.useUtils();

  const isError = entriesError || allocError;
  if (isError) {
    const refetch = () => {
      if (entriesError) refetchEntries();
      if (allocError) refetchAlloc();
    };
    return <ErrorState onRetry={refetch} />;
  }

  const [investorFilter, setInvestorFilter] = useState<string>("all");
  const [roundFilter, setRoundFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AllocationRow | null>(null);
  const [editingInvestorId, setEditingInvestorId] = useState<number | null>(null);

  const updateInvestor = trpc.v1.investors.update.useMutation({
    onSuccess: () => {
      utils.v1.investors.list.invalidate();
      utils.v1.capTable.current.invalidate();
      toast.success(t("register.investorUpdated"));
      setEditingInvestorId(null);
    },
    onError: (err) => toast.error(`${t("register.updateFailed")}: ${err.message}`),
  });

  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showIssuanceDialog, setShowIssuanceDialog] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);

  const updateEntry = trpc.v1.register.update.useMutation({
    onSuccess: () => {
      utils.v1.register.list.invalidate();
      utils.v1.capTable.current.invalidate();
      toast.success(t("register.entryUpdated"));
      setEditingEntryId(null);
    },
    onError: (err) => toast.error(`${t("register.updateFailed")}: ${err.message}`),
  });

  const writeRegister = trpc.v1.register.write.useMutation({
    onSuccess: (_, variables) => {
      utils.v1.register.list.invalidate();
      utils.v1.capTable.current.invalidate();
      utils.v1.snapshots.list.invalidate();
      const verb = variables.eventType === "issuance" ? t("register.issuance") : t("register.transferLabel");
      toast.success(`${verb} ${t("register.recordedSuccess")}`);
      setShowTransferDialog(false);
      setShowIssuanceDialog(false);
    },
    onError: (err) => toast.error(`${t("register.updateFailed")}: ${err.message}`),
  });

  const investorName = useMemo(() => {
    const m = new Map<number, string>();
    (investors ?? []).forEach((i) => m.set(i.id, i.name));
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [investors]);

  const roundName = useMemo(() => {
    const m = new Map<number, string>();
    (rounds ?? []).forEach((r) => m.set(r.id, r.name));
    return (id: number | null | undefined) =>
      id != null ? m.get(id) ?? `#${id}` : "—";
  }, [rounds]);

  const filteredEntries = useMemo(() => {
    const list = entries ?? [];
    return list.filter((r) => {
      if (investorFilter !== "all" && String(r.investorId) !== investorFilter)
        return false;
      return true;
    });
  }, [entries, investorFilter]);

  const filteredAllocations = useMemo(() => {
    const list = (allocations ?? []) as unknown as AllocationRow[];
    return list.filter((a) => {
      if (roundFilter !== "all" && String(a.fundingRoundId) !== roundFilter)
        return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [allocations, roundFilter, statusFilter]);

  function openEdit(a: AllocationRow) {
    setEditing(a);
    setDialogOpen(true);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            {tPages("register.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tPages("register.desc")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CurrencyToggle />
          <Button
            variant="outline" size="sm"
            onClick={() => window.open(`/api/export/share-register.xlsx?companyId=${getActiveCompanyId()}`, "_blank")}
            className="gap-1.5 text-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> {t("capTable.excel")}
          </Button>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowTransferDialog(true)}>
                {t("register.transferShares")}
              </Button>
              <Button size="sm" onClick={() => setShowIssuanceDialog(true)}>
                {t("register.newIssuance")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="register" className="space-y-6">
        <TabsList>
          <TabsTrigger value="register">{t("register.tabEntries")}</TabsTrigger>
          <TabsTrigger value="allocations">{t("register.tabAllocations")}</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Share Register ─────────────────────────────────────── */}
        <TabsContent value="register" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={investorFilter} onValueChange={setInvestorFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={t("register.filterByInvestor")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("register.allInvestors")}</SelectItem>
                {(investors ?? []).map((inv) => (
                  <SelectItem key={inv.id} value={String(inv.id)}>
                    {inv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("register.tabEntries")}</CardTitle>
              <CardDescription>
                {t("register.entryCount", { count: filteredEntries.length })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  {t("register.loading")}
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-muted-foreground text-sm">
                    {t("register.emptyEntries")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("register.emptyEntriesHint")}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("register.date")}</TableHead>
                        <TableHead>{t("register.investor")}</TableHead>
                        <TableHead>{t("register.status")}</TableHead>
                        <TableHead>{t("register.shareClass")}</TableHead>
                        <TableHead className="text-right">{t("register.shares")}</TableHead>
                        <TableHead className="text-right">{t("register.priceShare")}</TableHead>
                        <TableHead className="text-right">{t("register.totalValue")}</TableHead>
                        <TableHead>{t("register.registerEntry")}</TableHead>
                        {canEdit && <TableHead className="w-[80px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((r) => {
                        const sharesNum = Number(r.shares ?? 0);
                        const signClass =
                          sharesNum > 0
                            ? "text-green-700"
                            : sharesNum < 0
                            ? "text-red-700"
                            : "text-muted-foreground";
                        return (
                          <TableRow
                            key={r.id}
                            className="hover:bg-secondary/30"
                          >
                            <TableCell className="text-muted-foreground">
                              {formatDate(r.effectiveDate)}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1">
                                <span>{investorName(r.investorId)}</span>
                                {canEdit && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => setEditingInvestorId(r.investorId)}
                                    title={t("register.editInvestor")}
                                  >
                                    <UserPen className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {eventTypeBadge(r.eventType as RegisterEventType)}
                            </TableCell>
                            <TableCell className="capitalize ">
                              {String(r.shareClass).replace(/_/g, " ")}
                            </TableCell>
                            <TableCell
                              className={`text-right tabular-nums ${signClass}`}
                            >
                              {sharesNum > 0 ? "+" : ""}
                              {sharesNum.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-mono">
                              {formatPrice(r.pricePerShare)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatAmount(r.totalAmount)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {r.fundingRoundId != null ? (
                                <span>Round: {roundName(r.fundingRoundId)}</span>
                              ) : r.allocationId != null ? (
                                <span>Alloc #{r.allocationId}</span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            {canEdit && (
                              <TableCell>
                                <div className="flex items-center gap-0.5">
                                  {(r.eventType === "issuance" || r.eventType === "esop_exercise") && sharesNum > 0 && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        const params = new URLSearchParams({
                                          companyId: String(getActiveCompanyId()),
                                          investorId: String(r.investorId),
                                          shareClass: String(r.shareClass),
                                          shares: String(Math.abs(sharesNum)),
                                          effectiveDate: r.effectiveDate,
                                          registerEntryId: String(r.id),
                                          ...(r.pricePerShare ? { pricePerShare: r.pricePerShare } : {}),
                                          ...(r.currency ? { currency: r.currency } : {}),
                                        });
                                        window.open(`/api/export/certificate.pdf?${params}`, "_blank");
                                      }}
                                      title={t("register.downloadCert")}
                                      className="text-amber-600 hover:text-amber-700"
                                    >
                                      <Award className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setEditingEntryId(r.id)}
                                    title={t("register.editEntry")}
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: All Allocations ────────────────────────────────────── */}
        <TabsContent value="allocations" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={roundFilter} onValueChange={setRoundFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={t("register.filterByRound")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("register.allRounds")}</SelectItem>
                {(rounds ?? []).map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder={t("register.filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("register.allStatuses")}</SelectItem>
                {ALLOCATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("register.tabAllocations")}</CardTitle>
              <CardDescription>
                {t("register.allocationCount", { count: filteredAllocations.length })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allocLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  {t("register.loading")}
                </div>
              ) : filteredAllocations.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-muted-foreground text-sm">
                    {t("register.emptyAllocations")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("register.emptyAllocationsHint")}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("register.roundCol")}</TableHead>
                        <TableHead>{t("register.investor")}</TableHead>
                        <TableHead>{t("register.shareClass")}</TableHead>
                        <TableHead className="text-right">{t("register.amountCol")}</TableHead>
                        <TableHead className="text-right">{t("register.shares")}</TableHead>
                        <TableHead className="text-right">{t("register.priceShare")}</TableHead>
                        <TableHead>{t("register.status")}</TableHead>
                        <TableHead>{t("register.updatedCol")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAllocations
                        .slice()
                        .sort(
                          (a, b) =>
                            statusIndex(b.status) - statusIndex(a.status) ||
                            a.id - b.id
                        )
                        .map((a) => (
                          <TableRow
                            key={a.id}
                            className="cursor-pointer hover:bg-secondary/30"
                            onClick={() => openEdit(a)}
                          >
                            <TableCell className="text-muted-foreground">
                              {roundName(a.fundingRoundId)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {investorName(a.investorId)}
                            </TableCell>
                            <TableCell className="capitalize ">
                              {a.shareClass.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {a.amount
                                ? `${a.currency} ${Number(
                                    a.amount
                                  ).toLocaleString()}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {a.sharesAllocated != null
                                ? a.sharesAllocated.toLocaleString()
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-mono">
                              {a.pricePerShare
                                ? `${a.currency} ${Number(
                                    a.pricePerShare
                                  ).toLocaleString(undefined, {
                                    maximumFractionDigits: 4,
                                  })}`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {allocationStatusBadge(a.status)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {(a as any).updatedAt
                                ? formatDate((a as any).updatedAt)
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Allocation edit dialog */}
      {editing && (
        <AllocationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          roundId={editing.fundingRoundId}
          allocation={editing}
        />
      )}

      {/* Entry edit dialog */}
      {editingEntryId != null && (
        <EntryEditDialog
          entryId={editingEntryId}
          entries={entries ?? []}
          open={editingEntryId != null}
          onOpenChange={(open) => { if (!open) setEditingEntryId(null); }}
          onSave={(id, data) => updateEntry.mutate({ id, data })}
          saving={updateEntry.isPending}
        />
      )}

      {/* Investor edit dialog */}
      {editingInvestorId != null && (
        <InvestorEditDialog
          investorId={editingInvestorId}
          investors={investors ?? []}
          open={editingInvestorId != null}
          onOpenChange={(open) => { if (!open) setEditingInvestorId(null); }}
          onSave={(id, data) => updateInvestor.mutate({ id, data })}
          saving={updateInvestor.isPending}
        />
      )}

      {/* Transfer dialog */}
      <RegisterWriteDialog
        mode="transfer"
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        investors={investors ?? []}
        rounds={rounds ?? []}
        onSubmit={(data) => writeRegister.mutate(data)}
        saving={writeRegister.isPending}
      />

      {/* New Issuance dialog */}
      <RegisterWriteDialog
        mode="issuance"
        open={showIssuanceDialog}
        onOpenChange={setShowIssuanceDialog}
        investors={investors ?? []}
        rounds={rounds ?? []}
        onSubmit={(data) => writeRegister.mutate(data)}
        saving={writeRegister.isPending}
      />
    </div>
  );
}

// ─── Investor Edit Dialog ────────────────────────────────────────────────────

type InvestorRow = {
  id: number;
  name: string;
  entityKind: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  aka: string | null;
  website: string | null;
  linkedinUrl: string | null;
  notes: string | null;
};

type InvestorUpdateData = {
  name?: string;
  entityKind?: "individual" | "entity";
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  aka?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
};

function InvestorEditDialog({
  investorId,
  investors,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  investorId: number;
  investors: InvestorRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: number, data: InvestorUpdateData) => void;
  saving: boolean;
}) {
  const { t } = useTranslation("equity");
  const investor = investors.find((i) => i.id === investorId);

  const [name, setName] = useState(investor?.name ?? "");
  const [aka, setAka] = useState(investor?.aka ?? "");
  const [entityKind, setEntityKind] = useState<"individual" | "entity">(
    (investor?.entityKind as "individual" | "entity") ?? "individual"
  );
  const [email, setEmail] = useState(investor?.email ?? "");
  const [phone, setPhone] = useState(investor?.phone ?? "");
  const [nationality, setNationality] = useState(investor?.nationality ?? "");
  const [website, setWebsite] = useState(investor?.website ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(investor?.linkedinUrl ?? "");
  const [notes, setNotes] = useState(investor?.notes ?? "");

  if (!investor) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(investorId, {
      name: name.trim(),
      entityKind,
      aka: aka.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      nationality: nationality.trim() || null,
      website: website.trim() || null,
      linkedinUrl: linkedinUrl.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("register.editInvestor")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">{t("register.name")} *</Label>
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-aka">{t("register.alias")}</Label>
              <Input id="inv-aka" value={aka} onChange={(e) => setAka(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-kind">{t("register.entityType")}</Label>
              <Select value={entityKind} onValueChange={(v) => setEntityKind(v as "individual" | "entity")}>
                <SelectTrigger id="inv-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">{t("register.individual")}</SelectItem>
                  <SelectItem value="entity">{t("register.entity")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-nationality">{t("register.nationality")}</Label>
              <Input id="inv-nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">{t("register.email")}</Label>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-phone">{t("register.phone")}</Label>
              <Input id="inv-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-website">{t("register.website")}</Label>
              <Input id="inv-website" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-linkedin">{t("register.linkedin")}</Label>
              <Input id="inv-linkedin" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-notes">{t("register.notes")}</Label>
            <Textarea id="inv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("register.cancel")}
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? t("register.saving") : t("register.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Register Write Dialog (Transfer / Issuance) ─────────────────────────────

// Fallback when share_classes table is empty (pre-migration).
// Only real share class types — funding round linkage is a separate dropdown.
const SHARE_CLASSES_FALLBACK = [
  "common", "preferred",
] as const;

type RegisterWriteInput = {
  investorId: number;
  eventType: "issuance" | "transfer_in" | "transfer_out" | "cancellation" | "reversal";
  shareClass: string;
  shares: number;
  effectiveDate: string;
  fundingRoundId?: number;
  pricePerShare?: string;
  currency?: string;
  totalAmount?: string;
  notes?: string;
};

function RegisterWriteDialog({
  mode,
  open,
  onOpenChange,
  investors,
  rounds,
  onSubmit,
  saving,
}: {
  mode: "transfer" | "issuance";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investors: { id: number; name: string }[];
  rounds: { id: number; name: string }[];
  onSubmit: (data: RegisterWriteInput) => void;
  saving: boolean;
}) {
  const { t } = useTranslation("equity");
  const { data: shareClassesDynamic } = trpc.shareClasses.list.useQuery();
  const SHARE_CLASSES = shareClassesDynamic && shareClassesDynamic.length > 0
    ? shareClassesDynamic.map((sc: any) => sc.slug)
    : [...SHARE_CLASSES_FALLBACK];

  const [investorId, setInvestorId] = useState("");
  const [toInvestorId, setToInvestorId] = useState("");
  const [shareClass, setShareClass] = useState<string>("common");
  const [shares, setShares] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [roundId, setRoundId] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [currency, setCurrency] = useState("NTD");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sharesNum = parseInt(shares, 10);
    if (!investorId || !sharesNum) return;

    const base = {
      shareClass: shareClass as RegisterWriteInput["shareClass"],
      shares: sharesNum,
      effectiveDate,
      fundingRoundId: roundId && roundId !== "none" ? parseInt(roundId, 10) : undefined,
      pricePerShare: pricePerShare || undefined,
      currency: currency || "NTD",
      totalAmount:
        pricePerShare && sharesNum
          ? String(Number(pricePerShare) * sharesNum)
          : undefined,
      notes: notes || undefined,
    };

    if (mode === "issuance") {
      onSubmit({
        ...base,
        investorId: parseInt(investorId, 10),
        eventType: "issuance",
      });
    } else {
      // Transfer: write transfer_out from source, then transfer_in to target
      // We submit transfer_out first; on success the caller can submit transfer_in
      // For simplicity, we create two entries via two calls
      onSubmit({
        ...base,
        investorId: parseInt(investorId, 10),
        eventType: "transfer_out",
      });
      if (toInvestorId) {
        // Queue the transfer_in after a tick so the first completes
        setTimeout(() => {
          onSubmit({
            ...base,
            investorId: parseInt(toInvestorId, 10),
            eventType: "transfer_in",
          });
        }, 500);
      }
    }
  }

  const isTransfer = mode === "transfer";
  const title = isTransfer ? t("register.transferShares") : t("register.newIssuance");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={isTransfer ? "grid grid-cols-2 gap-4" : ""}>
            <div className="space-y-1.5">
              <Label>{isTransfer ? t("register.fromInvestor") + " *" : t("register.investor") + " *"}</Label>
              <Select value={investorId} onValueChange={setInvestorId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("register.selectInvestor")} />
                </SelectTrigger>
                <SelectContent>
                  {investors.map((inv) => (
                    <SelectItem key={inv.id} value={String(inv.id)}>
                      {inv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isTransfer && (
              <div className="space-y-1.5">
                <Label>{t("register.toInvestor")} *</Label>
                <Select value={toInvestorId} onValueChange={setToInvestorId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("register.selectInvestor")} />
                  </SelectTrigger>
                  <SelectContent>
                    {investors
                      .filter((inv) => String(inv.id) !== investorId)
                      .map((inv) => (
                        <SelectItem key={inv.id} value={String(inv.id)}>
                          {inv.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("register.shareClassRequired")}</Label>
              <Select value={shareClass} onValueChange={setShareClass}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHARE_CLASSES.map((sc: string) => {
                    const scObj = shareClassesDynamic?.find((s: any) => s.slug === sc);
                    return (
                      <SelectItem key={sc} value={sc}>
                        {scObj ? scObj.name : sc.replace(/_/g, " ")}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("register.sharesRequired")}</Label>
              <Input
                type="number"
                min={1}
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("register.effectiveDateRequired")}</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("register.fundingRound")}</Label>
              <Select value={roundId} onValueChange={setRoundId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("register.optional")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("register.none")}</SelectItem>
                  {rounds.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("register.pricePerShare")}</Label>
              <Input
                type="number"
                step="0.0001"
                min={0}
                value={pricePerShare}
                onChange={(e) => setPricePerShare(e.target.value)}
                placeholder={t("register.optional")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("register.currency")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NTD">NTD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("register.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("register.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving || !investorId || !shares || (isTransfer && !toInvestorId)}
            >
              {saving ? t("register.recording") : isTransfer ? t("register.transfer") : t("register.issueShares")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Entry Edit Dialog ───────────────────────────────────────────────────────

const EVENT_TYPES = ["issuance", "transfer_in", "transfer_out", "cancellation", "reversal"] as const;

type EntryUpdateData = {
  effectiveDate?: string;
  eventType?: (typeof EVENT_TYPES)[number];
  shareClass?: string;
  shares?: number;
  pricePerShare?: string | null;
  currency?: string;
  totalAmount?: string | null;
  notes?: string | null;
};

function EntryEditDialog({
  entryId,
  entries,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  entryId: number;
  entries: { id: number; effectiveDate: string; eventType: string; shareClass: string; shares: number | null; pricePerShare: string | null; currency: string | null; totalAmount: string | null; notes: string | null }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: number, data: EntryUpdateData) => void;
  saving: boolean;
}) {
  const { t } = useTranslation("equity");
  const entry = entries.find((e) => e.id === entryId);
  const { data: shareClassesDynEdit } = trpc.shareClasses.list.useQuery();
  const SHARE_CLASSES = shareClassesDynEdit && shareClassesDynEdit.length > 0
    ? shareClassesDynEdit.map((sc: any) => sc.slug)
    : [...SHARE_CLASSES_FALLBACK];

  const [effectiveDate, setEffectiveDate] = useState(entry?.effectiveDate ?? "");
  const [eventType, setEventType] = useState(entry?.eventType ?? "issuance");
  const [shareClass, setShareClass] = useState(entry?.shareClass ?? "common");
  const [shares, setShares] = useState(String(Math.abs(Number(entry?.shares ?? 0))));
  const [pricePerShare, setPricePerShare] = useState(entry?.pricePerShare ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");

  if (!entry) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sharesNum = parseInt(shares, 10);
    if (!sharesNum) return;
    onSave(entryId, {
      effectiveDate: effectiveDate || undefined,
      eventType: eventType as EntryUpdateData["eventType"],
      shareClass: shareClass as EntryUpdateData["shareClass"],
      shares: sharesNum,
      pricePerShare: pricePerShare || null,
      totalAmount: pricePerShare && sharesNum ? String(Number(pricePerShare) * sharesNum) : null,
      notes: notes || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("register.editEntry")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("register.effectiveDateRequired")}</Label>
              <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t("register.eventTypeRequired")}</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("register.shareClassRequired")}</Label>
              <Select value={shareClass} onValueChange={setShareClass}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHARE_CLASSES.map((sc: string) => {
                    const scObj = shareClassesDynEdit?.find((s: any) => s.slug === sc);
                    return (
                      <SelectItem key={sc} value={sc}>{scObj ? scObj.name : sc.replace(/_/g, " ")}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("register.sharesRequired")}</Label>
              <Input type="number" min={1} value={shares} onChange={(e) => setShares(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("register.pricePerShare")}</Label>
              <Input type="number" step="0.0001" min={0} value={pricePerShare} onChange={(e) => setPricePerShare(e.target.value)} placeholder={t("register.optional")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("register.totalAmount")}</Label>
              <Input
                type="text"
                readOnly
                value={pricePerShare && shares ? `${(Number(pricePerShare) * parseInt(shares, 10)).toLocaleString()}` : "—"}
                className="bg-muted"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("register.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("register.cancel")}</Button>
            <Button type="submit" disabled={saving || !shares}>
              {saving ? t("register.saving") : t("register.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
