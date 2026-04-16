import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  ChevronRight,
  Check,
  Edit2,
  Trash2,
  Rocket,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatDate, formatValuation } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default function V1RoundDetailPage() {
  return (
    <DashboardLayout>
      <V1RoundDetailContent />
    </DashboardLayout>
  );
}

type RoundStatus = "completed" | "projected" | "bridge";

function statusBadge(status: RoundStatus) {
  if (status === "completed")
    return (
      <Badge className="bg-green-100 text-green-700 border-transparent">
        Completed
      </Badge>
    );
  if (status === "bridge")
    return (
      <Badge className="bg-orange-100 text-orange-700 border-transparent">
        Bridge
      </Badge>
    );
  return (
    <Badge className="bg-blue-100 text-blue-700 border-transparent">
      Projected
    </Badge>
  );
}

// Inline horizontal progress indicator for an allocation status.
function StatusStepper({ status }: { status: AllocationStatus }) {
  const currentIdx = statusIndex(status);
  return (
    <div className="flex items-center gap-1">
      {ALLOCATION_STATUSES.map((s, i) => {
        const isCurrent = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <div key={s} className="flex items-center gap-1">
            <span
              className={
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                (isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isDone
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary text-muted-foreground/60")
              }
              title={s}
            >
              {isDone && <Check className="h-2.5 w-2.5" />}
              <span className="capitalize">{s}</span>
            </span>
            {i < ALLOCATION_STATUSES.length - 1 && (
              <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function V1RoundDetailContent() {
  const [, params] = useRoute<{ id: string }>("/v1/rounds/:id");
  const [, setLocation] = useLocation();
  const { canEdit, canDelete } = usePermissions();
  const utils = trpc.useUtils();

  const roundId = params ? parseInt(params.id) : NaN;
  const hasId = !isNaN(roundId);

  const { data: round, isLoading: roundLoading } =
    trpc.fundingRounds.get.useQuery(
      { id: roundId },
      { enabled: hasId }
    );

  const { data: allocations, isLoading: allocLoading } =
    trpc.v1.allocations.list.useQuery(
      { roundId },
      { enabled: hasId }
    );

  const { data: investors } = trpc.v1.investors.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AllocationRow | null>(null);

  const advanceMut = trpc.v1.allocations.advance.useMutation({
    onSuccess: (result) => {
      utils.v1.allocations.list.invalidate();
      utils.v1.register.list.invalidate();
      utils.v1.snapshots.list.invalidate();
      utils.v1.capTable.current.invalidate();
      let msg = `Advanced to ${result.newStatus}`;
      if (result.registerEntryId) {
        msg += ` · Register entry #${result.registerEntryId} written · Snapshot #${result.snapshotId} saved`;
      }
      toast.success(msg);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.v1.allocations.delete.useMutation({
    onSuccess: () => {
      utils.v1.allocations.list.invalidate();
      toast.success("Allocation deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const investorName = useMemo(() => {
    const m = new Map<number, string>();
    (investors ?? []).forEach((i) => m.set(i.id, i.name));
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [investors]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(a: AllocationRow) {
    setEditing(a);
    setDialogOpen(true);
  }

  function handleAdvance(a: AllocationRow, e: React.MouseEvent) {
    e.stopPropagation();
    advanceMut.mutate({ id: a.id });
  }

  function handleDelete(a: AllocationRow, e: React.MouseEvent) {
    e.stopPropagation();
    const name = investorName(a.investorId);
    if (!confirm(`Delete allocation for "${name}"? This cannot be undone.`)) return;
    deleteMut.mutate({ id: a.id });
  }

  if (!hasId) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <p className="text-muted-foreground">Invalid round id.</p>
      </div>
    );
  }

  if (roundLoading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <p className="text-muted-foreground">Loading round...</p>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/v1/rounds")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to rounds
        </Button>
        <p className="text-muted-foreground">Round not found.</p>
      </div>
    );
  }

  const allocs = (allocations ?? []) as unknown as AllocationRow[];
  const isEmpty = !allocLoading && allocs.length === 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/v1/rounds")}
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to rounds
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Rocket className="h-7 w-7 text-primary" />
            {round.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatDate(round.roundDate)}
          </p>
        </div>
        <div>{statusBadge(round.status as RoundStatus)}</div>
      </div>

      {/* Round Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Round Summary</CardTitle>
          <CardDescription>Terms and valuation at a glance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <InfoItem label="Pre-Money" value={formatValuation(round.preMoneyValuationNtd)} />
            <InfoItem label="Post-Money" value={formatValuation(round.postMoneyValuationNtd)} />
            <InfoItem
              label="Price / Share"
              value={
                round.pricePerShareNtd
                  ? `NT$ ${Number(round.pricePerShareNtd).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                  : "—"
              }
            />
            <InfoItem label="Money Raised" value={formatValuation(round.moneyRaisedNtd)} />
          </div>
          {round.notes && (
            <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
              {round.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allocations Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Allocations ({allocs.length})</CardTitle>
              <CardDescription>
                Investor commitments and lifecycle status.
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={openCreate} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Allocation
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {allocLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Loading allocations...
            </div>
          ) : isEmpty ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-muted-foreground text-sm">
                No allocations yet. Add the first investor commitment to get
                started.
              </p>
              {canEdit && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> Add Allocation
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investor</TableHead>
                  <TableHead>Share Class</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Price / Share</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocs.map((a) => {
                  const isIssued = a.status === "issued";
                  const isTerminal = isIssued;
                  return (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer hover:bg-secondary/30"
                      onClick={() => openEdit(a)}
                    >
                      <TableCell className="font-medium">
                        {investorName(a.investorId)}
                      </TableCell>
                      <TableCell className="capitalize text-xs">
                        {a.shareClass.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.sharesAllocated != null
                          ? a.sharesAllocated.toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-mono">
                        {a.pricePerShare
                          ? `${a.currency} ${Number(a.pricePerShare).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.amount
                          ? `${a.currency} ${Number(a.amount).toLocaleString()}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusStepper status={a.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && !isTerminal && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleAdvance(a, e)}
                              disabled={advanceMut.isPending}
                              title="Advance to next status"
                            >
                              Advance
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(a);
                              }}
                              title="Edit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && !isIssued && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => handleDelete(a, e)}
                              title="Delete"
                            >
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

      {/* Allocation Dialog */}
      <AllocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        roundId={roundId}
        allocation={editing}
      />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
