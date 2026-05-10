import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { trpc } from "@/lib/trpc";
import { formatShares, formatDate, formatValuation } from "@/lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, ChevronDown, ChevronUp, Eye, Download, Activity } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

// V1 Snapshots — backed by trpc.v1.snapshots
//   - list : returns rows of snapshotsV1 table
//   - createManual : creates a manual snapshot (auto snapshots come from register writes)
// Snapshots are append-only — no delete in V1.

export default function SnapshotsPage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="snapshots">
        <SnapshotsContent />
      </FeatureGate>
    </DashboardLayout>
  );
}

type SnapshotRow = {
  id: number;
  companyId: number;
  name: string;
  triggerType: "register_write" | "manual";
  registerEntryId: number | null;
  capTableData: any;             // jsonb (CapTable object or {test:true} for old test)
  totalShares: number;
  totalInvestors: number;
  notes: string | null;
  createdByUserId: number | null;
  createdAt: Date | string;
};

type CapTableHolding = {
  investorId: number;
  investorName: string;
  investorStatus?: string;
  entityKind?: string;
  totalShares: number;
  byShareClass?: Record<string, number>;
  ownershipPct: string;
};

function readHoldings(row: SnapshotRow): CapTableHolding[] {
  const data = row.capTableData;
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.holdings)) return data.holdings as CapTableHolding[];
  return [];
}

function SnapshotsContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("settings");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { canSnapshot } = usePermissions();
  const [compareIds, setCompareIds] = useState<[number | null, number | null]>([null, null]);
  const [showCompare, setShowCompare] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", notes: "" });
  const exchangeRate = 0.03128;

  const utils = trpc.useUtils();
  const { data: snapshots, isLoading } = trpc.v1.snapshots.list.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();
  const { data: capTable } = trpc.v1.capTable.current.useQuery();
  const latestRound = (rounds || []).slice().sort((a, b) => {
    const da = a.roundDate ? new Date(a.roundDate).getTime() : 0;
    const db = b.roundDate ? new Date(b.roundDate).getTime() : 0;
    return db - da;
  })[0];

  const createSnapshot = trpc.v1.snapshots.createManual.useMutation({
    onSuccess: () => {
      utils.v1.snapshots.list.invalidate();
      toast.success(t("snapshots.captured"));
      setShowCreateForm(false);
      setCreateForm({ name: "", notes: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCreate() {
    if (!createForm.name.trim()) {
      toast.error(t("snapshots.enterName"));
      return;
    }
    createSnapshot.mutate({
      name: createForm.name,
      notes: createForm.notes || undefined,
    });
  }

  const rowsTyped = (snapshots ?? []) as SnapshotRow[];
  const snapshotA = rowsTyped.find(s => s.id === compareIds[0]);
  const snapshotB = rowsTyped.find(s => s.id === compareIds[1]);
  const dataA = snapshotA ? readHoldings(snapshotA) : [];
  const dataB = snapshotB ? readHoldings(snapshotB) : [];

  // Build comparison: all investors from both snapshots (by name)
  const allNames = Array.from(new Set([
    ...dataA.map(s => s.investorName),
    ...dataB.map(s => s.investorName),
  ]));
  const totalSharesA = snapshotA?.totalShares ?? 0;
  const totalSharesB = snapshotB?.totalShares ?? 0;
  const comparisonRows = allNames.map(name => {
    const a = dataA.find(s => s.investorName === name);
    const b = dataB.find(s => s.investorName === name);
    const sharesA = a?.totalShares ?? 0;
    const sharesB = b?.totalShares ?? 0;
    const pctA = totalSharesA > 0 ? sharesA / totalSharesA : 0;
    const pctB = totalSharesB > 0 ? sharesB / totalSharesB : 0;
    return { name, sharesA, sharesB, pctA, pctB, delta: pctB - pctA };
  }).sort((x, y) => y.sharesB - x.sharesB);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}
          >
            {tPages("settings.snapshots.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tPages("settings.snapshots.desc")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const headers = ["Name", "Trigger", "Total Shares", "Investors", "Created At", "Notes"];
              const rows = rowsTyped.map(s => [
                s.name || "",
                s.triggerType,
                String(s.totalShares),
                String(s.totalInvestors),
                s.createdAt ? new Date(s.createdAt).toISOString() : "",
                s.notes ?? "",
              ]);
              const csv = [headers, ...rows]
                .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
                .join("\n");
              const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `snapshots-${new Date().toISOString().split("T")[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${rows.length} snapshots`);
            }}
            disabled={!rowsTyped.length}
            className="flex items-center gap-1.5 text-xs font-medium border border-border text-muted-foreground rounded-sm px-3 py-1.5 hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> {t("snapshots.exportCsv")}
          </button>
          {rowsTyped.length >= 2 && (
            <button
              onClick={() => setShowCompare(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium border rounded-sm px-3 py-1.5 transition-colors ${
                showCompare ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="h-3.5 w-3.5" /> {t("snapshots.compareSnapshots")}
            </button>
          )}
          {canSnapshot && (
            <button
              onClick={() => setShowCreateForm(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-sm px-3 py-1.5 hover:opacity-90 transition-opacity"
            >
              <Camera className="h-3.5 w-3.5" /> {t("snapshots.takeSnapshot")}
            </button>
          )}
        </div>
      </div>

      {/* Current State Summary */}
      {capTable && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t("snapshots.currentShares"), value: formatShares(capTable.totalShares), sub: t("snapshots.fullyDiluted") },
            { label: t("snapshots.investors"), value: String(capTable.holdings.length), sub: t("snapshots.withHoldings") },
            { label: t("snapshots.esopPool"), value: formatShares(capTable.esopPoolTotal), sub: t("snapshots.authorized") },
            { label: t("snapshots.latestValuation"), value: formatValuation(latestRound?.postMoneyValuationNtd, "NTD", exchangeRate), sub: latestRound?.name || "—" },
          ].map(card => (
            <div key={card.label} className="bg-card border border-border rounded-sm p-5 space-y-2">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">{card.label}</p>
              <p
                className="text-xl font-bold tabular-nums"
                style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}
              >
                {card.value}
              </p>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create Snapshot Form */}
      {showCreateForm && (
        <div className="bg-card border border-border rounded-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="text-base font-semibold tracking-tight">{t("snapshots.takeNew")}</h3>
              <p className="text-xs text-muted-foreground">
                {t("snapshots.takeNewDesc")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                {t("snapshots.snapshotName")}
              </label>
              <input
                type="text"
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={`e.g. Pre-A Closing ${new Date().toISOString().split("T")[0]}`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                {t("snapshots.notes")}
              </label>
              <input
                type="text"
                value={createForm.notes}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={t("snapshots.optionalNotes")}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={createSnapshot.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Camera className="h-4 w-4" />
              {createSnapshot.isPending ? t("snapshots.capturing") : t("snapshots.captureBtn")}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors"
            >
              {t("snapshots.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Compare Snapshots */}
      {showCompare && (
        <div className="bg-card border border-border rounded-sm p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="text-base font-semibold tracking-tight">{t("snapshots.compareTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("snapshots.compareDesc")}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                {t("snapshots.snapshotA")}
              </label>
              <select
                value={compareIds[0] ?? ""}
                onChange={e => setCompareIds([e.target.value ? parseInt(e.target.value) : null, compareIds[1]])}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{t("snapshots.selectSnapshot")}</option>
                {rowsTyped.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatDate(s.createdAt as any)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                {t("snapshots.snapshotB")}
              </label>
              <select
                value={compareIds[1] ?? ""}
                onChange={e => setCompareIds([compareIds[0], e.target.value ? parseInt(e.target.value) : null])}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">{t("snapshots.selectSnapshot")}</option>
                {rowsTyped.filter(s => s.id !== compareIds[0]).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatDate(s.createdAt as any)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {compareIds[0] && compareIds[1] && comparisonRows.length > 0 && (
            <div className="border border-border rounded-sm overflow-x-auto">
              <table className="cap-table w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th>{t("snapshots.investor")}</th>
                    <th className="text-right">{t("snapshots.sharesA")}</th>
                    <th className="text-right">{t("snapshots.sharesB")}</th>
                    <th className="text-right">{t("snapshots.ownershipA")}</th>
                    <th className="text-right">{t("snapshots.ownershipB")}</th>
                    <th className="text-right">{t("snapshots.change")}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={`cmp-${i}-${row.name}`}>
                      <td className="font-medium">{row.name}</td>
                      <td className="text-right tabular-nums text-muted-foreground">
                        {row.sharesA > 0 ? formatShares(row.sharesA) : "—"}
                      </td>
                      <td className="text-right tabular-nums">
                        {row.sharesB > 0 ? formatShares(row.sharesB) : "—"}
                      </td>
                      <td className="text-right tabular-nums text-muted-foreground">
                        {row.pctA > 0 ? `${(row.pctA * 100).toFixed(3)}%` : "—"}
                      </td>
                      <td className="text-right tabular-nums font-medium">
                        {row.pctB > 0 ? `${(row.pctB * 100).toFixed(3)}%` : "—"}
                      </td>
                      <td
                        className={`text-right tabular-nums font-medium ${
                          row.delta > 0
                            ? "text-green-600"
                            : row.delta < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {row.delta === 0
                          ? "—"
                          : `${row.delta > 0 ? "+" : ""}${(row.delta * 100).toFixed(3)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Snapshots List */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight">{t("snapshots.history")}</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            {rowsTyped.length} {t("snapshots.shares")}
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">{t("snapshots.loading")}</div>
        ) : !rowsTyped.length ? (
          <div className="p-12 text-center space-y-3">
            <Camera className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">{t("snapshots.noSnapshots")}</p>
            <p className="text-xs text-muted-foreground">
              {t("snapshots.autoCreate")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rowsTyped.map(snapshot => {
              const isExpanded = expandedId === snapshot.id;
              const data = readHoldings(snapshot);
              return (
                <div key={snapshot.id}>
                  <div className="px-6 py-4 flex items-center gap-4 hover:bg-secondary/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{snapshot.name}</p>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide shrink-0 inline-flex items-center gap-1 ${
                            snapshot.triggerType === "register_write"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {snapshot.triggerType === "register_write" && (
                            <Activity className="h-2.5 w-2.5" />
                          )}
                          {snapshot.triggerType.replace(/_/g, " ")}
                        </span>
                        {snapshot.registerEntryId && (
                          <span className="text-[10px] text-muted-foreground">
                            register #{snapshot.registerEntryId}
                          </span>
                        )}
                      </div>
                      {snapshot.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">{snapshot.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground shrink-0">
                      <div className="text-right">
                        <p className="font-medium text-foreground tabular-nums">
                          {formatShares(snapshot.totalShares)}
                        </p>
                        <p>{t("snapshots.shares")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">{snapshot.totalInvestors}</p>
                        <p>{t("snapshots.investorsLabel")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">
                          {formatDate(snapshot.createdAt as any)}
                        </p>
                        <p>{t("snapshots.captured")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : snapshot.id)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-border bg-secondary/10">
                      {data.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                          {t("snapshots.noHoldings")}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                        <table className="cap-table w-full min-w-[640px]">
                          <thead>
                            <tr>
                              <th>{t("snapshots.investor")}</th>
                              <th>{t("snapshots.entity")}</th>
                              <th className="text-right">{t("snapshots.shares")}</th>
                              <th className="text-right">{t("snapshots.ownershipPct")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data
                              .slice()
                              .sort((a, b) => b.totalShares - a.totalShares)
                              .map((sh, i) => (
                                <tr key={i}>
                                  <td className="font-medium">{sh.investorName}</td>
                                  <td className="text-muted-foreground text-xs capitalize">
                                    {sh.entityKind ?? "—"}
                                  </td>
                                  <td className="text-right tabular-nums">
                                    {formatShares(sh.totalShares)}
                                  </td>
                                  <td className="text-right tabular-nums font-medium">
                                    {sh.ownershipPct ? `${sh.ownershipPct}%` : "—"}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
