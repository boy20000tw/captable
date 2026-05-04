import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link } from "wouter";
import { Plus, Edit2, Trash2, Briefcase, Play, ChevronDown, ChevronUp, Banknote } from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";
import ErrorState from "@/components/ErrorState";
import { VestingTimeline } from "@/components/v1/VestingTimeline";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatDate, formatNumber } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
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
  DialogFooter,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function EsopV1Page() {
  return (
    <DashboardLayout>
      <EsopV1Content />
    </DashboardLayout>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────
type GrantStatus = "active" | "fully_vested" | "exercised" | "cancelled" | "settled";
type GrantType = "option" | "rsu";

function grantStatusBadge(status: GrantStatus, t: any) {
  const map: Record<GrantStatus, { cls: string; key: string }> = {
    active: { cls: "bg-blue-100 text-blue-700 border-transparent", key: "esop.active" },
    fully_vested: { cls: "bg-green-100 text-green-700 border-transparent", key: "esop.fullyVested" },
    exercised: { cls: "bg-purple-100 text-purple-700 border-transparent", key: "esop.exercised" },
    settled: { cls: "bg-indigo-100 text-indigo-700 border-transparent", key: "esop.settled" },
    cancelled: { cls: "bg-red-100 text-red-700 border-transparent", key: "esop.cancelled" },
  };
  const info = map[status];
  return <Badge className={info.cls}>{t(info.key)}</Badge>;
}

// ─── Vesting Calc ───────────────────────────────────────────────────────────
// Client-side projection: if today < start + cliff → 0 vested;
// else floor((months_since_start / totalMonths) * sharesGranted),
// capped at sharesGranted.
function computeVestedAsOfToday(
  sharesGranted: number,
  vestingStartDate: string | null | undefined,
  cliffMonths: number | null | undefined,
  totalMonths: number | null | undefined,
): number {
  if (!vestingStartDate || !totalMonths || totalMonths <= 0) return 0;
  const start = new Date(vestingStartDate);
  const today = new Date();
  if (isNaN(start.getTime())) return 0;
  const cliff = cliffMonths ?? 0;
  const monthsSinceStart =
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth()) +
    (today.getDate() >= start.getDate() ? 0 : -1);
  if (monthsSinceStart < cliff) return 0;
  const fraction = monthsSinceStart / totalMonths;
  const vested = Math.floor(fraction * sharesGranted);
  return Math.min(Math.max(vested, 0), sharesGranted);
}

// ─── Form shapes ────────────────────────────────────────────────────────────
type PoolForm = {
  name: string;
  totalShares: string;
  fundingRoundId: string; // "none" or numeric string
  notes: string;
};

const EMPTY_POOL_FORM: PoolForm = {
  name: "",
  totalShares: "",
  fundingRoundId: "none",
  notes: "",
};

type GrantForm = {
  grantType: GrantType;
  poolId: string;
  investorId: string;
  grantDate: string;
  sharesGranted: string;
  exercisePrice: string;
  currency: string;
  vestingStartDate: string;
  vestingCliffMonths: string;
  vestingTotalMonths: string;
  expiryDate: string;
  notes: string;
  fairMarketValue: string;
  // Edit-only extras
  sharesVested: string;
  sharesExercised: string;
  sharesCancelled: string;
  sharesSettled: string;
  status: GrantStatus;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_GRANT_FORM: GrantForm = {
  grantType: "option",
  poolId: "",
  investorId: "",
  grantDate: todayIso(),
  sharesGranted: "",
  exercisePrice: "",
  currency: "NTD",
  vestingStartDate: "",
  vestingCliffMonths: "12",
  vestingTotalMonths: "48",
  expiryDate: "",
  notes: "",
  fairMarketValue: "",
  sharesVested: "0",
  sharesExercised: "0",
  sharesCancelled: "0",
  sharesSettled: "0",
  status: "active",
};

// ─── Content ────────────────────────────────────────────────────────────────
function EsopV1Content() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("equity");
  const { canEdit, canDelete } = usePermissions();
  const utils = trpc.useUtils();

  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = trpc.v1.esop.poolSummary.useQuery();
  const { data: pools, isLoading: poolsLoading, isError: poolsError, refetch: refetchPools } = trpc.v1.esop.pools.useQuery();
  const { data: grants, isLoading: grantsLoading, isError: grantsError, refetch: refetchGrants } = trpc.v1.esop.grants.useQuery();
  const { data: investors } = trpc.v1.investors.list.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();

  const isError = summaryError || poolsError || grantsError;
  if (isError) {
    const refetch = () => {
      if (summaryError) refetchSummary();
      if (poolsError) refetchPools();
      if (grantsError) refetchGrants();
    };
    return <ErrorState onRetry={refetch} />;
  }

  // ─── Pool dialog state ────────────────────────────────────────────────────
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);
  const [editPoolId, setEditPoolId] = useState<number | null>(null);
  const [poolForm, setPoolForm] = useState<PoolForm>(EMPTY_POOL_FORM);

  // ─── Grant dialog state ───────────────────────────────────────────────────
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [editGrantId, setEditGrantId] = useState<number | null>(null);
  const [grantForm, setGrantForm] = useState<GrantForm>(EMPTY_GRANT_FORM);

  // ─── Tab state (Options / RSU) ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<GrantType>("option");

  // ─── RSU Settle dialog state ──────────────────────────────────────────────
  const [settleDialogGrant, setSettleDialogGrant] = useState<any | null>(null);
  const [settleShares, setSettleShares] = useState("");
  const [settleFmv, setSettleFmv] = useState("");

  // ─── Filters ──────────────────────────────────────────────────────────────
  const [poolFilter, setPoolFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ─── Mutations ────────────────────────────────────────────────────────────
  function invalidateAll() {
    utils.v1.esop.pools.invalidate();
    utils.v1.esop.grants.invalidate();
    utils.v1.esop.poolSummary.invalidate();
  }

  function invalidateWithRegister() {
    invalidateAll();
    utils.v1.register.list.invalidate();
  }

  const createPoolMut = trpc.v1.esop.createPool.useMutation({
    onSuccess: () => { invalidateAll(); toast.success(t("esop.poolCreated")); closePoolDialog(); },
    onError: (e) => toast.error(e.message),
  });
  const updatePoolMut = trpc.v1.esop.updatePool.useMutation({
    onSuccess: () => { invalidateAll(); toast.success(t("esop.poolUpdated")); closePoolDialog(); },
    onError: (e) => toast.error(e.message),
  });
  const deletePoolMut = trpc.v1.esop.deletePool.useMutation({
    onSuccess: () => { invalidateAll(); toast.success(t("esop.poolDeleted")); },
    onError: (e) => toast.error(e.message),
  });

  const createGrantMut = trpc.v1.esop.createGrant.useMutation({
    onSuccess: () => { invalidateAll(); toast.success(t("esop.grantCreated")); closeGrantDialog(); },
    onError: (e) => toast.error(e.message),
  });
  const updateGrantMut = trpc.v1.esop.updateGrant.useMutation({
    onSuccess: () => { invalidateAll(); toast.success(t("esop.grantUpdated")); closeGrantDialog(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteGrantMut = trpc.v1.esop.deleteGrant.useMutation({
    onSuccess: () => { invalidateAll(); toast.success(t("esop.grantDeleted")); },
    onError: (e) => toast.error(e.message),
  });
  const exerciseGrantMut = trpc.v1.esop.exerciseGrant.useMutation({
    onSuccess: () => { invalidateWithRegister(); setExerciseDialogGrant(null); toast.success(t("esop.grantExercisedFull")); },
    onError: (e) => toast.error(e.message),
  });
  const settleRsuMut = trpc.v1.esop.settleRsuVesting.useMutation({
    onSuccess: () => { invalidateWithRegister(); setSettleDialogGrant(null); toast.success(t("esop.rsuSettled")); },
    onError: (e) => toast.error(e.message),
  });

  // Exercise dialog state
  const [exerciseDialogGrant, setExerciseDialogGrant] = useState<any | null>(null);
  const [exerciseShares, setExerciseShares] = useState("");
  const [expandedGrantId, setExpandedGrantId] = useState<number | null>(null);

  // ─── Lookup helpers ───────────────────────────────────────────────────────
  const investorMap = useMemo(() => {
    const m = new Map<number, { id: number; name: string }>();
    (investors ?? []).forEach((i) => m.set(i.id, { id: i.id, name: i.name }));
    return m;
  }, [investors]);

  const poolMap = useMemo(() => {
    const m = new Map<number, { id: number; name: string; totalShares: number }>();
    (pools ?? []).forEach((p) => m.set(p.id, { id: p.id, name: p.name, totalShares: p.totalShares }));
    return m;
  }, [pools]);

  // Allocated per pool (granted - cancelled)
  const allocatedByPool = useMemo(() => {
    const m = new Map<number, number>();
    (grants ?? []).forEach((g) => {
      const cur = m.get(g.poolId) ?? 0;
      m.set(g.poolId, cur + g.sharesGranted - g.sharesCancelled);
    });
    return m;
  }, [grants]);

  const filteredGrants = useMemo(() => {
    const list = grants ?? [];
    return list.filter((g) => {
      // Filter by grant type (tab)
      const gType = (g as any).grantType ?? "option";
      if (gType !== activeTab) return false;
      if (poolFilter !== "all" && String(g.poolId) !== poolFilter) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      return true;
    });
  }, [grants, poolFilter, statusFilter, activeTab]);

  // ─── Pool dialog handlers ────────────────────────────────────────────────
  function openPoolCreate() {
    setEditPoolId(null);
    setPoolForm(EMPTY_POOL_FORM);
    setPoolDialogOpen(true);
  }

  function openPoolEdit(p: NonNullable<typeof pools>[number], e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditPoolId(p.id);
    setPoolForm({
      name: p.name ?? "",
      totalShares: String(p.totalShares ?? ""),
      fundingRoundId: p.fundingRoundId != null ? String(p.fundingRoundId) : "none",
      notes: p.notes ?? "",
    });
    setPoolDialogOpen(true);
  }

  function closePoolDialog() {
    setPoolDialogOpen(false);
    setEditPoolId(null);
    setPoolForm(EMPTY_POOL_FORM);
  }

  function handlePoolSubmit() {
    if (!poolForm.name.trim()) { toast.error(t("esop.poolNameRequired")); return; }
    const total = Number(poolForm.totalShares);
    if (!Number.isFinite(total) || total <= 0) { toast.error(t("esop.totalSharesPositive")); return; }
    const fundingRoundId = poolForm.fundingRoundId === "none" ? null : Number(poolForm.fundingRoundId);

    if (editPoolId != null) {
      updatePoolMut.mutate({
        id: editPoolId,
        data: {
          name: poolForm.name.trim(),
          totalShares: total,
          fundingRoundId,
          notes: poolForm.notes || null,
        },
      });
    } else {
      createPoolMut.mutate({
        name: poolForm.name.trim(),
        totalShares: total,
        fundingRoundId,
        notes: poolForm.notes || undefined,
      });
    }
  }

  function handlePoolDelete(p: NonNullable<typeof pools>[number], e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(t("esop.deletePoolConfirm", { name: p.name }))) return;
    deletePoolMut.mutate({ id: p.id });
  }

  // ─── Grant dialog handlers ───────────────────────────────────────────────
  function openGrantCreate() {
    setEditGrantId(null);
    setGrantForm({ ...EMPTY_GRANT_FORM, grantType: activeTab });
    setGrantDialogOpen(true);
  }

  function openGrantEdit(g: NonNullable<typeof grants>[number]) {
    setEditGrantId(g.id);
    setGrantForm({
      grantType: ((g as any).grantType as GrantType) ?? "option",
      poolId: String(g.poolId),
      investorId: String(g.investorId),
      grantDate: g.grantDate ?? todayIso(),
      sharesGranted: String(g.sharesGranted),
      exercisePrice: g.exercisePrice ?? "",
      currency: g.currency ?? "NTD",
      vestingStartDate: g.vestingStartDate ?? "",
      vestingCliffMonths: String(g.vestingCliffMonths ?? 12),
      vestingTotalMonths: String(g.vestingTotalMonths ?? 48),
      expiryDate: g.expiryDate ?? "",
      notes: g.notes ?? "",
      fairMarketValue: (g as any).fairMarketValue ?? "",
      sharesVested: String(g.sharesVested ?? 0),
      sharesExercised: String(g.sharesExercised ?? 0),
      sharesCancelled: String(g.sharesCancelled ?? 0),
      sharesSettled: String((g as any).sharesSettled ?? 0),
      status: (g.status as GrantStatus) ?? "active",
    });
    setGrantDialogOpen(true);
  }

  function closeGrantDialog() {
    setGrantDialogOpen(false);
    setEditGrantId(null);
    setGrantForm({ ...EMPTY_GRANT_FORM });
  }

  function handleGrantSubmit() {
    if (editGrantId != null) {
      // Edit mode
      const sv = Number(grantForm.sharesVested);
      const se = Number(grantForm.sharesExercised);
      const sc = Number(grantForm.sharesCancelled);
      const ss = Number(grantForm.sharesSettled);
      updateGrantMut.mutate({
        id: editGrantId,
        data: {
          sharesVested: Number.isFinite(sv) ? sv : undefined,
          sharesExercised: Number.isFinite(se) ? se : undefined,
          sharesCancelled: Number.isFinite(sc) ? sc : undefined,
          sharesSettled: Number.isFinite(ss) ? ss : undefined,
          exercisePrice: grantForm.exercisePrice || null,
          fairMarketValue: grantForm.fairMarketValue || null,
          vestingStartDate: grantForm.vestingStartDate || null,
          vestingCliffMonths: Number(grantForm.vestingCliffMonths) || undefined,
          vestingTotalMonths: Number(grantForm.vestingTotalMonths) || undefined,
          status: grantForm.status,
          expiryDate: grantForm.expiryDate || null,
          notes: grantForm.notes || null,
        },
      });
      return;
    }

    // Create mode
    if (!grantForm.poolId) { toast.error(t("esop.poolRequired")); return; }
    if (!grantForm.investorId) { toast.error(t("esop.investorRequired")); return; }
    if (!grantForm.grantDate) { toast.error(t("esop.grantDateRequired")); return; }
    const shares = Number(grantForm.sharesGranted);
    if (!Number.isFinite(shares) || shares <= 0) {
      toast.error(t("esop.sharesPositive"));
      return;
    }
    createGrantMut.mutate({
      poolId: Number(grantForm.poolId),
      investorId: Number(grantForm.investorId),
      grantDate: grantForm.grantDate,
      sharesGranted: shares,
      grantType: grantForm.grantType,
      exercisePrice: grantForm.grantType === "rsu" ? undefined : (grantForm.exercisePrice || undefined),
      currency: grantForm.currency || "NTD",
      vestingStartDate: grantForm.vestingStartDate || undefined,
      vestingCliffMonths: Number(grantForm.vestingCliffMonths) || 12,
      vestingTotalMonths: Number(grantForm.vestingTotalMonths) || 48,
      expiryDate: grantForm.grantType === "rsu" ? undefined : (grantForm.expiryDate || undefined),
      fairMarketValue: grantForm.grantType === "rsu" ? (grantForm.fairMarketValue || undefined) : undefined,
      notes: grantForm.notes || undefined,
    });
  }

  function handleGrantDelete(g: NonNullable<typeof grants>[number], e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(t("esop.deleteGrantConfirm"))) return;
    deleteGrantMut.mutate({ id: g.id });
  }

  // ─── Derived values ───────────────────────────────────────────────────────
  const hasPools = (pools?.length ?? 0) > 0;
  const noGrants = !grantsLoading && (grants?.length ?? 0) === 0;
  const noPools = !poolsLoading && !hasPools;

  // Vesting projection for edit dialog
  const liveVested = useMemo(() => {
    const shares = Number(grantForm.sharesGranted);
    if (!Number.isFinite(shares) || shares <= 0) return 0;
    return computeVestedAsOfToday(
      shares,
      grantForm.vestingStartDate || null,
      Number(grantForm.vestingCliffMonths) || 0,
      Number(grantForm.vestingTotalMonths) || 0,
    );
  }, [grantForm.sharesGranted, grantForm.vestingStartDate, grantForm.vestingCliffMonths, grantForm.vestingTotalMonths]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-primary" />
            {tPages("esop.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tPages("esop.desc")}
          </p>
        </div>
      </div>

      {/* Tab Switcher: Options / RSU */}
      <div className="flex items-center gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "option"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("option")}
        >
          {t("esop.tabOptions")}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "rsu"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("rsu")}
        >
          {t("esop.tabRsu")}
        </button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          title={t("esop.totalPool")}
          value={summaryLoading ? "…" : formatNumber(summary?.totalPool ?? 0)}
          subtitle={t("esop.totalPoolSub")}
        />
        <SummaryCard
          title={t("esop.allocated")}
          value={summaryLoading ? "…" : formatNumber(summary?.totalAllocated ?? 0)}
          subtitle={t("esop.allocatedSub")}
        />
        <SummaryCard
          title={t("esop.unallocated")}
          value={summaryLoading ? "…" : formatNumber(summary?.totalUnallocated ?? 0)}
          subtitle={t("esop.unallocatedSub")}
        />
        {activeTab === "option" ? (
          <SummaryCard
            title={t("esop.totalGrants")}
            value={summaryLoading ? "…" : formatNumber((summary as any)?.optionGrantCount ?? summary?.grantCount ?? 0)}
            subtitle={t("esop.totalGrantsSub")}
          />
        ) : (
          <SummaryCard
            title={t("esop.totalSettled")}
            value={summaryLoading ? "…" : formatNumber((summary as any)?.totalSettled ?? 0)}
            subtitle={t("esop.totalSettledSub")}
          />
        )}
      </div>

      {/* Pools */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("esop.poolsTitle")}</CardTitle>
              <CardDescription>
                {t("esop.poolCount", { count: pools?.length ?? 0 })}
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={openPoolCreate}>
                <Plus className="h-4 w-4 mr-1" /> {t("esop.newPool")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {poolsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t("esop.loading")}</div>
          ) : noPools ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("esop.noPoolEmpty")}
              </p>
              {canEdit && (
                <Button onClick={openPoolCreate}>
                  <Plus className="h-4 w-4 mr-1" /> {t("esop.newPool")}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("esop.poolName")}</TableHead>
                    <TableHead className="text-right">{t("esop.totalShares")}</TableHead>
                    <TableHead className="text-right">{t("esop.allocated")}</TableHead>
                    <TableHead className="text-right">{t("esop.unallocated")}</TableHead>
                    <TableHead>{t("esop.created")}</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pools ?? []).map((p) => {
                    const allocated = allocatedByPool.get(p.id) ?? 0;
                    const unallocated = p.totalShares - allocated;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{formatNumber(p.totalShares)}</TableCell>
                        <TableCell className="text-right">{formatNumber(allocated)}</TableCell>
                        <TableCell className="text-right">{formatNumber(unallocated)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.createdAt ? formatDate(p.createdAt) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canEdit && (
                              <Button size="icon" variant="ghost" onClick={(e) => openPoolEdit(p, e)} title="Edit">
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button size="icon" variant="ghost" onClick={(e) => handlePoolDelete(p, e)} title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
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

      {/* Grants — RSU tab wrapped with FeatureGate */}
      <MaybeFeatureGate active={activeTab === "rsu"}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>{t("esop.grantsTitle")}</CardTitle>
              <CardDescription>
                {t("esop.ofTotal", { filtered: filteredGrants.length, total: grants?.length ?? 0 })}
              </CardDescription>
            </div>
            {canEdit && (
              hasPools ? (
                <Button onClick={openGrantCreate}>
                  <Plus className="h-4 w-4 mr-1" /> {t("esop.newGrant")}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button disabled>
                        <Plus className="h-4 w-4 mr-1" /> {t("esop.newGrant")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t("esop.createPoolFirst")}</TooltipContent>
                </Tooltip>
              )
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={poolFilter} onValueChange={setPoolFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("esop.allPools")}</SelectItem>
                {(pools ?? []).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("esop.allStatuses")}</SelectItem>
                {([
                  { value: "active", label: t("esop.active") },
                  { value: "fully_vested", label: t("esop.fullyVested") },
                  ...(activeTab === "option"
                    ? [{ value: "exercised", label: t("esop.exercised") }]
                    : [{ value: "settled", label: t("esop.settled") }]),
                  { value: "cancelled", label: t("esop.cancelled") },
                ] as { value: string; label: string }[]).map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {grantsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t("esop.loading")}</div>
          ) : noGrants ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t("esop.noGrantsYet")}{hasPools ? ` ${t("esop.noGrantsCreate")}` : ` ${t("esop.noGrantsCreatePool")}`}
            </div>
          ) : filteredGrants.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t("esop.noGrantsFilter")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("esop.grantee")}</TableHead>
                    <TableHead>{t("esop.pool")}</TableHead>
                    <TableHead>{t("esop.grantDate")}</TableHead>
                    <TableHead className="text-right">{t("esop.granted")}</TableHead>
                    <TableHead className="text-right">{t("esop.vested")}</TableHead>
                    <TableHead className="text-right">{activeTab === "rsu" ? t("esop.delivered") : t("esop.exercised")}</TableHead>
                    <TableHead>{t("esop.status")}</TableHead>
                    <TableHead>{t("esop.vesting")}</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGrants.map((g) => {
                    const investor = investorMap.get(g.investorId);
                    const pool = poolMap.get(g.poolId);
                    const isExpanded = expandedGrantId === g.id;
                    return (
                      <React.Fragment key={g.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-secondary/30"
                        onClick={() => setExpandedGrantId(isExpanded ? null : g.id)}
                      >
                        <TableCell className="font-medium">
                          {investor?.name ?? `Investor #${g.investorId}`}
                        </TableCell>
                        <TableCell>{pool?.name ?? `Pool #${g.poolId}`}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {g.grantDate ? formatDate(g.grantDate) : "—"}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(g.sharesGranted)}</TableCell>
                        <TableCell className="text-right">{formatNumber(g.sharesVested)}</TableCell>
                        <TableCell className="text-right">
                          {activeTab === "rsu"
                            ? formatNumber((g as any).sharesSettled ?? 0)
                            : formatNumber(g.sharesExercised)}
                        </TableCell>
                        <TableCell>{grantStatusBadge(g.status as GrantStatus, t)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {t("esop.cliffVesting", { cliff: g.vestingCliffMonths ?? 0, total: g.vestingTotalMonths ?? 0 })}
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canEdit && g.status !== "cancelled" && g.status !== "exercised" && g.status !== "settled" && (
                              activeTab === "rsu" ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const settleable = g.sharesGranted - ((g as any).sharesSettled ?? 0) - g.sharesCancelled;
                                    setSettleShares(String(settleable));
                                    setSettleFmv((g as any).fairMarketValue ?? "");
                                    setSettleDialogGrant(g);
                                  }}
                                  title="Settle"
                                  className="text-indigo-600 hover:text-indigo-700"
                                >
                                  <Banknote className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const exercisable = g.sharesGranted - g.sharesExercised - g.sharesCancelled;
                                    setExerciseShares(String(exercisable));
                                  setExerciseDialogGrant(g);
                                }}
                                title="Exercise"
                                className="text-green-600 hover:text-green-700"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            )
                          )}
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); openGrantEdit(g); }}
                              title="Edit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="icon" variant="ghost" onClick={(e) => handleGrantDelete(g, e)} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/20 p-0">
                          <div className="px-6 py-4">
                            <VestingTimeline grant={g} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </MaybeFeatureGate>

      {/* Pool Dialog */}
      <Dialog open={poolDialogOpen} onOpenChange={(v) => (v ? setPoolDialogOpen(true) : closePoolDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editPoolId != null ? t("esop.editPool") : t("esop.newPoolDialog")}</DialogTitle>
            <DialogDescription>
              {editPoolId != null ? t("esop.updatePoolDetails") : t("esop.authorizeNewPool")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>{t("esop.poolName")} *</Label>
              <Input
                value={poolForm.name}
                onChange={(e) => setPoolForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 2025 Equity Incentive Plan"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("esop.totalShares")} *</Label>
              <Input
                type="number"
                min="1"
                value={poolForm.totalShares}
                onChange={(e) => setPoolForm((f) => ({ ...f, totalShares: e.target.value }))}
                placeholder="e.g. 1000000"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("esop.fundingRound")}</Label>
              <Select
                value={poolForm.fundingRoundId}
                onValueChange={(v) => setPoolForm((f) => ({ ...f, fundingRoundId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("esop.none")}</SelectItem>
                  {(rounds ?? []).map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("esop.notes")}</Label>
              <Textarea
                rows={3}
                value={poolForm.notes}
                onChange={(e) => setPoolForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePoolDialog}>{t("esop.cancel")}</Button>
            <Button
              onClick={handlePoolSubmit}
              disabled={createPoolMut.isPending || updatePoolMut.isPending || !poolForm.name.trim()}
            >
              {editPoolId != null ? t("esop.saveChanges") : t("esop.createPool")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Dialog */}
      <Dialog open={grantDialogOpen} onOpenChange={(v) => (v ? setGrantDialogOpen(true) : closeGrantDialog())}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editGrantId != null ? t("esop.editGrant") : t("esop.newGrantDialog")}</DialogTitle>
            <DialogDescription>
              {editGrantId != null
                ? t("esop.editGrantUpdateDesc")
                : t("esop.newGrantIssueDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Grant Type - locked on edit */}
            {editGrantId == null && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>{t("esop.grantType")} *</Label>
                <Select
                  value={grantForm.grantType}
                  onValueChange={(v) => setGrantForm((f) => ({ ...f, grantType: v as GrantType }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option">{t("esop.grantTypeOption")}</SelectItem>
                    <SelectItem value="rsu">{t("esop.grantTypeRsu")}</SelectItem>
                  </SelectContent>
                </Select>
                {grantForm.grantType === "rsu" && (
                  <p className="text-xs text-muted-foreground">{t("esop.rsuNoExercise")}</p>
                )}
              </div>
            )}

            {/* Pool - locked on edit */}
            <div className="space-y-1.5">
              <Label>{t("esop.pool")} *</Label>
              <Select
                value={grantForm.poolId}
                onValueChange={(v) => setGrantForm((f) => ({ ...f, poolId: v }))}
                disabled={editGrantId != null}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("esop.selectPool")} />
                </SelectTrigger>
                <SelectContent>
                  {(pools ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Investor - locked on edit */}
            <div className="space-y-1.5">
              <Label>{t("esop.granteeInvestor")} *</Label>
              <Select
                value={grantForm.investorId}
                onValueChange={(v) => setGrantForm((f) => ({ ...f, investorId: v }))}
                disabled={editGrantId != null}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("esop.selectInvestor")} />
                </SelectTrigger>
                <SelectContent>
                  {(investors ?? []).map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editGrantId == null && (
                <p className="text-xs text-muted-foreground">
                  {t("esop.addInvestorLink")}{" "}
                  <Link href="/investors" className="underline">
                    {t("esop.addNewInvestor")}
                  </Link>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("esop.grantDate")} *</Label>
              <Input
                type="date"
                value={grantForm.grantDate}
                onChange={(e) => setGrantForm((f) => ({ ...f, grantDate: e.target.value }))}
                disabled={editGrantId != null}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("esop.sharesGranted")} *</Label>
              <Input
                type="number"
                min="1"
                value={grantForm.sharesGranted}
                onChange={(e) => setGrantForm((f) => ({ ...f, sharesGranted: e.target.value }))}
                disabled={editGrantId != null}
              />
            </div>

            {grantForm.grantType === "option" && (
              <div className="space-y-1.5">
                <Label>{t("esop.exercisePriceLabel")}</Label>
                <Input
                  type="text"
                  value={grantForm.exercisePrice}
                  onChange={(e) => setGrantForm((f) => ({ ...f, exercisePrice: e.target.value }))}
                  placeholder={t("esop.perShare")}
                />
              </div>
            )}

            {grantForm.grantType === "rsu" && (
              <div className="space-y-1.5">
                <Label>{t("esop.fairMarketValue")}</Label>
                <Input
                  type="text"
                  value={grantForm.fairMarketValue}
                  onChange={(e) => setGrantForm((f) => ({ ...f, fairMarketValue: e.target.value }))}
                  placeholder={t("esop.fmvPerShare")}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("esop.currency")}</Label>
              <Input
                value={grantForm.currency}
                onChange={(e) => setGrantForm((f) => ({ ...f, currency: e.target.value }))}
                placeholder="NTD"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("esop.vestingStartDate")}</Label>
              <Input
                type="date"
                value={grantForm.vestingStartDate}
                onChange={(e) => setGrantForm((f) => ({ ...f, vestingStartDate: e.target.value }))}
                placeholder=""
              />
            </div>

            {grantForm.grantType === "option" && (
              <div className="space-y-1.5">
                <Label>{t("esop.expiryDate")}</Label>
                <Input
                  type="date"
                  value={grantForm.expiryDate}
                  onChange={(e) => setGrantForm((f) => ({ ...f, expiryDate: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("esop.cliffMonths")}</Label>
              <Input
                type="number"
                min="0"
                value={grantForm.vestingCliffMonths}
                onChange={(e) => setGrantForm((f) => ({ ...f, vestingCliffMonths: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("esop.totalVestingMonths")}</Label>
              <Input
                type="number"
                min="1"
                value={grantForm.vestingTotalMonths}
                onChange={(e) => setGrantForm((f) => ({ ...f, vestingTotalMonths: e.target.value }))}
              />
            </div>

            {/* Vesting projection */}
            <div className="md:col-span-2 rounded border border-dashed p-3 text-xs text-muted-foreground">
              {t("esop.projectedVested")}{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(liveVested)}
              </span>{" "}
              / {formatNumber(Number(grantForm.sharesGranted) || 0)}
            </div>

            {/* Edit-only status + actual numbers */}
            {editGrantId != null && (
              <>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>{t("esop.status")}</Label>
                  <Select
                    value={grantForm.status}
                    onValueChange={(v) => setGrantForm((f) => ({ ...f, status: v as GrantStatus }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {([
                          { value: "active", label: t("esop.active") },
                          { value: "fully_vested", label: t("esop.fullyVested") },
                          ...(grantForm.grantType === "rsu"
                            ? [{ value: "settled", label: t("esop.settled") }]
                            : [{ value: "exercised", label: t("esop.exercised") }]),
                          { value: "cancelled", label: t("esop.cancelled") },
                        ] as { value: string; label: string }[]).map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("esop.sharesVested")}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={grantForm.sharesVested}
                    onChange={(e) => setGrantForm((f) => ({ ...f, sharesVested: e.target.value }))}
                  />
                </div>

                {grantForm.grantType === "option" ? (
                  <div className="space-y-1.5">
                    <Label>{t("esop.sharesExercised")}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={grantForm.sharesExercised}
                      onChange={(e) => setGrantForm((f) => ({ ...f, sharesExercised: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>{t("esop.settledShares")}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={grantForm.sharesSettled}
                      onChange={(e) => setGrantForm((f) => ({ ...f, sharesSettled: e.target.value }))}
                    />
                  </div>
                )}

                <div className="space-y-1.5 md:col-span-2">
                  <Label>{t("esop.sharesCancelled")}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={grantForm.sharesCancelled}
                    onChange={(e) => setGrantForm((f) => ({ ...f, sharesCancelled: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("esop.notes")}</Label>
              <Textarea
                rows={3}
                value={grantForm.notes}
                onChange={(e) => setGrantForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeGrantDialog}>{t("esop.cancel")}</Button>
            <Button
              onClick={handleGrantSubmit}
              disabled={createGrantMut.isPending || updateGrantMut.isPending}
            >
              {editGrantId != null ? t("esop.saveChanges") : t("esop.createGrant")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RSU Settle Dialog */}
      <Dialog open={!!settleDialogGrant} onOpenChange={(v) => { if (!v) setSettleDialogGrant(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("esop.settleVesting")}</DialogTitle>
            <DialogDescription>
              {t("esop.settleDesc")}
            </DialogDescription>
          </DialogHeader>

          {settleDialogGrant && (() => {
            const g = settleDialogGrant;
            const totalSettled = (g as any).sharesSettled ?? 0;
            const settleable = g.sharesGranted - totalSettled - g.sharesCancelled;
            const vested = computeVestedAsOfToday(g.sharesGranted, g.vestingStartDate, g.vestingCliffMonths, g.vestingTotalMonths);
            const vestedSettleable = Math.max(0, vested - totalSettled);
            const requestedShares = Number(settleShares) || 0;
            const fmv = Number(settleFmv) || 0;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">{t("esop.grantee")}</p>
                    <p className="font-medium">{investorMap.get(g.investorId)?.name ?? `#${g.investorId}`}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t("esop.totalGranted")}</p>
                    <p className="font-medium">{formatNumber(g.sharesGranted)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t("esop.vestedToday")}</p>
                    <p className="font-medium text-green-600">{formatNumber(vested)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t("esop.settledShares")}</p>
                    <p className="font-medium">{formatNumber(totalSettled)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t("esop.settleable")}</p>
                    <p className="font-medium text-indigo-600">{formatNumber(vestedSettleable)}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("esop.sharesToSettle")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={settleable}
                    value={settleShares}
                    onChange={(e) => setSettleShares(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t("esop.fairMarketValue")} *</Label>
                  <Input
                    type="text"
                    value={settleFmv}
                    onChange={(e) => setSettleFmv(e.target.value)}
                    placeholder={t("esop.fmvPerShare")}
                  />
                </div>

                {requestedShares > 0 && fmv > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Banknote className="h-3 w-3" /> {t("esop.taxableIncome")}
                    </p>
                    <p className="text-lg font-semibold">
                      {grantForm.currency || "NTD"} {formatNumber(Math.round(fmv * requestedShares))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t("esop.taxFormula")}</p>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleDialogGrant(null)}>{t("esop.cancel")}</Button>
            <Button
              disabled={
                settleRsuMut.isPending ||
                !settleShares ||
                Number(settleShares) <= 0 ||
                !settleFmv ||
                Number(settleFmv) <= 0 ||
                Number(settleShares) > (settleDialogGrant ? settleDialogGrant.sharesGranted - ((settleDialogGrant as any).sharesSettled ?? 0) - settleDialogGrant.sharesCancelled : 0)
              }
              onClick={() => {
                if (!settleDialogGrant) return;
                settleRsuMut.mutate({
                  grantId: settleDialogGrant.id,
                  sharesToSettle: Number(settleShares),
                  fairMarketValue: settleFmv,
                });
              }}
            >
              {settleRsuMut.isPending ? t("esop.settling") : t("esop.settleAndDeliver")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exercise Dialog */}
      <Dialog open={!!exerciseDialogGrant} onOpenChange={(v) => { if (!v) setExerciseDialogGrant(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("esop.exerciseGrant")}</DialogTitle>
            <DialogDescription>
              {t("esop.exerciseDesc")}
            </DialogDescription>
          </DialogHeader>

          {exerciseDialogGrant && (() => {
            const g = exerciseDialogGrant;
            const exercisable = g.sharesGranted - g.sharesExercised - g.sharesCancelled;
            const vested = computeVestedAsOfToday(g.sharesGranted, g.vestingStartDate, g.vestingCliffMonths, g.vestingTotalMonths);
            const vestedExercisable = Math.max(0, vested - g.sharesExercised);
            const requestedShares = Number(exerciseShares) || 0;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">{t("esop.grantee")}</p>
                    <p className="font-medium">{investorMap.get(g.investorId)?.name ?? `#${g.investorId}`}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t("esop.exercisePriceLabel")}</p>
                    <p className="font-medium">{g.exercisePrice ? `${g.currency ?? "NTD"} ${g.exercisePrice}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t("esop.totalGranted")}</p>
                    <p className="font-medium">{formatNumber(g.sharesGranted)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t("esop.alreadyExercised")}</p>
                    <p className="font-medium">{formatNumber(g.sharesExercised)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t("esop.vestedToday")}</p>
                    <p className="font-medium text-green-600">{formatNumber(vested)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t("esop.exercisableNow")}</p>
                    <p className="font-medium text-green-600">{formatNumber(vestedExercisable)}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("esop.sharesToExercise")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={exercisable}
                    value={exerciseShares}
                    onChange={(e) => setExerciseShares(e.target.value)}
                  />
                  {requestedShares > vestedExercisable && requestedShares <= exercisable && (
                    <p className="text-xs text-amber-600">
                      {t("esop.unvestedWarning", { count: requestedShares - vestedExercisable })}
                    </p>
                  )}
                  {requestedShares > exercisable && (
                    <p className="text-xs text-red-600">
                      {t("esop.exceedWarning", { count: formatNumber(exercisable) })}
                    </p>
                  )}
                </div>

                {requestedShares > 0 && g.exercisePrice && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">{t("esop.totalExerciseCost")}</p>
                    <p className="text-lg font-semibold">
                      {g.currency ?? "NTD"} {formatNumber(Math.round(Number(g.exercisePrice) * requestedShares))}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExerciseDialogGrant(null)}>{t("esop.cancel")}</Button>
            <Button
              disabled={
                exerciseGrantMut.isPending ||
                !exerciseShares ||
                Number(exerciseShares) <= 0 ||
                Number(exerciseShares) > (exerciseDialogGrant ? exerciseDialogGrant.sharesGranted - exerciseDialogGrant.sharesExercised - exerciseDialogGrant.sharesCancelled : 0)
              }
              onClick={() => {
                if (!exerciseDialogGrant) return;
                exerciseGrantMut.mutate({
                  grantId: exerciseDialogGrant.id,
                  sharesToExercise: Number(exerciseShares),
                });
              }}
            >
              {exerciseGrantMut.isPending ? t("esop.exercising") : t("esop.exerciseAndIssue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Conditional FeatureGate wrapper ────────────────────────────────────────
function MaybeFeatureGate({ active, children }: { active: boolean; children: React.ReactNode }) {
  if (!active) return <>{children}</>;
  return <FeatureGate feature="equity.rsu">{children}</FeatureGate>;
}

// ─── KPI card helper ────────────────────────────────────────────────────────
function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wide">{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {subtitle && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </CardContent>
      )}
    </Card>
  );
}
