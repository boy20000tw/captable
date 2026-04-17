import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatShares, formatDate, ROUND_LABELS } from "@/lib/utils";
import { useState } from "react";
import { Shield, Plus, Trash2, Edit2, Check, X, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

export default function AntiDilutionPage() {
  return (
    <DashboardLayout>
      <AntiDilutionContent />
    </DashboardLayout>
  );
}

const PROVISION_TYPE_LABELS: Record<string, string> = {
  full_ratchet: "Full Ratchet",
  broad_based_wa: "Broad-Based WA",
  narrow_based_wa: "Narrow-Based WA",
  none: "None",
};

const PROVISION_TYPE_DESC: Record<string, string> = {
  full_ratchet: "Investor's conversion price is adjusted down to the new lower price — maximum protection for investor.",
  broad_based_wa: "Weighted average includes all common shares, options, warrants — most common and balanced.",
  narrow_based_wa: "Weighted average includes only outstanding preferred shares — stronger than broad-based.",
  none: "No anti-dilution protection.",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  triggered: "bg-yellow-100 text-yellow-800",
  waived: "bg-gray-100 text-gray-600",
  expired: "bg-red-100 text-red-700",
};

type Provision = {
  id: number;
  companyId: number | null;
  shareholderId: number;
  fundingRoundId: number;
  provisionType: "full_ratchet" | "broad_based_wa" | "narrow_based_wa" | "none";
  originalPriceNtd: string;
  adjustedPriceNtd: string | null;
  originalShares: number;
  adjustedShares: number | null;
  triggerRoundId: number | null;
  status: "active" | "triggered" | "waived" | "expired";
  notes: string | null;
  createdAt: Date;
};

function AntiDilutionContent() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { canEdit, canDelete } = usePermissions();
  const [form, setForm] = useState({
    shareholderId: "",
    fundingRoundId: "",
    provisionType: "broad_based_wa" as "full_ratchet" | "broad_based_wa" | "narrow_based_wa" | "none",
    originalPriceNtd: "",
    originalShares: "",
    notes: "",
  });
  const [editForm, setEditForm] = useState<{
    adjustedPriceNtd: string;
    adjustedShares: string;
    triggerRoundId: string;
    status: "active" | "triggered" | "waived" | "expired";
    notes: string;
  }>({ adjustedPriceNtd: "", adjustedShares: "", triggerRoundId: "", status: "active", notes: "" });

  const utils = trpc.useUtils();
  const { data: provisions, isLoading } = trpc.antiDilution.list.useQuery();
  const { data: shareholders } = trpc.v1.investors.list.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();

  const createProvision = trpc.antiDilution.create.useMutation({
    onSuccess: () => {
      utils.antiDilution.list.invalidate();
      toast.success("Anti-dilution provision added");
      setShowForm(false);
      setForm({ shareholderId: "", fundingRoundId: "", provisionType: "broad_based_wa", originalPriceNtd: "", originalShares: "", notes: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProvision = trpc.antiDilution.update.useMutation({
    onSuccess: () => {
      utils.antiDilution.list.invalidate();
      toast.success("Provision updated");
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProvision = trpc.antiDilution.delete.useMutation({
    onSuccess: () => {
      utils.antiDilution.list.invalidate();
      toast.success("Provision deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCreate() {
    if (!form.shareholderId || !form.fundingRoundId || !form.originalPriceNtd || !form.originalShares) {
      toast.error("Please fill in all required fields");
      return;
    }
    createProvision.mutate({
      shareholderId: parseInt(form.shareholderId),
      fundingRoundId: parseInt(form.fundingRoundId),
      provisionType: form.provisionType,
      originalPriceNtd: form.originalPriceNtd,
      originalShares: parseInt(form.originalShares),
      notes: form.notes || undefined,
    });
  }

  function startEdit(p: Provision) {
    setEditingId(p.id);
    setEditForm({
      adjustedPriceNtd: p.adjustedPriceNtd || "",
      adjustedShares: p.adjustedShares?.toString() || "",
      triggerRoundId: p.triggerRoundId?.toString() || "",
      status: p.status,
      notes: p.notes || "",
    });
  }

  function handleUpdate() {
    if (!editingId) return;
    updateProvision.mutate({
      id: editingId,
      data: {
        adjustedPriceNtd: editForm.adjustedPriceNtd || undefined,
        adjustedShares: editForm.adjustedShares ? parseInt(editForm.adjustedShares) : undefined,
        triggerRoundId: editForm.triggerRoundId ? parseInt(editForm.triggerRoundId) : undefined,
        status: editForm.status,
        notes: editForm.notes || undefined,
      },
    });
  }

  const getShareholderName = (id: number) => shareholders?.find(s => s.id === id)?.name || `#${id}`;
  const getRoundName = (id: number | null) => id ? (rounds?.find(r => r.id === id)?.name || `#${id}`) : "—";

  const activeCount = provisions?.filter(p => p.status === "active").length || 0;
  const triggeredCount = provisions?.filter(p => p.status === "triggered").length || 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}>
            Anti-Dilution Provisions
          </h1>
          <p className="text-sm text-muted-foreground">
            Track investor protection clauses and down-round adjustments
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-sm px-3 py-1.5 hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" /> Add Provision
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-sm p-5 space-y-2">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">Total Provisions</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}>{provisions?.length || 0}</p>
          <p className="text-xs text-muted-foreground">across all rounds</p>
        </div>
        <div className="bg-card border border-border rounded-sm p-5 space-y-2">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">Active</p>
          <p className="text-2xl font-bold text-green-700" style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}>{activeCount}</p>
          <p className="text-xs text-muted-foreground">provisions in effect</p>
        </div>
        <div className="bg-card border border-border rounded-sm p-5 space-y-2">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">Triggered</p>
          <p className="text-2xl font-bold text-yellow-700" style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}>{triggeredCount}</p>
          <p className="text-xs text-muted-foreground">require adjustment</p>
        </div>
      </div>

      {/* Info Box */}
      <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-sm p-4">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-800 space-y-1">
          <p className="font-semibold">About Anti-Dilution Provisions</p>
          <p>Anti-dilution provisions protect investors from down-rounds (new shares issued at a lower price). When triggered, they allow investors to receive additional shares or a lower conversion price to maintain their economic position.</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-sm p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="text-base font-semibold tracking-tight">Add Anti-Dilution Provision</h3>
              <p className="text-xs text-muted-foreground">Record a protection clause for an investor</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Investor *</label>
              <select
                value={form.shareholderId}
                onChange={e => setForm(f => ({ ...f, shareholderId: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select investor...</option>
                {(shareholders || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Investment Round *</label>
              <select
                value={form.fundingRoundId}
                onChange={e => setForm(f => ({ ...f, fundingRoundId: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select round...</option>
                {(rounds || []).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Provision Type *</label>
              <select
                value={form.provisionType}
                onChange={e => setForm(f => ({ ...f, provisionType: e.target.value as typeof form.provisionType }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {Object.entries(PROVISION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Original Price (NTD) *</label>
              <input
                type="number"
                value={form.originalPriceNtd}
                onChange={e => setForm(f => ({ ...f, originalPriceNtd: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="e.g. 10.00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Original Shares *</label>
              <input
                type="number"
                value={form.originalShares}
                onChange={e => setForm(f => ({ ...f, originalShares: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="e.g. 500000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Optional notes"
              />
            </div>
          </div>
          {form.provisionType && (
            <div className="flex gap-2 bg-secondary/50 rounded-sm p-3">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">{PROVISION_TYPE_DESC[form.provisionType]}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={createProvision.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Shield className="h-4 w-4" />
              {createProvision.isPending ? "Adding..." : "Add Provision"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Provisions Table */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight">All Provisions</h3>
          <span className="text-xs text-muted-foreground ml-auto">{provisions?.length || 0} records</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !provisions?.length ? (
          <div className="p-12 text-center space-y-3">
            <Shield className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No anti-dilution provisions recorded.</p>
            <p className="text-xs text-muted-foreground">Add provisions to track investor protection clauses.</p>
          </div>
        ) : (
          <table className="cap-table w-full">
            <thead>
              <tr>
                <th>Investor</th>
                <th>Round</th>
                <th>Type</th>
                <th className="text-right">Original Price</th>
                <th className="text-right">Original Shares</th>
                <th className="text-right">Adjusted Price</th>
                <th className="text-right">Adj. Shares</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(provisions as Provision[]).map(p => (
                editingId === p.id ? (
                  <tr key={p.id} className="bg-secondary/20">
                    <td colSpan={9} className="p-4">
                      <div className="grid grid-cols-5 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Adjusted Price (NTD)</label>
                          <input type="number" value={editForm.adjustedPriceNtd} onChange={e => setEditForm(f => ({ ...f, adjustedPriceNtd: e.target.value }))}
                            className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background" placeholder="New price" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Adjusted Shares</label>
                          <input type="number" value={editForm.adjustedShares} onChange={e => setEditForm(f => ({ ...f, adjustedShares: e.target.value }))}
                            className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background" placeholder="Additional shares" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Trigger Round</label>
                          <select value={editForm.triggerRoundId} onChange={e => setEditForm(f => ({ ...f, triggerRoundId: e.target.value }))}
                            className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background">
                            <option value="">None</option>
                            {(rounds || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</label>
                          <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as typeof editForm.status }))}
                            className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background">
                            <option value="active">Active</option>
                            <option value="triggered">Triggered</option>
                            <option value="waived">Waived</option>
                            <option value="expired">Expired</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</label>
                          <input type="text" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                            className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background" />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={handleUpdate} disabled={updateProvision.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-sm hover:opacity-90">
                          <Check className="h-3 w-3" /> Save
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 px-3 py-1.5 border border-border text-xs rounded-sm hover:bg-secondary">
                          <X className="h-3 w-3" /> Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td className="font-medium">{getShareholderName(p.shareholderId)}</td>
                    <td className="text-muted-foreground">{getRoundName(p.fundingRoundId)}</td>
                    <td>
                      <span className="text-xs font-medium">{PROVISION_TYPE_LABELS[p.provisionType]}</span>
                    </td>
                    <td className="text-right tabular-nums">NT${parseFloat(p.originalPriceNtd).toFixed(4)}</td>
                    <td className="text-right tabular-nums">{formatShares(p.originalShares)}</td>
                    <td className="text-right tabular-nums">
                      {p.adjustedPriceNtd ? (
                        <span className="text-yellow-700 font-medium">NT${parseFloat(p.adjustedPriceNtd).toFixed(4)}</span>
                      ) : "—"}
                    </td>
                    <td className="text-right tabular-nums">
                      {p.adjustedShares ? (
                        <span className="text-yellow-700 font-medium">+{formatShares(p.adjustedShares)}</span>
                      ) : "—"}
                    </td>
                    <td>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${STATUS_COLORS[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button onClick={() => startEdit(p)} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => { if (confirm("Delete this provision?")) deleteProvision.mutate({ id: p.id }); }}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
