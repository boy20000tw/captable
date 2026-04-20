import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  Wrench, Plus, Trash2, Play, Info, Check, X, Zap,
  ChevronDown, ChevronUp, Pencil, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

// ════════════════════════════════════════════════════════════════════════════
// Instruments (V1) — SAFE & Convertible Note
//
// Regular equity issuances live on the Funding Rounds / Share Register flow.
// This page only tracks investment instruments that have NOT yet converted
// into equity. Once a SAFE / Note converts, the conversion shares get issued
// through the register via Allocation → Issued.
//
// Back-end is instrumentsRouter. Data sources are all V1:
//   - instruments from trpc.instruments.list
//   - investors from trpc.v1.investors.list
//   - rounds from trpc.fundingRounds.list
//   - simulator from trpc.instruments.simulateConversion (query)
//   - executeConversion writes (mutation, converted status + audit log)
// ════════════════════════════════════════════════════════════════════════════

export default function InstrumentsPage() {
  return (
    <DashboardLayout>
      <InstrumentsContent />
    </DashboardLayout>
  );
}

type InstrumentType = "safe" | "convertible_note";
type InstrumentStatus = "active" | "converted" | "cancelled" | "matured";
type SafeType = "pre_money" | "post_money" | "mfn";

type InstrumentForm = {
  name: string;
  type: InstrumentType;
  investorId: number | "";
  fundingRoundId: number | "";
  investmentAmountNtd: string;
  investmentAmountUsd: string;
  // SAFE
  valuationCapNtd: string;
  discountRate: string;
  safeType: SafeType | "";
  // Convertible note
  interestRate: string;
  maturityDate: string;
  // Meta
  notes: string;
  boardApprovalDate: string;
  documentUrl: string;
};

const emptyForm: InstrumentForm = {
  name: "",
  type: "safe",
  investorId: "",
  fundingRoundId: "",
  investmentAmountNtd: "",
  investmentAmountUsd: "",
  valuationCapNtd: "",
  discountRate: "",
  safeType: "post_money",
  interestRate: "",
  maturityDate: "",
  notes: "",
  boardApprovalDate: "",
  documentUrl: "",
};

type SimInput = {
  nextRoundPricePerShareNtd: string;
  nextRoundPreMoneyValuationNtd: string;
  nextRoundPostMoneyValuationNtd: string;
  conversionRoundId: number | "";
};
const emptySim: SimInput = {
  nextRoundPricePerShareNtd: "",
  nextRoundPreMoneyValuationNtd: "",
  nextRoundPostMoneyValuationNtd: "",
  conversionRoundId: "",
};

type SimResultRow = {
  instrumentId: number;
  instrumentName: string;
  instrumentType: InstrumentType;
  investorId: number;
  investmentAmount: number;
  principal: number;
  accruedInterest: number;
  valuationCap: number | null;
  discountRate: number;
  interestRate: number;
  discountPrice: number;
  capPrice: number;
  conversionPrice: number;
  conversionMethod: "cap" | "discount";
  effectiveValuation: number | null;
  conversionShares: number;
};

type SimResponse = {
  results: SimResultRow[];
  totalConversionShares: number;
};

// ─── Display helpers ────────────────────────────────────────────────────────

const TYPE_LABELS: Record<InstrumentType, string> = {
  safe: "SAFE",
  convertible_note: "Convertible Note",
};
const TYPE_COLORS: Record<InstrumentType, string> = {
  safe: "bg-purple-100 text-purple-800",
  convertible_note: "bg-amber-100 text-amber-800",
};
const STATUS_COLORS: Record<InstrumentStatus, string> = {
  active: "bg-green-100 text-green-800",
  converted: "bg-slate-100 text-slate-600",
  cancelled: "bg-gray-100 text-gray-500",
  matured: "bg-yellow-100 text-yellow-800",
};

function fmtNumber(n: number | string | null | undefined): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString();
}
function fmtMoneyNtd(n: number | string | null | undefined): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (!Number.isFinite(num)) return "—";
  return `NT$ ${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtPrice(n: number | string | null | undefined): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (!Number.isFinite(num)) return "—";
  return `NT$ ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}
function fmtPct(n: number | string | null | undefined): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (!Number.isFinite(num)) return "—";
  return `${(num * 100).toFixed(2)}%`;
}

