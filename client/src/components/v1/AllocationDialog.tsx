import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ArrowRight, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALLOCATION_STATUSES,
  statusIndex,
  type AllocationStatus,
} from "@shared/allocationLifecycle";

// ─── Types ──────────────────────────────────────────────────────────────────

// Minimal shape we need from an allocation row (matches the drizzle row).
export type AllocationRow = {
  id: number;
  companyId: number;
  fundingRoundId: number;
  investorId: number;
  shareClass:
    | "common" | "seed" | "seed_plus" | "pre_a" | "bridge"
    | "series_a" | "pre_b" | "series_b" | "pre_c" | "series_c" | "esop";
  amount: string | null;
  currency: string;
  fxToNtd: string;
  sharesAllocated: number | null;
  pricePerShare: string | null;
  status: AllocationStatus;
  termSheetUrl: string | null;
  agreementUrl: string | null;
  notes: string | null;
};

export type AllocationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roundId: number;
  allocation?: AllocationRow | null;
  onSaved?: () => void;
};

const SHARE_CLASSES_FALLBACK = [
  "common", "seed", "seed_plus", "pre_a", "bridge",
  "series_a", "pre_b", "series_b", "pre_c", "series_c", "esop",
] as const;

const CURRENCIES = ["NTD", "USD", "EUR", "JPY", "TWD"] as const;

type FormState = {
  investorId: string;
  shareClass: string;
  amount: string;
  currency: string;
  fxToNtd: string;
  sharesAllocated: string;
  pricePerShare: string;
  termSheetUrl: string;
  agreementUrl: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  investorId: "",
  shareClass: "seed",
  amount: "",
  currency: "NTD",
  fxToNtd: "1",
  sharesAllocated: "",
  pricePerShare: "",
  termSheetUrl: "",
  agreementUrl: "",
  notes: "",
};

// ─── Lifecycle Stepper ──────────────────────────────────────────────────────

