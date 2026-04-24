import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Plus, Edit2, Trash2, Briefcase, Play } from "lucide-react";
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
type GrantStatus = "active" | "fully_vested" | "exercised" | "cancelled";

const GRANT_STATUS_OPTIONS: { value: GrantStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "fully_vested", label: "Fully Vested" },
  { value: "exercised", label: "Exercised" },
  { value: "cancelled", label: "Cancelled" },
];

function grantStatusBadge(status: GrantStatus) {
  const map: Record<GrantStatus, { cls: string; label: string }> = {
    active: { cls: "bg-blue-100 text-blue-700 border-transparent", label: "Active" },
    fully_vested: { cls: "bg-green-100 text-green-700 border-transparent", label: "Fully Vested" },
    exercised: { cls: "bg-purple-100 text-purple-700 border-transparent", label: "Exercised" },
    cancelled: { cls: "bg-red-100 text-red-700 border-transparent", label: "Cancelled" },
  };
  const info = map[status];
  return <Badge className={info.cls}>{info.label}</Badge>;
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
  // Edit-only extras
  sharesVested: string;
  sharesExercised: string;
  sharesCancelled: string;
  status: GrantStatus;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_GRANT_FORM: GrantForm = {
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
  sharesVested: "0",
  sharesExercised: "0",
  sharesCancelled: "0",
  status: "active",
};

// ─── Content ────────────────────────────────────────────────────────────────
function EsopV1Content() {
  const { canEdit, canDelete } = usePermissions();
  const utils = trpc.useUtils();

  const { data: summary, isLoading: summaryLoading } = trpc.v1.esop.poolSummary.useQuery();
  const { data: pools, isLoading: poolsLoading } = trpc.v1.esop.pools.useQuery();
  const { data: grants, isLoading: grantsLoading } = trpc.v1.esop.grants.useQuery();
  const { data: investors } = trpc.v1.investors.list.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();

  // ─── Pool dialog state ────────────────────────────────────────────────────
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);
  const [editPoolId, setEditPoolId] = useState<number | null>(null);
  const [poolForm, setPoolForm] = useState<PoolForm>(EMPTY_POOL_FORM);

  // ─── Grant dialog state ───────────────────────────────────────────────────
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [editGrantId, setEditGrantId] = useState<number | null>(null);
  const [grantForm, setGrantForm] = useState<GrantForm>(EMPTY_GRANT_FORM);

  // ─── Filters ──────────────────────────────────────────────────────────────
  const [poolFilter, setPoolFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ─── Mutations ────────────────────────────────────────────────────────────
  function invalidateAll() {
    utils.v1.esop.pools.invalidate();
    utils.v1.esop.grants.invalidate();
    utils.v1.esop.poolSummary.invalidate();
  }

  const createPoolMut = trpc.v1.esop.createPool.useMutation({
    onSuccess: () => { invalidateAll(); toast.success("Pool created"); closePoolDialog(); },
    onError: (e) => toast.error(e.message),
  });
  const updatePoolMut = trpc.v1.esop.updatePool.useMutation({
    onSuccess: () => { invalidateAll(); toast.success("Pool updated"); closePoolDialog(); },
    onError: (e) => toast.error(e.message),
  });
  const deletePoolMut = trpc.v1.esop.deletePool.useMutation({
    onSuccess: () => { invalidateAll(); toast.success("Pool deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const createGrantMut = trpc.v1.esop.createGrant.useMutation({
    onSuccess: () => { invalidateAll(); toast.success("Grant created"); closeGrantDialog(); },
    onError: (e) => toast.error(e.message),
  });
  const updateGrantMut = trpc.v1.esop.updateGrant.useMutation({
    onSuccess: () => { invalidateAll(); toast.success("Grant updated"); closeGrantDialog(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteGrantMut = trpc.v1.esop.deleteGrant.useMutation({
    onSuccess: () => { invalidateAll(); toast.success("Grant deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const exerciseGrantMut = trpc.v1.esop.exerciseGrant.useMutation({
    onSuccess: () => { invalidateAll(); setExerciseDialogGrant(null); toast.success("Grant exercised — Common shares issued to register"); },
    onError: (e) => toast.error(e.message),
  });

  // Exercise dialog state
  const [exerciseDialogGrant, setExerciseDialogGrant] = useState<any | null>(null);
  const [exerciseShares, setExerciseShares] = useState("");

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
      if (poolFilter !== "all" && String(g.poolId) !== poolFilter) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      return true;
    });
  }, [grants, poolFilter, statusFilter]);

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
    if (!poolForm.name.trim()) { toast.error("Pool name is required"); return; }
    const total = Number(poolForm.totalShares);
    if (!Number.isFinite(total) || total <= 0) { toast.error("Total shares must be a positive number"); return; }
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
    if (!confirm(`Delete pool "${p.name}"? This cannot be undone.`)) return;
    deletePoolMut.mutate({ id: p.id });
  }

  // ─── Grant dialog handlers ───────────────────────────────────────────────
  function openGrantCreate() {
    setEditGrantId(null);
    setGrantForm({ ...EMPTY_GRANT_FORM });
    setGrantDialogOpen(true);
  }

  function openGrantEdit(g: NonNullable<typeof grants>[number]) {
    setEditGrantId(g.id);
    setGrantForm({
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
      sharesVested: String(g.sharesVested ?? 0),
      sharesExercised: String(g.sharesExercised ?? 0),
      sharesCancelled: String(g.sharesCancelled ?? 0),
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
      updateGrantMut.mutate({
        id: editGrantId,
        data: {
          sharesVested: Number.isFinite(sv) ? sv : undefined,
          sharesExercised: Number.isFinite(se) ? se : undefined,
          sharesCancelled: Number.isFinite(sc) ? sc : undefined,
          exercisePrice: grantForm.exercisePrice || null,
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
    if (!grantForm.poolId) { toast.error("Pool is required"); return; }
    if (!grantForm.investorId) { toast.error("Investor is required"); return; }
    if (!grantForm.grantDate) { toast.error("Grant date is required"); return; }
    const shares = Number(grantForm.sharesGranted);
    if (!Number.isFinite(shares) || shares <= 0) {
      toast.error("Shares granted must be a positive number");
      return;
    }
    createGrantMut.mutate({
      poolId: Number(grantForm.poolId),
      investorId: Number(grantForm.investorId),
      grantDate: grantForm.grantDate,
      sharesGranted: shares,
      exercisePrice: grantForm.exercisePrice || undefined,
      currency: grantForm.currency || "NTD",
      vestingStartDate: grantForm.vestingStartDate || undefined,
      vestingCliffMonths: Number(grantForm.vestingCliffMonths) || 12,
      vestingTotalMonths: Number(grantForm.vestingTotalMonths) || 48,
      expiryDate: grantForm.expiryDate || undefined,
      notes: grantForm.notes || undefined,
    });
  }

  function handleGrantDelete(g: NonNullable<typeof grants>[number], e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete this grant? This cannot be undone.`)) return;
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
            ESOP
          </h1>
          <p className="text-muted-foreground mt-1">
            Employee stock option pools and grants
          </p>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          title="Total Pool"
          value={summaryLoading ? "…" : formatNumber(summary?.totalPool ?? 0)}
          subtitle="Authorized shares"
        />
        <SummaryCard
          title="Allocated"
          value={summaryLoading ? "…" : formatNumber(summary?.totalAllocated ?? 0)}
          subtitle="Granted (net of cancelled)"
        />
        <SummaryCard
          title="Unallocated"
          value={summaryLoading ? "…" : formatNumber(summary?.totalUnallocated ?? 0)}
          subtitle="Available to grant"
        />
        <SummaryCard
          title="Total Grants"
          value={summaryLoading ? "…" : formatNumber(summary?.grantCount ?? 0)}
          subtitle="Active + cancelled"
        />
      </div>

      {/* Pools */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>ESOP Pools</CardTitle>
              <CardDescription>
                {pools?.length ?? 0} pool{(pools?.length ?? 0) === 1 ? "" : "s"}
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={openPoolCreate}>
                <Plus className="h-4 w-4 mr-1" /> New Pool
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {poolsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : noPools ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No pool yet. Create your first ESOP pool to start issuing grants.
              </p>
              {canEdit && (
                <Button onClick={openPoolCreate}>
                  <Plus className="h-4 w-4 mr-1" /> New Pool
                </Button>
              )}
            </div>
          ) : (
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Total Shares</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">Unallocated</TableHead>
                  <TableHead>Created</TableHead>
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
          )}
        </CardContent>
      </Card>

      {/* Grants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>ESOP Grants</CardTitle>
              <CardDescription>
                {filteredGrants.length} of {grants?.length ?? 0}
              </CardDescription>
            </div>
            {canEdit && (
              hasPools ? (
                <Button onClick={openGrantCreate}>
                  <Plus className="h-4 w-4 mr-1" /> New Grant
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button disabled>
                        <Plus className="h-4 w-4 mr-1" /> New Grant
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Create a pool first</TooltipContent>
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
                <SelectItem value="all">All pools</SelectItem>
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
                <SelectItem value="all">All statuses</SelectItem>
                {GRANT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {grantsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : noGrants ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No grants yet.{hasPools ? " Issue your first ESOP grant." : " Create a pool first."}
            </div>
          ) : filteredGrants.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No grants match the current filters.
            </div>
          ) : (
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Grantee</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead>Grant Date</TableHead>
                  <TableHead className="text-right">Granted</TableHead>
                  <TableHead className="text-right">Vested</TableHead>
                  <TableHead className="text-right">Exercised</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vesting</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrants.map((g) => {
                  const investor = investorMap.get(g.investorId);
                  const pool = poolMap.get(g.poolId);
                  return (
                    <TableRow
                      key={g.id}
                      className="cursor-pointer hover:bg-secondary/30"
                      onClick={() => openGrantEdit(g)}
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
                      <TableCell className="text-right">{formatNumber(g.sharesExercised)}</TableCell>
                      <TableCell>{grantStatusBadge(g.status as GrantStatus)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Cliff {g.vestingCliffMonths ?? 0}mo / Total {g.vestingTotalMonths ?? 0}mo
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && g.status !== "cancelled" && g.status !== "exercised" && (
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pool Dialog */}
      <Dialog open={poolDialogOpen} onOpenChange={(v) => (v ? setPoolDialogOpen(true) : closePoolDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editPoolId != null ? "Edit Pool" : "New ESOP Pool"}</DialogTitle>
            <DialogDescription>
              {editPoolId != null ? "Update pool details." : "Authorize a new ESOP pool for this company."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={poolForm.name}
                onChange={(e) => setPoolForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 2025 Equity Incentive Plan"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Total Shares *</Label>
              <Input
                type="number"
                min="1"
                value={poolForm.totalShares}
                onChange={(e) => setPoolForm((f) => ({ ...f, totalShares: e.target.value }))}
                placeholder="e.g. 1000000"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Funding Round (optional)</Label>
              <Select
                value={poolForm.fundingRoundId}
                onValueChange={(v) => setPoolForm((f) => ({ ...f, fundingRoundId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {(rounds ?? []).map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={poolForm.notes}
                onChange={(e) => setPoolForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePoolDialog}>Cancel</Button>
            <Button
              onClick={handlePoolSubmit}
              disabled={createPoolMut.isPending || updatePoolMut.isPending || !poolForm.name.trim()}
            >
              {editPoolId != null ? "Save Changes" : "Create Pool"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Dialog */}
      <Dialog open={grantDialogOpen} onOpenChange={(v) => (v ? setGrantDialogOpen(true) : closeGrantDialog())}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editGrantId != null ? "Edit Grant" : "New ESOP Grant"}</DialogTitle>
            <DialogDescription>
              {editGrantId != null
                ? "Update vesting, status, and exercise details."
                : "Issue an option grant from a pool to an investor/grantee."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pool - locked on edit */}
            <div className="space-y-1.5">
              <Label>Pool *</Label>
              <Select
                value={grantForm.poolId}
                onValueChange={(v) => setGrantForm((f) => ({ ...f, poolId: v }))}
                disabled={editGrantId != null}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select pool" />
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
              <Label>Grantee (Investor) *</Label>
              <Select
                value={grantForm.investorId}
                onValueChange={(v) => setGrantForm((f) => ({ ...f, investorId: v }))}
                disabled={editGrantId != null}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select investor" />
                </SelectTrigger>
                <SelectContent>
                  {(investors ?? []).map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editGrantId == null && (
                <p className="text-xs text-muted-foreground">
                  Can't find them?{" "}
                  <Link href="/investors" className="underline">
                    Add a new investor
                  </Link>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Grant Date *</Label>
              <Input
                type="date"
                value={grantForm.grantDate}
                onChange={(e) => setGrantForm((f) => ({ ...f, grantDate: e.target.value }))}
                disabled={editGrantId != null}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Shares Granted *</Label>
              <Input
                type="number"
                min="1"
                value={grantForm.sharesGranted}
                onChange={(e) => setGrantForm((f) => ({ ...f, sharesGranted: e.target.value }))}
                disabled={editGrantId != null}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Exercise Price</Label>
              <Input
                type="text"
                value={grantForm.exercisePrice}
                onChange={(e) => setGrantForm((f) => ({ ...f, exercisePrice: e.target.value }))}
                placeholder="per share"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input
                value={grantForm.currency}
                onChange={(e) => setGrantForm((f) => ({ ...f, currency: e.target.value }))}
                placeholder="NTD"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Vesting Start Date</Label>
              <Input
                type="date"
                value={grantForm.vestingStartDate}
                onChange={(e) => setGrantForm((f) => ({ ...f, vestingStartDate: e.target.value }))}
                placeholder="defaults to grant date"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={grantForm.expiryDate}
                onChange={(e) => setGrantForm((f) => ({ ...f, expiryDate: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cliff (months)</Label>
              <Input
                type="number"
                min="0"
                value={grantForm.vestingCliffMonths}
                onChange={(e) => setGrantForm((f) => ({ ...f, vestingCliffMonths: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Total Vesting (months)</Label>
              <Input
                type="number"
                min="1"
                value={grantForm.vestingTotalMonths}
                onChange={(e) => setGrantForm((f) => ({ ...f, vestingTotalMonths: e.target.value }))}
              />
            </div>

            {/* Vesting projection */}
            <div className="md:col-span-2 rounded border border-dashed p-3 text-xs text-muted-foreground">
              Projected vested as of today:{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(liveVested)}
              </span>{" "}
              / {formatNumber(Number(grantForm.sharesGranted) || 0)}
            </div>

            {/* Edit-only status + actual numbers */}
            {editGrantId != null && (
              <>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Status</Label>
                  <Select
                    value={grantForm.status}
                    onValueChange={(v) => setGrantForm((f) => ({ ...f, status: v as GrantStatus }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GRANT_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Shares Vested</Label>
                  <Input
                    type="number"
                    min="0"
                    value={grantForm.sharesVested}
                    onChange={(e) => setGrantForm((f) => ({ ...f, sharesVested: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Shares Exercised</Label>
                  <Input
                    type="number"
                    min="0"
                    value={grantForm.sharesExercised}
                    onChange={(e) => setGrantForm((f) => ({ ...f, sharesExercised: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label>Shares Cancelled</Label>
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
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={grantForm.notes}
                onChange={(e) => setGrantForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeGrantDialog}>Cancel</Button>
            <Button
              onClick={handleGrantSubmit}
              disabled={createGrantMut.isPending || updateGrantMut.isPending}
            >
              {editGrantId != null ? "Save Changes" : "Create Grant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exercise Dialog */}
      <Dialog open={!!exerciseDialogGrant} onOpenChange={(v) => { if (!v) setExerciseDialogGrant(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exercise Grant</DialogTitle>
            <DialogDescription>
              Exercise vested options → Common Stock issued to share register.
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
                    <p className="text-muted-foreground text-xs">Grantee</p>
                    <p className="font-medium">{investorMap.get(g.investorId)?.name ?? `#${g.investorId}`}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Exercise Price</p>
                    <p className="font-medium">{g.exercisePrice ? `${g.currency ?? "NTD"} ${g.exercisePrice}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Total Granted</p>
                    <p className="font-medium">{formatNumber(g.sharesGranted)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Already Exercised</p>
                    <p className="font-medium">{formatNumber(g.sharesExercised)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Vested (as of today)</p>
                    <p className="font-medium text-green-600">{formatNumber(vested)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Exercisable Now</p>
                    <p className="font-medium text-green-600">{formatNumber(vestedExercisable)}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Shares to Exercise</Label>
                  <Input
                    type="number"
                    min={1}
                    max={exercisable}
                    value={exerciseShares}
                    onChange={(e) => setExerciseShares(e.target.value)}
                  />
                  {requestedShares > vestedExercisable && requestedShares <= exercisable && (
                    <p className="text-xs text-amber-600">
                      Warning: {requestedShares - vestedExercisable} shares have not vested yet.
                    </p>
                  )}
                  {requestedShares > exercisable && (
                    <p className="text-xs text-red-600">
                      Cannot exceed {formatNumber(exercisable)} exercisable shares.
                    </p>
                  )}
                </div>

                {requestedShares > 0 && g.exercisePrice && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Total Exercise Cost</p>
                    <p className="text-lg font-semibold">
                      {g.currency ?? "NTD"} {formatNumber(Math.round(Number(g.exercisePrice) * requestedShares))}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExerciseDialogGrant(null)}>Cancel</Button>
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
              {exerciseGrantMut.isPending ? "Exercising..." : "Exercise & Issue Shares"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
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