// ─── Main content ───────────────────────────────────────────────────────────

function InstrumentsContent() {
  const { canEdit } = usePermissions();
  const utils = trpc.useUtils();

  const { data: instruments, isLoading } = trpc.instruments.list.useQuery();
  const { data: investors } = trpc.v1.investors.list.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();

  const [tab, setTab] = useState<"all" | InstrumentType>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<InstrumentForm>(emptyForm);

  const [showSimulator, setShowSimulator] = useState(false);
  const [simInput, setSimInput] = useState<SimInput>(emptySim);
  const [simResults, setSimResults] = useState<SimResponse | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [executing, setExecuting] = useState(false);

  const createInstrument = trpc.instruments.create.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Instrument added");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateInstrument = trpc.instruments.update.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Instrument updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteInstrument = trpc.instruments.delete.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      toast.success("Instrument deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const executeConversion = trpc.instruments.executeConversion.useMutation({
    onSuccess: (r) => {
      utils.instruments.list.invalidate();
      toast.success(`Converted ${r.count} instrument${r.count === 1 ? "" : "s"}`);
      setSimResults(null);
      setShowSimulator(false);
      setSimInput(emptySim);
    },
    onError: (err) => toast.error(err.message),
  });

  const investorMap = useMemo(() => {
    const m = new Map<number, string>();
    (investors ?? []).forEach((i) => m.set(i.id, i.name));
    return m;
  }, [investors]);

  const roundMap = useMemo(() => {
    const m = new Map<number, { name: string; pricePerShareNtd: string | null }>();
    (rounds ?? []).forEach((r) => m.set(r.id, { name: r.name, pricePerShareNtd: r.pricePerShareNtd }));
    return m;
  }, [rounds]);

  const filtered = useMemo(() => {
    if (!instruments) return [];
    if (tab === "all") return instruments;
    return instruments.filter((i) => i.type === tab);
  }, [instruments, tab]);

  const summary = useMemo(() => {
    const s = { safe: 0, convertible_note: 0, active: 0, converted: 0, totalNtd: 0 };
    (instruments ?? []).forEach((i) => {
      s[i.type as InstrumentType] += 1;
      if (i.status === "active") s.active += 1;
      if (i.status === "converted") s.converted += 1;
      s.totalNtd += Number(i.investmentAmountNtd) || 0;
    });
    return s;
  }, [instruments]);

  const activeConvertiblesCount = useMemo(() => {
    return (instruments ?? []).filter(
      (i) => i.status === "active" && (i.type === "safe" || i.type === "convertible_note"),
    ).length;
  }, [instruments]);

  function openNewForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditForm(inst: any) {
    setEditingId(inst.id);
    setForm({
      name: inst.name ?? "",
      type: inst.type,
      investorId: inst.investorId ?? "",
      fundingRoundId: inst.fundingRoundId ?? "",
      investmentAmountNtd: inst.investmentAmountNtd ?? "",
      investmentAmountUsd: inst.investmentAmountUsd ?? "",
      valuationCapNtd: inst.valuationCapNtd ?? "",
      discountRate: inst.discountRate ?? "",
      safeType: (inst.safeType as SafeType) ?? "",
      interestRate: inst.interestRate ?? "",
      maturityDate: inst.maturityDate ?? "",
      notes: inst.notes ?? "",
      boardApprovalDate: inst.boardApprovalDate ?? "",
      documentUrl: inst.documentUrl ?? "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name || !form.investorId || !form.investmentAmountNtd) {
      toast.error("Name, investor, and investment amount are required");
      return;
    }

    if (editingId != null) {
      await updateInstrument.mutateAsync({
        id: editingId,
        data: {
          name: form.name,
          fundingRoundId: form.fundingRoundId ? Number(form.fundingRoundId) : null,
          investmentAmountNtd: form.investmentAmountNtd,
          investmentAmountUsd: form.investmentAmountUsd || null,
          valuationCapNtd: form.valuationCapNtd || null,
          discountRate: form.discountRate || null,
          safeType: form.safeType || null,
          interestRate: form.interestRate || null,
          maturityDate: form.maturityDate || null,
          notes: form.notes || null,
          boardApprovalDate: form.boardApprovalDate || null,
          documentUrl: form.documentUrl || null,
        },
      });
    } else {
      await createInstrument.mutateAsync({
        name: form.name,
        type: form.type,
        investorId: Number(form.investorId),
        fundingRoundId: form.fundingRoundId ? Number(form.fundingRoundId) : undefined,
        investmentAmountNtd: form.investmentAmountNtd,
        investmentAmountUsd: form.investmentAmountUsd || undefined,
        valuationCapNtd: form.valuationCapNtd || undefined,
        discountRate: form.discountRate || undefined,
        safeType: form.type === "safe" && form.safeType ? form.safeType : undefined,
        interestRate: form.interestRate || undefined,
        maturityDate: form.maturityDate || undefined,
        notes: form.notes || undefined,
        boardApprovalDate: form.boardApprovalDate || undefined,
        documentUrl: form.documentUrl || undefined,
      });
    }
  }

  async function handleSimulate() {
    if (!simInput.nextRoundPricePerShareNtd || !simInput.nextRoundPreMoneyValuationNtd || !simInput.nextRoundPostMoneyValuationNtd) {
      toast.error("Please fill in all simulation fields");
      return;
    }
    setSimulating(true);
    try {
      const result = await utils.instruments.simulateConversion.fetch({
        nextRoundPricePerShareNtd: simInput.nextRoundPricePerShareNtd,
        nextRoundPreMoneyValuationNtd: simInput.nextRoundPreMoneyValuationNtd,
        nextRoundPostMoneyValuationNtd: simInput.nextRoundPostMoneyValuationNtd,
      });
      setSimResults(result as SimResponse);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Simulation failed";
      toast.error(msg);
    } finally {
      setSimulating(false);
    }
  }

  async function handleExecute() {
    if (!simResults || simResults.results.length === 0) return;
    if (!simInput.conversionRoundId) {
      toast.error("Select the conversion round first");
      return;
    }
    const confirmed = window.confirm(
      `Convert ${simResults.results.length} instrument${simResults.results.length === 1 ? "" : "s"} into equity at the selected round? This cannot be undone.`,
    );
    if (!confirmed) return;
    setExecuting(true);
    try {
      await executeConversion.mutateAsync({
        conversionRoundId: Number(simInput.conversionRoundId),
        conversions: simResults.results.map((r) => ({
          instrumentId: r.instrumentId,
          conversionPriceNtd: String(r.conversionPrice),
          conversionShares: r.conversionShares,
        })),
      });
    } finally {
      setExecuting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1
            className="text-3xl font-bold tracking-tight flex items-center gap-2"
            style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}
          >
            <Wrench className="h-7 w-7 text-primary" />
            Instruments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track SAFEs and convertible notes. Simulate how they convert in your next round.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openNewForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Instrument
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-1">{instruments?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {summary.active} active · {summary.converted} converted
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-sm text-muted-foreground">SAFEs</div>
          <div className="text-2xl font-bold mt-1 text-purple-700">{summary.safe}</div>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-sm text-muted-foreground">Convertible Notes</div>
          <div className="text-2xl font-bold mt-1 text-amber-700">{summary.convertible_note}</div>
        </div>
      </div>

      {/* Tab filter */}
      <div className="flex items-center gap-1 border-b">
        {(["all", "safe", "convertible_note"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "all" ? "All" : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Create/edit form */}
      {showForm && canEdit && (
        <div className="border rounded-lg p-6 bg-card space-y-4">
          <h3 className="font-semibold text-lg">
            {editingId != null ? "Edit Instrument" : "New Instrument"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name *</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="e.g. ACME SAFE #1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Type *</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-60"
                value={form.type}
                disabled={editingId != null}
                onChange={(e) => setForm({ ...form, type: e.target.value as InstrumentType })}
              >
                <option value="safe">SAFE</option>
                <option value="convertible_note">Convertible Note</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Investor *</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-60"
                value={form.investorId}
                disabled={editingId != null}
                onChange={(e) =>
                  setForm({ ...form, investorId: e.target.value ? Number(e.target.value) : "" })
                }
              >
                <option value="">Select investor…</option>
                {(investors ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Funding Round</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.fundingRoundId}
                onChange={(e) =>
                  setForm({ ...form, fundingRoundId: e.target.value ? Number(e.target.value) : "" })
                }
              >
                <option value="">— None —</option>
                {(rounds ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Investment Amount (NTD) *</label>
              <input
                type="number"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="e.g. 5000000"
                value={form.investmentAmountNtd}
                onChange={(e) => setForm({ ...form, investmentAmountNtd: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Investment Amount (USD)</label>
              <input
                type="number"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="optional"
                value={form.investmentAmountUsd}
                onChange={(e) => setForm({ ...form, investmentAmountUsd: e.target.value })}
              />
            </div>

            {/* SAFE-specific */}
            {form.type === "safe" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Valuation Cap (NTD)</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    placeholder="e.g. 50000000"
                    value={form.valuationCapNtd}
                    onChange={(e) => setForm({ ...form, valuationCapNtd: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Discount Rate (decimal)</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    placeholder="e.g. 0.2 for 20%"
                    value={form.discountRate}
                    onChange={(e) => setForm({ ...form, discountRate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">SAFE Type</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={form.safeType}
                    onChange={(e) => setForm({ ...form, safeType: e.target.value as SafeType | "" })}
                  >
                    <option value="post_money">Post-Money (YC)</option>
                    <option value="pre_money">Pre-Money</option>
                    <option value="mfn">MFN</option>
                  </select>
                </div>
              </>
            )}

            {/* Convertible-note-specific */}
            {form.type === "convertible_note" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Valuation Cap (NTD)</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={form.valuationCapNtd}
                    onChange={(e) => setForm({ ...form, valuationCapNtd: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Discount Rate (decimal)</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={form.discountRate}
                    onChange={(e) => setForm({ ...form, discountRate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Interest Rate (decimal)</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    placeholder="e.g. 0.05 for 5%"
                    value={form.interestRate}
                    onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Maturity Date</label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={form.maturityDate}
                    onChange={(e) => setForm({ ...form, maturityDate: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Board Approval Date</label>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.boardApprovalDate}
                onChange={(e) => setForm({ ...form, boardApprovalDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Document URL</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="https://…"
                value={form.documentUrl}
                onChange={(e) => setForm({ ...form, documentUrl: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={createInstrument.isPending || updateInstrument.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {createInstrument.isPending || updateInstrument.isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent text-sm"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Instruments table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Investor</th>
              <th className="text-right px-4 py-3 font-medium">Amount (NTD)</th>
              <th className="text-right px-4 py-3 font-medium">Cap / Discount</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              {canEdit && <th className="text-center px-4 py-3 font-medium w-24"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 7 : 6}
                  className="text-center py-12 text-muted-foreground"
                >
                  <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No instruments yet</p>
                  <p className="text-sm mt-1">
                    Track SAFEs and convertible notes until they convert at the next round.
                  </p>
                  {canEdit && (
                    <button
                      onClick={openNewForm}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      Add First Instrument
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((inst) => (
                <tr key={inst.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{inst.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        TYPE_COLORS[inst.type as InstrumentType]
                      }`}
                    >
                      {TYPE_LABELS[inst.type as InstrumentType]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {investorMap.get(inst.investorId) ?? `#${inst.investorId}`}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {fmtMoneyNtd(inst.investmentAmountNtd)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {inst.valuationCapNtd ? (
                      <div>Cap: {fmtMoneyNtd(inst.valuationCapNtd)}</div>
                    ) : null}
                    {inst.discountRate ? <div>Disc: {fmtPct(inst.discountRate)}</div> : null}
                    {!inst.valuationCapNtd && !inst.discountRate ? "—" : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        STATUS_COLORS[inst.status as InstrumentStatus] ?? ""
                      }`}
                    >
                      {inst.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditForm(inst)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {inst.status !== "converted" && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${inst.name}"?`)) {
                                deleteInstrument.mutate({ id: inst.id });
                              }
                            }}
                            className="text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Conversion simulator ────────────────────────────────────────── */}
      {activeConvertiblesCount > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowSimulator((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 bg-card hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-semibold">Conversion Simulator</span>
              <span className="text-xs text-muted-foreground ml-2">
                Preview conversion of {activeConvertiblesCount} active SAFE
                {activeConvertiblesCount === 1 ? "" : "s"}/note
                {activeConvertiblesCount === 1 ? "" : "s"} at a hypothetical round
              </span>
            </div>
            {showSimulator ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showSimulator && (
            <div className="px-6 py-5 border-t space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Simulator is read-only. Nothing is written until you click{" "}
                  <strong>Execute Conversion</strong>.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Next Round Price / Share (NTD)</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={simInput.nextRoundPricePerShareNtd}
                    onChange={(e) =>
                      setSimInput({ ...simInput, nextRoundPricePerShareNtd: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Pre-Money Valuation (NTD)</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={simInput.nextRoundPreMoneyValuationNtd}
                    onChange={(e) =>
                      setSimInput({ ...simInput, nextRoundPreMoneyValuationNtd: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Post-Money Valuation (NTD)</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={simInput.nextRoundPostMoneyValuationNtd}
                    onChange={(e) =>
                      setSimInput({ ...simInput, nextRoundPostMoneyValuationNtd: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Conversion Round</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={simInput.conversionRoundId}
                    onChange={(e) =>
                      setSimInput({
                        ...simInput,
                        conversionRoundId: e.target.value ? Number(e.target.value) : "",
                      })
                    }
                  >
                    <option value="">Select round…</option>
                    {(rounds ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSimulate}
                  disabled={simulating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  {simulating ? "Calculating…" : "Run Simulation"}
                </button>
                {canEdit && simResults && simResults.results.length > 0 && (
                  <button
                    onClick={handleExecute}
                    disabled={executing || !simInput.conversionRoundId}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                    title={
                      !simInput.conversionRoundId
                        ? "Select the conversion round first"
                        : "Commit conversions to the database"
                    }
                  >
                    <Zap className="h-4 w-4" />
                    {executing ? "Executing…" : "Execute Conversion"}
                  </button>
                )}
              </div>

              {simResults && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="text-xs text-muted-foreground">Instruments Converting</div>
                      <div className="text-lg font-bold mt-1">{simResults.results.length}</div>
                    </div>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="text-xs text-muted-foreground">
                        Total New Shares from Conversion
                      </div>
                      <div className="text-lg font-bold mt-1 text-primary">
                        {fmtNumber(simResults.totalConversionShares)}
                      </div>
                    </div>
                  </div>

                  <table className="w-full text-sm border rounded-lg overflow-hidden">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Instrument</th>
                        <th className="text-left px-3 py-2 font-medium">Investor</th>
                        <th className="text-left px-3 py-2 font-medium">Type</th>
                        <th className="text-right px-3 py-2 font-medium">Principal</th>
                        <th className="text-right px-3 py-2 font-medium">Disc Price</th>
                        <th className="text-right px-3 py-2 font-medium">Cap Price</th>
                        <th className="text-right px-3 py-2 font-medium">Conv. Price</th>
                        <th className="text-center px-3 py-2 font-medium">Method</th>
                        <th className="text-right px-3 py-2 font-medium">Shares</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {simResults.results.map((r) => (
                        <tr key={r.instrumentId}>
                          <td className="px-3 py-2 font-medium">{r.instrumentName}</td>
                          <td className="px-3 py-2">
                            {investorMap.get(r.investorId) ?? `#${r.investorId}`}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {TYPE_LABELS[r.instrumentType]}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {fmtMoneyNtd(r.principal)}
                            {r.accruedInterest > 0 && (
                              <div className="text-xs text-muted-foreground">
                                + {fmtMoneyNtd(r.accruedInterest)} int.
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {fmtPrice(r.discountPrice)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {fmtPrice(r.capPrice)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {fmtPrice(r.conversionPrice)}
                          </td>
                          <td className="px-3 py-2 text-center text-xs">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                r.conversionMethod === "cap"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {r.conversionMethod}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-green-700">
                            {fmtNumber(r.conversionShares)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formula reference */}
      <div className="border rounded-lg p-5 bg-muted/20 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Info className="h-4 w-4" />
          Conversion Math
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">Discount Price</p>
            <p>disc_price = next_round_price × (1 − discount_rate)</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Cap Price</p>
            <p>cap_price = next_round_price × (valuation_cap / pre_money)</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Conversion Price</p>
            <p>conv_price = min(disc_price, cap_price)</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Shares</p>
            <p>shares = floor(principal / conv_price). Convertible-note principal = investment + accrued interest.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
