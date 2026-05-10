import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Shield, Plus, Trash2, Play, AlertTriangle, TrendingDown,
  ChevronDown, ChevronUp, Info, Check, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

// ════════════════════════════════════════════════════════════════════════════
// Anti-Dilution Protection
//
// UI for:
//   - Listing anti-dilution provisions attached to (investor, round) pairs
//   - Creating a new provision (Full Ratchet / Broad-WA / Narrow-WA)
//   - Simulating how a hypothetical down round would adjust conversion prices
//     and compensatory share counts
//   - Committing simulator results back to the DB (trigger)
//
// Back-end is antiDilutionRouter. Data sources are all V1:
//   - provisions from trpc.antiDilution.list
//   - investors from trpc.v1.investors.list
//   - rounds from trpc.fundingRounds.list
//   - simulator from trpc.antiDilution.simulate (query, read-only)
//   - trigger from trpc.antiDilution.trigger (mutation, writes + audit log)
// ════════════════════════════════════════════════════════════════════════════

export default function AntiDilutionPage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="analysis.antiDilution">
        <AntiDilutionContent />
      </FeatureGate>
    </DashboardLayout>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

type ProvisionType = "full_ratchet" | "broad_based_wa" | "narrow_based_wa" | "none";

type ProvisionForm = {
  shareholderId: number | "";
  fundingRoundId: number | "";
  provisionType: ProvisionType;
  originalPriceNtd: string;
  originalShares: string;
  notes: string;
};

const emptyForm: ProvisionForm = {
  shareholderId: "",
  fundingRoundId: "",
  provisionType: "broad_based_wa",
  originalPriceNtd: "",
  originalShares: "",
  notes: "",
};

type SimulationInput = {
  newRoundPriceNtd: string;
  newRoundSharesIssued: string;
  newRoundMoneyRaisedNtd: string;
  triggerRoundId: number | "";
};

const emptySimInput: SimulationInput = {
  newRoundPriceNtd: "",
  newRoundSharesIssued: "",
  newRoundMoneyRaisedNtd: "",
  triggerRoundId: "",
};

type SimResult = {
  provisionId: number;
  shareholderId: number;
  fundingRoundId: number;
  provisionType: string;
  originalPriceNtd: number;
  originalShares: number;
  adjustedPriceNtd: number;
  adjustedShares: number;
  additionalShares: number;
  triggered: boolean;
};

type SimResponse = {
  results: SimResult[];
  totalNewShares: number;
  fullyDilutedBefore: number;
  fullyDilutedAfter: number;
};

// ─── Display helpers ────────────────────────────────────────────────────────

// PROVISION_LABELS moved into component to use t()

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  triggered: "bg-red-100 text-red-800",
  waived: "bg-gray-100 text-gray-600",
  expired: "bg-yellow-100 text-yellow-800",
};

function fmtNumber(n: number | string | null | undefined): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString();
}

