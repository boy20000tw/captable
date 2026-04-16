import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const { data: entries, isLoading: entriesLoading } =
    trpc.v1.register.list.useQuery();
  const { data: allocations, isLoading: allocLoading } =
    trpc.v1.allocations.list.useQuery({});
  const { data: investors } = trpc.v1.investors.list.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();

  const [investorFilter, setInvestorFilter] = useState<string>("all");
  const [roundFilter, setRoundFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AllocationRow | null>(null);

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Share Register
          </h1>
          <p className="text-muted-foreground mt-1">
            Append-only ledger of issued shares, plus the full allocations pipeline.
          </p>
        </div>
      </div>

      <Tabs defaultValue="register" className="space-y-6">
        <TabsList>
          <TabsTrigger value="register">Share Register</TabsTrigger>
          <TabsTrigger value="allocations">All Allocations</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Share Register ─────────────────────────────────────── */}
        <TabsContent value="register" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={investorFilter} onValueChange={setInvestorFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter by investor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All investors</SelectItem>
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
              <CardTitle>Register Entries</CardTitle>
              <CardDescription>
                {filteredEntries.length} entr
                {filteredEntries.length === 1 ? "y" : "ies"} · read-only, append-only
              </CardDescription>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Loading...
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-muted-foreground text-sm">
                    No register entries yet.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Entries are written when an allocation advances to{" "}
                    <strong>issued</strong>.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Investor</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Share Class</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Price / Share</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead>Source</TableHead>
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
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(r.effectiveDate)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {investorName(r.investorId)}
                          </TableCell>
                          <TableCell>
                            {eventTypeBadge(r.eventType as RegisterEventType)}
                          </TableCell>
                          <TableCell className="capitalize text-xs">
                            {String(r.shareClass).replace(/_/g, " ")}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${signClass}`}
                          >
                            {sharesNum > 0 ? "+" : ""}
                            {sharesNum.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs font-mono">
                            {r.pricePerShare
                              ? `${r.currency ?? "NTD"} ${Number(
                                  r.pricePerShare
                                ).toLocaleString(undefined, {
                                  maximumFractionDigits: 4,
                                })}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.totalAmount
                              ? `${r.currency ?? "NTD"} ${Number(
                                  r.totalAmount
                                ).toLocaleString()}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.fundingRoundId != null ? (
                              <span>Round: {roundName(r.fundingRoundId)}</span>
                            ) : r.allocationId != null ? (
                              <span>Alloc #{r.allocationId}</span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: All Allocations ────────────────────────────────────── */}
        <TabsContent value="allocations" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={roundFilter} onValueChange={setRoundFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter by round" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rounds</SelectItem>
                {(rounds ?? []).map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
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
              <CardTitle>Allocations Pipeline</CardTitle>
              <CardDescription>
                {filteredAllocations.length} allocation
                {filteredAllocations.length === 1 ? "" : "s"} · click a row to
                edit
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allocLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Loading...
                </div>
              ) : filteredAllocations.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-muted-foreground text-sm">
                    No allocations match the current filters.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Create allocations from the Funding Round detail page.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Round</TableHead>
                      <TableHead>Investor</TableHead>
                      <TableHead>Share Class</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Price / Share</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
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
                          <TableCell className="text-xs text-muted-foreground">
                            {roundName(a.fundingRoundId)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {investorName(a.investorId)}
                          </TableCell>
                          <TableCell className="capitalize text-xs">
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
                          <TableCell className="text-right tabular-nums text-xs font-mono">
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
                          <TableCell className="text-xs text-muted-foreground">
                            {(a as any).updatedAt
                              ? formatDate((a as any).updatedAt)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
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
    </div>
  );
}