function LifecycleStepper({ status }: { status: AllocationStatus }) {
  const currentIdx = statusIndex(status);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ALLOCATION_STATUSES.map((s, i) => {
        const isCurrent = i === currentIdx;
        const isDone = i < currentIdx;
        const isFuture = i > currentIdx;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className={
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium " +
                (isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isDone
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary text-muted-foreground/60")
              }
            >
              {isDone && <Check className="h-3 w-3" />}
              <span className="capitalize">{s}</span>
            </span>
            {i < ALLOCATION_STATUSES.length - 1 && (
              <ArrowRight
                className={
                  "h-3 w-3 " +
                  (isFuture ? "text-muted-foreground/40" : "text-muted-foreground")
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Dialog ─────────────────────────────────────────────────────────────────

export default function AllocationDialog({
  open,
  onOpenChange,
  roundId,
  allocation,
  onSaved,
}: AllocationDialogProps) {
  const isEdit = !!allocation;
  const utils = trpc.useUtils();
  const { data: investors } = trpc.v1.investors.list.useQuery();
  const { data: shareClassesDynamic } = trpc.shareClasses.list.useQuery();
  const SHARE_CLASSES = shareClassesDynamic && shareClassesDynamic.length > 0
    ? shareClassesDynamic.map((sc: any) => sc.slug)
    : [...SHARE_CLASSES_FALLBACK];

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Sync form state when opening / when allocation changes
  useEffect(() => {
    if (!open) return;
    if (allocation) {
      setForm({
        investorId: String(allocation.investorId),
        shareClass: allocation.shareClass,
        amount: allocation.amount ?? "",
        currency: allocation.currency ?? "NTD",
        fxToNtd: allocation.fxToNtd ?? "1",
        sharesAllocated: allocation.sharesAllocated != null ? String(allocation.sharesAllocated) : "",
        pricePerShare: allocation.pricePerShare ?? "",
        termSheetUrl: allocation.termSheetUrl ?? "",
        agreementUrl: allocation.agreementUrl ?? "",
        notes: allocation.notes ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, allocation]);

  const currentStatus = allocation?.status ?? "planned";
  const isIssued = currentStatus === "issued";
  const readOnly = isIssued;

  const nextStatusLabel = useMemo(() => {
    const i = statusIndex(currentStatus);
    return i < ALLOCATION_STATUSES.length - 1 ? ALLOCATION_STATUSES[i + 1] : null;
  }, [currentStatus]);

  // ─── Mutations ────────────────────────────────────────────────────────────
  const invalidateAll = () => {
    utils.v1.allocations.list.invalidate();
    utils.v1.allocations.get.invalidate();
    utils.v1.register.list.invalidate();
    utils.v1.snapshots.list.invalidate();
    utils.v1.capTable.current.invalidate();
  };

  const createMut = trpc.v1.allocations.create.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Allocation created");
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.v1.allocations.update.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Allocation updated");
      onSaved?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const advanceMut = trpc.v1.allocations.advance.useMutation({
    onSuccess: (result) => {
      invalidateAll();
      let msg = `Advanced to ${result.newStatus}`;
      if (result.registerEntryId) {
        msg += ` · Register entry #${result.registerEntryId} written · Snapshot #${result.snapshotId} saved`;
      }
      toast.success(msg);
      onSaved?.();
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── Submit handlers ──────────────────────────────────────────────────────
  function handleCreate() {
    if (!form.investorId) {
      toast.error("Please select an investor");
      return;
    }
    createMut.mutate({
      fundingRoundId: roundId,
      investorId: parseInt(form.investorId),
      shareClass: form.shareClass,
      amount: form.amount || undefined,
      currency: form.currency || "NTD",
      fxToNtd: form.fxToNtd || "1",
      sharesAllocated: form.sharesAllocated ? parseInt(form.sharesAllocated) : undefined,
      pricePerShare: form.pricePerShare || undefined,
      termSheetUrl: form.termSheetUrl || undefined,
      agreementUrl: form.agreementUrl || undefined,
      notes: form.notes || undefined,
    });
  }

  function handleUpdate() {
    if (!allocation) return;
    updateMut.mutate({
      id: allocation.id,
      data: {
        amount: form.amount || undefined,
        currency: form.currency || undefined,
        fxToNtd: form.fxToNtd || undefined,
        sharesAllocated: form.sharesAllocated ? parseInt(form.sharesAllocated) : undefined,
        pricePerShare: form.pricePerShare || undefined,
        termSheetUrl: form.termSheetUrl || null,
        agreementUrl: form.agreementUrl || null,
        notes: form.notes || null,
      },
    });
  }

  function handleAdvance() {
    if (!allocation) return;
    advanceMut.mutate({ id: allocation.id });
  }

  // Investor name lookup for header
  const investorName = allocation
    ? investors?.find((i) => i.id === allocation.investorId)?.name
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? `Edit Allocation${investorName ? ` — ${investorName}` : ""}`
              : "Add Allocation"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update allocation fields or advance to the next lifecycle stage."
              : "Create a new investor commitment for this round. Starts as 'planned'."}
          </DialogDescription>
        </DialogHeader>

        {/* Lifecycle stepper + Advance button (edit mode only) */}
        {isEdit && allocation && (
          <div className="border border-border rounded-sm p-3 space-y-3 bg-secondary/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <LifecycleStepper status={currentStatus} />
              {!isIssued && nextStatusLabel && (
                <Button
                  size="sm"
                  onClick={handleAdvance}
                  disabled={advanceMut.isPending}
                >
                  <ArrowRight className="h-3.5 w-3.5 mr-1" />
                  Advance to {nextStatusLabel}
                </Button>
              )}
            </div>
            {isIssued && (
              <div className="flex items-start gap-2 text-xs bg-green-50 text-green-800 border border-green-200 rounded-sm p-2">
                <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Issued — register entry written. Allocation is now immutable.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Form fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Investor */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>Investor</Label>
            {isEdit ? (
              <Input
                value={investorName ?? ""}
                readOnly
                className="bg-secondary/40 cursor-not-allowed"
              />
            ) : (
              <Select
                value={form.investorId}
                onValueChange={(v) => setForm((f) => ({ ...f, investorId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select investor..." />
                </SelectTrigger>
                <SelectContent>
                  {(investors ?? []).map((inv) => (
                    <SelectItem key={inv.id} value={String(inv.id)}>
                      {inv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Share Class */}
          <div className="space-y-1.5">
            <Label>Share Class</Label>
            <Select
              value={form.shareClass}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, shareClass: v as FormState["shareClass"] }))
              }
              disabled={readOnly || isEdit}
            >
              <SelectTrigger className="w-full">
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

          {/* Currency */}
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select
              value={form.currency}
              onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
              disabled={readOnly}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="e.g. 1000000"
              readOnly={readOnly}
            />
          </div>

          {/* FX to NTD */}
          <div className="space-y-1.5">
            <Label>FX to NTD</Label>
            <Input
              type="number"
              value={form.fxToNtd}
              onChange={(e) => setForm((f) => ({ ...f, fxToNtd: e.target.value }))}
              placeholder="1"
              readOnly={readOnly}
            />
          </div>

          {/* Shares Allocated */}
          <div className="space-y-1.5">
            <Label>Shares Allocated</Label>
            <Input
              type="number"
              value={form.sharesAllocated}
              onChange={(e) =>
                setForm((f) => ({ ...f, sharesAllocated: e.target.value }))
              }
              placeholder="e.g. 100000"
              readOnly={readOnly}
            />
          </div>

          {/* Price per share */}
          <div className="space-y-1.5">
            <Label>Price Per Share</Label>
            <Input
              type="number"
              value={form.pricePerShare}
              onChange={(e) =>
                setForm((f) => ({ ...f, pricePerShare: e.target.value }))
              }
              placeholder="e.g. 10.00"
              readOnly={readOnly}
            />
          </div>

          {/* Term sheet URL */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>Term Sheet URL</Label>
            <Input
              value={form.termSheetUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, termSheetUrl: e.target.value }))
              }
              placeholder="https://..."
              readOnly={readOnly}
            />
          </div>

          {/* Agreement URL */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>Agreement URL</Label>
            <Input
              value={form.agreementUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, agreementUrl: e.target.value }))
              }
              placeholder="https://..."
              readOnly={readOnly}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Optional..."
              readOnly={readOnly}
            />
          </div>
        </div>

        {!isEdit && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/20 border border-border rounded-sm p-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              New allocations start as <strong>planned</strong>. Fill in the
              term sheet URL and amount to advance to committed.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isIssued ? "Close" : "Cancel"}
          </Button>
          {!isIssued &&
            (isEdit ? (
              <Button
                onClick={handleUpdate}
                disabled={updateMut.isPending}
              >
                Save Changes
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={createMut.isPending || !form.investorId}
              >
                Create Allocation
              </Button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