function fmtPrice(n: number | string | null | undefined): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (!Number.isFinite(num)) return "—";
  return `NT$ ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

// ─── Main content ───────────────────────────────────────────────────────────

function AntiDilutionContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("analysis");
  const { canEdit } = usePermissions();
  const utils = trpc.useUtils();

  const { data: provisions, isLoading } = trpc.antiDilution.list.useQuery();
  const { data: investors } = trpc.v1.investors.list.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProvisionForm>(emptyForm);

  // Simulator state
  const [showSimulator, setShowSimulator] = useState(false);
  const [simInput, setSimInput] = useState<SimulationInput>(emptySimInput);
  const [simResults, setSimResults] = useState<SimResponse | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [triggering, setTriggering] = useState(false);

  // Mutations
  const createProvision = trpc.antiDilution.create.useMutation({
    onSuccess: () => {
      utils.antiDilution.list.invalidate();
      setShowForm(false);
      setForm(emptyForm);
      toast.success(t("antiDilution.provisionCreated"));
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProvision = trpc.antiDilution.delete.useMutation({
    onSuccess: () => {
      utils.antiDilution.list.invalidate();
      toast.success(t("antiDilution.provisionDeleted"));
    },
    onError: (err) => toast.error(err.message),
  });

  const triggerProvisions = trpc.antiDilution.trigger.useMutation({
    onSuccess: (r) => {
      utils.antiDilution.list.invalidate();
      toast.success(t("antiDilution.triggeredCount", { count: r.count }));
      setSimResults(null);
      setShowSimulator(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // Lookup maps
  const investorMap = useMemo(() => {
    const m = new Map<number, string>();
    (investors ?? []).forEach((s) => m.set(s.id, s.name));
    return m;
  }, [investors]);

  const roundMap = useMemo(() => {
    const m = new Map<number, { name: string; pricePerShareNtd: string | null }>();
    (rounds ?? []).forEach((r) => m.set(r.id, { name: r.name, pricePerShareNtd: r.pricePerShareNtd }));
    return m;
  }, [rounds]);

  // Summary stats
  const activeCount = provisions?.filter((p) => p.status === "active").length ?? 0;
  const triggeredCount = provisions?.filter((p) => p.status === "triggered").length ?? 0;

  const PROVISION_LABELS: Record<string, string> = {
    full_ratchet: t("antiDilution.fullRatchet"),
    broad_based_wa: t("antiDilution.bbwa"),
    narrow_based_wa: t("antiDilution.nbwa"),
    none: t("antiDilution.none"),
  };

  // When the user picks a funding round in the form, pre-fill the original
  // price from the round's pricePerShareNtd so they don't have to retype it.
  function handleRoundChange(roundId: number) {
    const round = roundMap.get(roundId);
    setForm((prev) => ({
      ...prev,
      fundingRoundId: roundId,
      originalPriceNtd: round?.pricePerShareNtd ?? prev.originalPriceNtd,
    }));
  }

  async function handleCreate() {
    if (!form.shareholderId || !form.fundingRoundId || !form.originalPriceNtd || !form.originalShares) {
      toast.error(t("antiDilution.fillRequiredFields"));
      return;
    }
    await createProvision.mutateAsync({
      shareholderId: Number(form.shareholderId),
      fundingRoundId: Number(form.fundingRoundId),
      provisionType: form.provisionType,
      originalPriceNtd: form.originalPriceNtd,
      originalShares: Number(form.originalShares),
      notes: form.notes || undefined,
    });
  }

  async function handleSimulate() {
    if (!simInput.newRoundPriceNtd || !simInput.newRoundSharesIssued || !simInput.newRoundMoneyRaisedNtd) {
      toast.error(t("antiDilution.fillSimulationFields"));
      return;
    }
    setSimulating(true);
    try {
      const result = await utils.antiDilution.simulate.fetch({
        newRoundPriceNtd: simInput.newRoundPriceNtd,
        newRoundSharesIssued: Number(simInput.newRoundSharesIssued),
        newRoundMoneyRaisedNtd: simInput.newRoundMoneyRaisedNtd,
      });
      setSimResults(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("antiDilution.simulationFailed");
      toast.error(msg);
    } finally {
      setSimulating(false);
    }
  }

  async function handleTrigger() {
    if (!simResults) return;
    const triggered = simResults.results.filter((r) => r.triggered);
    if (triggered.length === 0) {
      toast.error(t("antiDilution.noProvisionsTriggered"));
      return;
    }
    if (!simInput.triggerRoundId) {
      toast.error(t("antiDilution.selectTriggeringRoundBeforeCommit"));
      return;
    }
    const confirmed = window.confirm(
      t("antiDilution.confirmCommit", { count: triggered.length }),
    );
    if (!confirmed) return;
    setTriggering(true);
    try {
      await triggerProvisions.mutateAsync({
        triggerRoundId: Number(simInput.triggerRoundId),
        adjustments: triggered.map((r) => ({
          provisionId: r.provisionId,
          adjustedPriceNtd: String(r.adjustedPriceNtd),
          adjustedShares: r.adjustedShares,
        })),
      });
    } finally {
      setTriggering(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1
            className="text-3xl font-bold tracking-tight flex items-center gap-2"
            style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}
          >
            <Shield className="h-7 w-7 text-primary" />
            {tPages("antiDilution.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tPages("antiDilution.desc")}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            {t("antiDilution.addProvision")}
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-sm text-muted-foreground">{t("antiDilution.allProvisions")}</div>
          <div className="text-2xl font-bold mt-1">{provisions?.length ?? 0}</div>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-green-600" /> {t("antiDilution.active")}
          </div>
          <div className="text-2xl font-bold mt-1 text-green-700">{activeCount}</div>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> {t("antiDilution.triggered")}
          </div>
          <div className="text-2xl font-bold mt-1 text-red-700">{triggeredCount}</div>
        </div>
      </div>

      {/* Add-provision form */}
      {showForm && canEdit && (
        <div className="border rounded-lg p-6 bg-card space-y-4">
          <h3 className="font-semibold text-lg">{t("antiDilution.newDialog")}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("antiDilution.investor")} *</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.shareholderId}
                onChange={(e) =>
                  setForm({ ...form, shareholderId: e.target.value ? Number(e.target.value) : "" })
                }
              >
                <option value="">{t("antiDilution.selectInvestor")}</option>
                {(investors ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("antiDilution.fundingRound")} *</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.fundingRoundId}
                onChange={(e) =>
                  e.target.value ? handleRoundChange(Number(e.target.value)) : setForm((p) => ({ ...p, fundingRoundId: "" }))
                }
              >
                <option value="">{t("antiDilution.selectRound")}</option>
                {(rounds ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("antiDilution.protectionType")} *</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.provisionType}
                onChange={(e) => setForm({ ...form, provisionType: e.target.value as ProvisionType })}
              >
                <option value="broad_based_wa">{t("antiDilution.bbwa")}</option>
                <option value="narrow_based_wa">{t("antiDilution.nbwa")}</option>
                <option value="full_ratchet">{t("antiDilution.fullRatchet")}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("antiDilution.originalShares")} (NTD) *</label>
              <input
                type="number"
                step="0.000001"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder={t("antiDilution.pricePlaceholder")}
                value={form.originalPriceNtd}
                onChange={(e) => setForm({ ...form, originalPriceNtd: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("antiDilution.newShares")} *</label>
              <input
                type="number"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder={t("antiDilution.sharesPlaceholder")}
                value={form.originalShares}
                onChange={(e) => setForm({ ...form, originalShares: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("antiDilution.notes")}</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder={t("antiDilution.notesPlaceholder")}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={createProvision.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {createProvision.isPending ? t("antiDilution.saving") : t("antiDilution.createProvision")}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent text-sm"
            >
              <X className="h-4 w-4" />
              {t("antiDilution.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Provisions table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{t("antiDilution.investor")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("antiDilution.round")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("antiDilution.type")}</th>
              <th className="text-right px-4 py-3 font-medium">{t("antiDilution.originalPrice")}</th>
              <th className="text-right px-4 py-3 font-medium">{t("antiDilution.adjustedPrice")}</th>
              <th className="text-right px-4 py-3 font-medium">{t("antiDilution.originalShares")}</th>
              <th className="text-right px-4 py-3 font-medium">{t("antiDilution.adjustedShares")}</th>
              <th className="text-center px-4 py-3 font-medium">{t("antiDilution.status")}</th>
              {canEdit && <th className="text-center px-4 py-3 font-medium w-16"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {!provisions || provisions.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 9 : 8}
                  className="text-center py-12 text-muted-foreground"
                >
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">{t("antiDilution.emptyState")}</p>
                  <p className="text-sm mt-1">
                    {t("antiDilution.emptyDesc")}
                  </p>
                  {canEdit && (
                    <button
                      onClick={() => setShowForm(true)}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      {t("antiDilution.addProvision")}
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              provisions.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    {investorMap.get(p.shareholderId) ?? `#${p.shareholderId}`}
                  </td>
                  <td className="px-4 py-3">
                    {roundMap.get(p.fundingRoundId)?.name ?? `#${p.fundingRoundId}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {PROVISION_LABELS[p.provisionType] ?? p.provisionType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {fmtPrice(p.originalPriceNtd)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {p.adjustedPriceNtd ? (
                      <span className="text-red-600">{fmtPrice(p.adjustedPriceNtd)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmtNumber(p.originalShares)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {p.adjustedShares ? (
                      <span className="text-green-600">{fmtNumber(p.adjustedShares)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        STATUS_COLORS[p.status] ?? ""
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-center">
                      {p.status === "active" && (
                        <button
                          onClick={() => {
                            if (confirm(t("antiDilution.confirmDelete"))) {
                              deleteProvision.mutate({ id: p.id });
                            }
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Down-round simulator ────────────────────────────────────────── */}
      {activeCount > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowSimulator((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 bg-card hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-amber-600" />
              <span className="font-semibold">{t("antiDilution.runSimulation")}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {t("antiDilution.downRoundSimulator", { count: activeCount, plural: activeCount > 1 ? "s" : "" })}
              </span>
            </div>
            {showSimulator ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showSimulator && (
            <div className="px-6 py-5 border-t space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{t("antiDilution.readOnlySimulator")}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("antiDilution.newRoundPrice")}</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    placeholder={t("antiDilution.pricePlaceholder")}
                    value={simInput.newRoundPriceNtd}
                    onChange={(e) => setSimInput({ ...simInput, newRoundPriceNtd: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("antiDilution.sharesToBeIssued")}</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    placeholder={t("antiDilution.sharesPlaceholder")}
                    value={simInput.newRoundSharesIssued}
                    onChange={(e) =>
                      setSimInput({ ...simInput, newRoundSharesIssued: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("antiDilution.moneyRaised")}</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    placeholder={t("antiDilution.amountPlaceholder")}
                    value={simInput.newRoundMoneyRaisedNtd}
                    onChange={(e) =>
                      setSimInput({ ...simInput, newRoundMoneyRaisedNtd: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("antiDilution.newRound")}</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={simInput.triggerRoundId}
                    onChange={(e) =>
                      setSimInput({
                        ...simInput,
                        triggerRoundId: e.target.value ? Number(e.target.value) : "",
                      })
                    }
                  >
                    <option value="">{t("antiDilution.selectRound")}</option>
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  {simulating ? t("antiDilution.calculating") : t("antiDilution.runSimulation")}
                </button>
                {canEdit && simResults && simResults.totalNewShares > 0 && (
                  <button
                    onClick={handleTrigger}
                    disabled={triggering || !simInput.triggerRoundId}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                    title={
                      !simInput.triggerRoundId
                        ? t("antiDilution.selectTriggeringRound")
                        : t("antiDilution.commitAdjustment")
                    }
                  >
                    <Zap className="h-4 w-4" />
                    {triggering ? t("antiDilution.committing") : t("antiDilution.commitTrigger")}
                  </button>
                )}
              </div>

              {simResults && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="text-xs text-muted-foreground">{t("antiDilution.fullyDilutedBefore")}</div>
                      <div className="text-lg font-bold mt-1">
                        {fmtNumber(simResults.fullyDilutedBefore)}
                      </div>
                    </div>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="text-xs text-muted-foreground">{t("antiDilution.fullyDilutedAfter")}</div>
                      <div className="text-lg font-bold mt-1 text-red-600">
                        {fmtNumber(simResults.fullyDilutedAfter)}
                      </div>
                    </div>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="text-xs text-muted-foreground">
                        {t("antiDilution.additionalSharesFromAntiDilution")}
                      </div>
                      <div className="text-lg font-bold mt-1 text-amber-600">
                        {simResults.totalNewShares > 0
                          ? `+${fmtNumber(simResults.totalNewShares)}`
                          : "0"}
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">{t("antiDilution.investor")}</th>
                        <th className="text-left px-4 py-2 font-medium">{t("antiDilution.round")}</th>
                        <th className="text-left px-4 py-2 font-medium">{t("antiDilution.type")}</th>
                        <th className="text-right px-4 py-2 font-medium">{t("antiDilution.priceBefore")}</th>
                        <th className="text-right px-4 py-2 font-medium">{t("antiDilution.priceAfter")}</th>
                        <th className="text-right px-4 py-2 font-medium">{t("antiDilution.sharesBefore")}</th>
                        <th className="text-right px-4 py-2 font-medium">{t("antiDilution.sharesAfter")}</th>
                        <th className="text-right px-4 py-2 font-medium">{t("antiDilution.additional")}</th>
                        <th className="text-center px-4 py-2 font-medium">{t("antiDilution.triggered")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {simResults.results.map((r) => (
                        <tr key={r.provisionId} className={r.triggered ? "bg-red-50/50" : ""}>
                          <td className="px-4 py-2 font-medium">
                            {investorMap.get(r.shareholderId) ?? `#${r.shareholderId}`}
                          </td>
                          <td className="px-4 py-2">
                            {roundMap.get(r.fundingRoundId)?.name ?? `#${r.fundingRoundId}`}
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {PROVISION_LABELS[r.provisionType] ?? r.provisionType}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {fmtPrice(r.originalPriceNtd)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {r.triggered ? (
                              <span className="text-red-600">{fmtPrice(r.adjustedPriceNtd)}</span>
                            ) : (
                              fmtPrice(r.adjustedPriceNtd)
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {fmtNumber(r.originalShares)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {r.triggered ? (
                              <span className="text-green-600">{fmtNumber(r.adjustedShares)}</span>
                            ) : (
                              fmtNumber(r.adjustedShares)
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-amber-600">
                            {r.additionalShares > 0 ? `+${fmtNumber(r.additionalShares)}` : "—"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {r.triggered ? (
                              <AlertTriangle className="h-4 w-4 text-red-500 inline" />
                            ) : (
                              <span className="text-green-600 text-xs">{t("antiDilution.noImpact")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
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
          {t("antiDilution.formulaReference")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">{t("antiDilution.fullRatchet")}</p>
            <p>{t("antiDilution.fullRatchetDesc")}</p>
            <p className="text-xs mt-1">
              {t("antiDilution.fullRatchetExplain")}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">{t("antiDilution.bbwa")}</p>
            <p>{t("antiDilution.bbwaFormula")}</p>
            <p className="text-xs mt-1">
              {t("antiDilution.bbwaExplain")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
