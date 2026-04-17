import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Rocket, ArrowRight } from "lucide-react";
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
      <V1RoundsContent />
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

function statusBadge(status: RoundStatus) {
  if (status === "completed")
    return <Badge className="bg-green-100 text-green-700 border-transparent">Completed</Badge>;
  if (status === "bridge")
    return <Badge className="bg-orange-100 text-orange-700 border-transparent">Bridge</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-transparent">Projected</Badge>;
}

function V1RoundsContent() {
  const [, setLocation] = useLocation();
  const { canEdit, canDelete } = usePermissions();
  const utils = trpc.useUtils();
  const { data: rounds, isLoading } = trpc.fundingRounds.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<RoundForm>(EMPTY_FORM);

  const createMut = trpc.fundingRounds.create.useMutation({
    onSuccess: () => {
      utils.fundingRounds.list.invalidate();
      toast.success("Round created");
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.fundingRounds.update.useMutation({
    onSuccess: () => {
      utils.fundingRounds.list.invalidate();
      toast.success("Round updated");
      closeDialog();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.fundingRounds.delete.useMutation({
    onSuccess: () => {
      utils.fundingRounds.list.invalidate();
      toast.success("Round deleted");
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
      toast.error("Name is required");
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
    if (!confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    deleteMut.mutate({ id: r.id });
  }

  const sorted = rounds ?? [];
  const isEmpty = !isLoading && sorted.length === 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Rocket className="h-7 w-7 text-primary" />
            Funding Rounds
          </h1>
          <p className="text-muted-foreground mt-1">
            Plan and track each capital raise.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Round
          </Button>
        )}
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Rounds</CardTitle>
              <CardDescription>
                {sorted.length} round{sorted.length === 1 ? "" : "s"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : isEmpty ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-muted-foreground text-sm">
                No funding rounds yet. Create your first round to start planning
                allocations.
              </p>
              {canEdit && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> New Round
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Price / Share</TableHead>
                  <TableHead className="text-right">Raised</TableHead>
                  <TableHead className="text-right">Pre-Money</TableHead>
                  <TableHead className="text-right font-semibold">Post-Money</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(r.roundDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-mono">
                      {r.pricePerShareNtd
                        ? `NT$ ${Number(r.pricePerShareNtd).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatValuation(r.moneyRaisedNtd)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {preMoney > 0 ? formatValuation(String(preMoney)) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {postMoney > 0 ? formatValuation(String(postMoney)) : "—"}
                    </TableCell>
                    <TableCell>{statusBadge(r.status as RoundStatus)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => openEdit(r, e)}
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => handleDelete(r, e)}
                            title="Delete"
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
                          title="View"
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
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => (v ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId != null ? "Edit Round" : "New Funding Round"}
            </DialogTitle>
            <DialogDescription>
              {editId != null
                ? "Update round details."
                : "Create a new funding round. You can add allocations after saving."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Series A"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Round Date</Label>
              <Input
                type="date"
                value={form.roundDate}
                onChange={(e) => setForm((f) => ({ ...f, roundDate: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
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
                  <SelectItem value="projected">Projected</SelectItem>
                  <SelectItem value="bridge">Bridge</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Pre-Money Valuation (NTD)</Label>
              <Input
                type="number"
                value={form.preMoneyValuationNtd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, preMoneyValuationNtd: e.target.value }))
                }
                placeholder="e.g. 100000000"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Post-Money Valuation (NTD)</Label>
              <Input
                type="number"
                value={form.postMoneyValuationNtd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, postMoneyValuationNtd: e.target.value }))
                }
                placeholder="e.g. 120000000"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Price Per Share (NTD)</Label>
              <Input
                type="number"
                value={form.pricePerShareNtd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pricePerShareNtd: e.target.value }))
                }
                placeholder="e.g. 10.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Money Raised (NTD)</Label>
              <Input
                type="number"
                value={form.moneyRaisedNtd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, moneyRaisedNtd: e.target.value }))
                }
                placeholder="e.g. 20000000"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending || !form.name.trim()}
            >
              {editId != null ? "Save Changes" : "Create Round"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
