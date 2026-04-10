import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatShares, formatDate, formatValuation } from "@/lib/utils";
import { useState } from "react";
import { Camera, Plus, Trash2, ChevronDown, ChevronUp, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

export default function SnapshotsPage() {
  return (
    <DashboardLayout>
      <SnapshotsContent />
    </DashboardLayout>
  );
}

type SnapshotRow = {
  id: number;
  name: string;
  description: string | null;
  snapshotDate: string | Date | null;
  triggerEvent: string | null;
  fundingRoundId: number | null;
  totalShares: number;
  totalShareholders: number;
  esopPoolTotal: number;
  esopAllocated: number;
  postMoneyValuationNtd: string | null;
  snapshotData: string | null;
  createdAt: Date;
};

function SnapshotsContent() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { canSnapshot, canDelete } = usePermissions();
  const [compareIds, setCompareIds] = useState<[number | null, number | null]>([null, null]);
  const [showCompare, setShowCompare] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    triggerEvent: "manual",
  });
  const exchangeRate = 0.03128;

  const utils = trpc.useUtils();
  const { data: snapshots, isLoading } = trpc.snapshots.list.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();
  const { data: summary } = trpc.capTable.summary.useQuery();

  const autoSnapshot = trpc.snapshots.autoSnapshot.useMutation({
    onSuccess: () => {
      utils.snapshots.list.invalidate();
      toast.success("Snapshot created successfully");
      setShowCreateForm(false);
      setCreateForm({ name: "", description: "", triggerEvent: "manual" });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSnapshot = trpc.snapshots.delete.useMutation({
    onSuccess: () => {
      utils.snapshots.list.invalidate();
      toast.success("Snapshot deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCreate() {
    if (!createForm.name.trim()) {
      toast.error("Please enter a snapshot name");
      return;
    }
    autoSnapshot.mutate({
      name: createForm.name,
      description: createForm.description || undefined,
      triggerEvent: createForm.triggerEvent,
    });
  }

  function parseSnapshotData(data: string | null) {
    if (!data) return [];
    try { return JSON.parse(data) as { id: number; name: string; type: string; totalShares: number; ownershipPct: string | null }[]; }
    catch { return []; }
  }

  const snapshotA = snapshots?.find(s => s.id === compareIds[0]);
  const snapshotB = snapshots?.find(s => s.id === compareIds[1]);
  const dataA = parseSnapshotData(snapshotA?.snapshotData ?? null);
  const dataB = parseSnapshotData(snapshotB?.snapshotData ?? null);

  // Build comparison: all shareholders from both snapshots
  const allNames = Array.from(new Set([...dataA.map(s => s.name), ...dataB.map(s => s.name)]));
  const comparisonRows = allNames.map(name => {
    const a = dataA.find(s => s.name === name);
    const b = dataB.find(s => s.name === name);
    const pctA = a?.ownershipPct ? parseFloat(a.ownershipPct) : 0;
    const pctB = b?.ownershipPct ? parseFloat(b.ownershipPct) : 0;
    return { name, sharesA: a?.totalShares || 0, sharesB: b?.totalShares || 0, pctA, pctB, delta: pctB - pctA };
  }).sort((a, b) => b.sharesB - a.sharesB);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Cap Table Snapshots
          </h1>
          <p className="text-sm text-muted-foreground">
            Point-in-time records of your equity structure
          </p>
        </div>
        <div className="flex items-center gap-2">
          {snapshots && snapshots.length >= 2 && (
            <button
              onClick={() => setShowCompare(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium border rounded-sm px-3 py-1.5 transition-colors ${showCompare ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              <Eye className="h-3.5 w-3.5" /> Compare Snapshots
            </button>
          )}
          {canSnapshot && (
            <button
              onClick={() => setShowCreateForm(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-sm px-3 py-1.5 hover:opacity-90 transition-opacity"
            >
              <Camera className="h-3.5 w-3.5" /> Take Snapshot
            </button>
          )}
        </div>
      </div>

      {/* Current State Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Current Shares", value: formatShares(summary.totalShares), sub: "issued" },
            { label: "Shareholders", value: String(summary.shareholders.length), sub: "active" },
            { label: "ESOP Pool", value: formatShares(summary.esopPool.total), sub: "authorized" },
            { label: "Latest Valuation", value: formatValuation(summary.latestRound?.postMoneyValuationNtd, "NTD", exchangeRate), sub: summary.latestRound?.name || "—" },
          ].map(card => (
            <div key={card.label} className="bg-card border border-border rounded-sm p-5 space-y-2">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">{card.label}</p>
              <p className="text-xl font-bold tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{card.value}</p>
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
              <h3 className="text-base font-semibold tracking-tight">Take New Snapshot</h3>
              <p className="text-xs text-muted-foreground">Captures the current cap table state with all shareholder holdings</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Snapshot Name *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={`e.g. Pre-A Closing ${new Date().toISOString().split("T")[0]}`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Trigger Event</label>
              <select
                value={createForm.triggerEvent}
                onChange={e => setCreateForm(f => ({ ...f, triggerEvent: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="manual">Manual</option>
                <option value="funding_round">Funding Round Closing</option>
                <option value="transfer">Share Transfer</option>
                <option value="esop_grant">ESOP Grant</option>
                <option value="annual_review">Annual Review</option>
                <option value="due_diligence">Due Diligence</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Description</label>
              <input
                type="text"
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={autoSnapshot.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Camera className="h-4 w-4" />
              {autoSnapshot.isPending ? "Capturing..." : "Capture Snapshot"}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors"
            >
              Cancel
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
              <h3 className="text-base font-semibold tracking-tight">Compare Snapshots</h3>
              <p className="text-xs text-muted-foreground">Select two snapshots to see ownership changes</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Snapshot A (Before)</label>
              <select
                value={compareIds[0] ?? ""}
                onChange={e => setCompareIds([e.target.value ? parseInt(e.target.value) : null, compareIds[1]])}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select snapshot...</option>
                {(snapshots || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {formatDate(s.snapshotDate)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Snapshot B (After)</label>
              <select
                value={compareIds[1] ?? ""}
                onChange={e => setCompareIds([compareIds[0], e.target.value ? parseInt(e.target.value) : null])}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select snapshot...</option>
                {(snapshots || []).filter(s => s.id !== compareIds[0]).map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {formatDate(s.snapshotDate)}</option>
                ))}
              </select>
            </div>
          </div>

          {compareIds[0] && compareIds[1] && comparisonRows.length > 0 && (
            <div className="border border-border rounded-sm overflow-hidden">
              <table className="cap-table w-full">
                <thead>
                  <tr>
                    <th>Shareholder</th>
                    <th className="text-right">Shares (A)</th>
                    <th className="text-right">Shares (B)</th>
                    <th className="text-right">Ownership (A)</th>
                    <th className="text-right">Ownership (B)</th>
                    <th className="text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={`cmp-${i}-${row.name}`}>
                      <td className="font-medium">{row.name}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{row.sharesA > 0 ? formatShares(row.sharesA) : "—"}</td>
                      <td className="text-right tabular-nums">{row.sharesB > 0 ? formatShares(row.sharesB) : "—"}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{row.pctA > 0 ? `${(row.pctA * 100).toFixed(3)}%` : "—"}</td>
                      <td className="text-right tabular-nums font-medium">{row.pctB > 0 ? `${(row.pctB * 100).toFixed(3)}%` : "—"}</td>
                      <td className={`text-right tabular-nums font-medium ${row.delta > 0 ? "text-green-600" : row.delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {row.delta === 0 ? "—" : `${row.delta > 0 ? "+" : ""}${(row.delta * 100).toFixed(3)}%`}
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
          <h3 className="text-sm font-semibold tracking-tight">Snapshot History</h3>
          <span className="text-xs text-muted-foreground ml-auto">{snapshots?.length || 0} snapshots</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !snapshots?.length ? (
          <div className="p-12 text-center space-y-3">
            <Camera className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No snapshots yet.</p>
            <p className="text-xs text-muted-foreground">Take your first snapshot to record the current cap table state.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(snapshots as SnapshotRow[]).map(snapshot => {
              const isExpanded = expandedId === snapshot.id;
              const data = parseSnapshotData(snapshot.snapshotData);
              return (
                <div key={snapshot.id}>
                  <div className="px-6 py-4 flex items-center gap-4 hover:bg-secondary/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{snapshot.name}</p>
                        {snapshot.triggerEvent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium uppercase tracking-wide shrink-0">
                            {snapshot.triggerEvent.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      {snapshot.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{snapshot.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground shrink-0">
                      <div className="text-right">
                        <p className="font-medium text-foreground tabular-nums">{formatShares(snapshot.totalShares)}</p>
                        <p>shares</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">{snapshot.totalShareholders}</p>
                        <p>holders</p>
                      </div>
                      {snapshot.postMoneyValuationNtd && (
                        <div className="text-right">
                          <p className="font-medium text-foreground">{formatValuation(snapshot.postMoneyValuationNtd, "NTD", exchangeRate)}</p>
                          <p>valuation</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="font-medium text-foreground">{formatDate(snapshot.snapshotDate)}</p>
                        <p>date</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : snapshot.id)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete snapshot "${snapshot.name}"?`)) {
                              deleteSnapshot.mutate({ id: snapshot.id });
                            }
                          }}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && data.length > 0 && (
                    <div className="border-t border-border bg-secondary/10">
                      <table className="cap-table w-full">
                        <thead>
                          <tr>
                            <th>Shareholder</th>
                            <th>Type</th>
                            <th className="text-right">Shares</th>
                            <th className="text-right">Ownership %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.sort((a, b) => b.totalShares - a.totalShares).map((sh, i) => (
                            <tr key={i}>
                              <td className="font-medium">{sh.name}</td>
                              <td className="text-muted-foreground text-xs">{sh.type}</td>
                              <td className="text-right tabular-nums">{formatShares(sh.totalShares)}</td>
                              <td className="text-right tabular-nums font-medium">
                                {sh.ownershipPct ? `${(parseFloat(sh.ownershipPct) * 100).toFixed(3)}%` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
