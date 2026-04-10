import React, { useState, useMemo, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatShares, getRoundLabel, formatDate } from "@/lib/utils";
import {
  Plus, Edit2, Trash2, X, Check, ChevronDown, ChevronUp,
  AlertTriangle, FileText, CheckCircle2, Clock, PlusCircle,
  Upload, Download, ExternalLink, Pencil, Save
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";


export default function InvestorsPage() {
  return (
    <DashboardLayout>
      <InvestorsContent />
    </DashboardLayout>
  );
}

type ShareholderType = "founder" | "angel" | "seed" | "seed_plus" | "pre_a" | "bridge" | "series_a" | "pre_b" | "series_b" | "pre_c" | "series_c" | "esop" | "other";

type ShareholderForm = {
  name: string;
  aka: string;
  type: ShareholderType;
  email: string;
  phone: string;
  nationality: string;
  isEntity: boolean;
  notes: string;
  // Initial holding fields (only used on create)
  initialShares: string;
  initialRoundId: string;
  initialPricePerShare: string;
  initialPaidIn: string;
  initialInvestmentDate: string;
};

const emptyForm: ShareholderForm = {
  name: "", aka: "", type: "other", email: "", phone: "", nationality: "", isEntity: false, notes: "",
  initialShares: "", initialRoundId: "", initialPricePerShare: "", initialPaidIn: "", initialInvestmentDate: "",
};

const TYPE_GROUPS = ["founder", "angel", "seed", "seed_plus", "pre_a", "bridge", "series_a", "pre_b", "series_b", "pre_c", "series_c", "esop", "other"];

function InvestorsContent() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ShareholderForm>(emptyForm);
  const [filterType, setFilterType] = useState<string>("all");
  const [showEsop, setShowEsop] = useState(false);
  const [sortKey, setSortKey] = useState<"id" | "name" | "type" | "shares" | "pct">("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // Sheet drawer state
  type ShareholderItem = NonNullable<typeof shareholders>[number];
  const [drawerShareholder, setDrawerShareholder] = useState<ShareholderItem | null>(null);
  const { canEdit, canDelete } = usePermissions();

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  const utils = trpc.useUtils();

  const { data: shareholders, isLoading } = trpc.shareholders.list.useQuery();
  const { data: allHoldings } = trpc.holdings.all.useQuery();
  const { data: summary } = trpc.capTable.summary.useQuery();
  const { data: fundingRounds } = trpc.fundingRounds.list.useQuery();

  const upsertHoldingDirect = trpc.holdings.upsert.useMutation({
    onSuccess: () => {
      utils.holdings.all.invalidate();
      utils.capTable.summary.invalidate();
    },
  });

  const createShareholder = trpc.shareholders.create.useMutation({
    onSuccess: async (newShareholder) => {
      // If initial holding data provided, create a holding record
      if (form.initialShares && form.initialRoundId) {
        const shares = parseInt(form.initialShares.replace(/,/g, ""), 10);
        const roundId = parseInt(form.initialRoundId, 10);
        if (!isNaN(shares) && !isNaN(roundId) && shares > 0) {
          upsertHoldingDirect.mutate({
            shareholderId: newShareholder.id,
            fundingRoundId: roundId,
            commonShares: shares,
            totalShares: shares,
            paidInCapitalNtd: form.initialPaidIn || undefined,
            investmentDate: form.initialInvestmentDate || undefined,
          });
        }
      }
      utils.shareholders.list.invalidate();
      utils.capTable.summary.invalidate();
      utils.holdings.all.invalidate();
      setShowForm(false);
      setForm(emptyForm);
      toast.success("Investor added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateShareholder = trpc.shareholders.update.useMutation({
    onSuccess: () => {
      utils.shareholders.list.invalidate();
      utils.capTable.summary.invalidate();
      setEditId(null);
      setShowForm(false);
      toast.success("Investor updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteShareholder = trpc.shareholders.delete.useMutation({
    onSuccess: () => {
      utils.shareholders.list.invalidate();
      utils.capTable.summary.invalidate();
      toast.success("Investor removed");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    const payload = {
      name: form.name,
      aka: form.aka || undefined,
      type: form.type,
      email: form.email || undefined,
      phone: form.phone || undefined,
      nationality: form.nationality || undefined,
      isEntity: form.isEntity,
      notes: form.notes || undefined,
    };
    if (editId !== null) {
      updateShareholder.mutate({ id: editId, data: payload });
    } else {
      createShareholder.mutate(payload);
    }
  }

  function startEdit(s: NonNullable<typeof shareholders>[0]) {
    setEditId(s.id);
    setForm({
      name: s.name,
      aka: s.aka || "",
      type: (s.type as ShareholderType) || "other",
      email: s.email || "",
      phone: s.phone || "",
      nationality: s.nationality || "",
      isEntity: s.isEntity || false,
      notes: s.notes || "",
      initialShares: "", initialRoundId: "", initialPricePerShare: "", initialPaidIn: "", initialInvestmentDate: "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const totalShares = summary?.totalShares || 0;

  // Build sorted shareholder list with stable #ID based on original DB id order
  // Exclude ESOP so non-ESOP shareholders get consecutive numbers (#001, #002, #003...)
  const sortedAll = useMemo(() => {
    const list = (shareholders || []).filter(s => s.type !== "esop").slice().sort((a, b) => a.id - b.id);
    return list;
  }, [shareholders]);
  const idxMap = useMemo(() => {
    const m = new Map<number, number>();
    sortedAll.forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [sortedAll]);

  // Separate ESOP from regular shareholders
  const esopList = useMemo(() => (shareholders || []).filter(s => s.type === "esop"), [shareholders]);
  const filtered = useMemo(() => {
    const base = (shareholders || []).filter(s =>
      s.type !== "esop" && (filterType === "all" || s.type === filterType)
    );
    return base.slice().sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (sortKey === "id") { av = idxMap.get(a.id) || 0; bv = idxMap.get(b.id) || 0; }
      else if (sortKey === "name") { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (sortKey === "type") { av = a.type || ""; bv = b.type || ""; }
      else if (sortKey === "shares") {
        av = summary?.shareholders?.find(sh => sh.id === a.id)?.totalShares || 0;
        bv = summary?.shareholders?.find(sh => sh.id === b.id)?.totalShares || 0;
      } else if (sortKey === "pct") {
        const as_ = summary?.shareholders?.find(sh => sh.id === a.id)?.totalShares || 0;
        const bs_ = summary?.shareholders?.find(sh => sh.id === b.id)?.totalShares || 0;
        av = totalShares > 0 ? as_ / totalShares : 0;
        bv = totalShares > 0 ? bs_ / totalShares : 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [shareholders, filterType, sortKey, sortDir, summary, totalShares, idxMap]);

  // Auto-calculate paid-in when shares and price are filled
  const autoCalcPaidIn = useMemo(() => {
    const shares = parseFloat(form.initialShares.replace(/,/g, ""));
    const price = parseFloat(form.initialPricePerShare);
    if (!isNaN(shares) && !isNaN(price) && shares > 0 && price > 0) {
      return (shares * price).toFixed(0);
    }
    return "";
  }, [form.initialShares, form.initialPricePerShare]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Investors
          </h1>
          <p className="text-sm text-muted-foreground">
            {(shareholders || []).filter(s => s.type !== "esop").length} shareholders
            {esopList.length > 0 && (
              <span className="text-muted-foreground/60"> + {esopList.length} ESOP pool</span>
            )}
            {" "}registered
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Add Investor
          </button>
        )}
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setFilterType("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            filterType === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({(shareholders || []).filter(s => s.type !== "esop").length})
        </button>
        {TYPE_GROUPS.filter(t => t !== "esop").map(t => {
          const count = (shareholders || []).filter(s => s.type === t).length;
          if (count === 0) return null;
          return (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                filterType === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {getRoundLabel(t)} ({count})
            </button>
          );
        })}
        {esopList.length > 0 && (
          <button
            onClick={() => setShowEsop(v => !v)}
            className={`ml-auto px-3 py-1.5 text-xs font-medium rounded-full border transition-colors flex items-center gap-1.5 ${
              showEsop ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
            {showEsop ? "Hide ESOP" : "Show ESOP"} ({esopList.length})
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">
              {editId !== null ? "Edit Investor" : "Add New Investor"}
            </h3>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Basic Info */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Basic Information</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Full Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Legal name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Also Known As</label>
                <input type="text" value={form.aka} onChange={e => setForm(f => ({ ...f, aka: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Nickname / alias" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Investor Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ShareholderType }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring">
                  {TYPE_GROUPS.map(t => <option key={t} value={t}>{getRoundLabel(t)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Phone</label>
                <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="+886-..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Nationality</label>
                <input type="text" value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="e.g. TW, US" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Entity Type</label>
                <div className="flex items-center gap-3 h-9">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.isEntity} onChange={e => setForm(f => ({ ...f, isEntity: e.target.checked }))} className="rounded" />
                    Legal Entity (Company)
                  </label>
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none" placeholder="Optional notes..." />
              </div>
            </div>
          </div>

          {/* Initial Holding (only on create) */}
          {editId === null && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
                Initial Share Holding <span className="normal-case font-normal">(Optional)</span>
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Funding Round</label>
                  <select value={form.initialRoundId} onChange={e => setForm(f => ({ ...f, initialRoundId: e.target.value }))}
                    className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">— Select Round —</option>
                    {(fundingRounds || []).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Shares Issued</label>
                  <input type="text" value={form.initialShares} onChange={e => setForm(f => ({ ...f, initialShares: e.target.value }))}
                    className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="e.g. 1,000,000" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Price / Share (NT$)</label>
                  <input type="number" step="0.01" value={form.initialPricePerShare} onChange={e => setForm(f => ({ ...f, initialPricePerShare: e.target.value }))}
                    className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="e.g. 10.00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                    Paid-in Capital (NT$)
                    {autoCalcPaidIn && <span className="text-primary ml-1 normal-case font-normal">auto</span>}
                  </label>
                  <input type="text"
                    value={form.initialPaidIn || autoCalcPaidIn}
                    onChange={e => setForm(f => ({ ...f, initialPaidIn: e.target.value }))}
                    className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="e.g. 10,000,000" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Investment Date</label>
                  <input type="date" value={form.initialInvestmentDate} onChange={e => setForm(f => ({ ...f, initialInvestmentDate: e.target.value }))}
                    className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
              {form.initialShares && !form.initialRoundId && (
                <p className="text-xs text-amber-600 mt-2">⚠ Please select a funding round to record the holding.</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={!form.name || createShareholder.isPending || updateShareholder.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
              <Check className="h-4 w-4" /> {editId !== null ? "Update Investor" : "Add Investor"}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Shareholders Table */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold tracking-tight">Shareholder Registry</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !filtered.length ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No shareholders found.</div>
        ) : (
          <table className="cap-table w-full">
            <thead>
              <tr>
                <th
                  className="cursor-pointer select-none w-12 text-center"
                  onClick={() => toggleSort("id")}
                  title="Sort by ID"
                >
                  # {sortKey === "id" ? (sortDir === "asc" ? "↑" : "↓") : <span className="text-muted-foreground/40">↕</span>}
                </th>
                <th
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("name")}
                  title="Sort by name"
                >
                  Name {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : <span className="text-muted-foreground/40">↕</span>}
                </th>
                <th
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("type")}
                  title="Sort by type"
                >
                  Type {sortKey === "type" ? (sortDir === "asc" ? "↑" : "↓") : <span className="text-muted-foreground/40">↕</span>}
                </th>
                <th>Nationality</th>
                <th
                  className="text-right cursor-pointer select-none"
                  onClick={() => toggleSort("shares")}
                  title="Sort by shares"
                >
                  Total Shares {sortKey === "shares" ? (sortDir === "asc" ? "↑" : "↓") : <span className="text-muted-foreground/40">↕</span>}
                </th>
                <th
                  className="text-right cursor-pointer select-none"
                  onClick={() => toggleSort("pct")}
                  title="Sort by ownership %"
                >
                  Ownership {sortKey === "pct" ? (sortDir === "asc" ? "↑" : "↓") : <span className="text-muted-foreground/40">↕</span>}
                </th>
                <th>Contact</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const holding = summary?.shareholders?.find(sh => sh.id === s.id);
                const shares = holding?.totalShares || 0;
                // When ESOP is shown, ownership % is fully diluted (denominator includes ESOP pool)
                const denominator = showEsop ? totalShares + (summary?.esopPool?.total || 0) : totalShares;
                const pct = denominator > 0 ? (shares / denominator * 100).toFixed(2) : "0.00";
                return (
                  <tr key={s.id} className="cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => setDrawerShareholder(s)}>
                    <td className="text-center text-[11px] font-mono text-muted-foreground tabular-nums">
                      #{String(idxMap.get(s.id) || 0).padStart(3, "0")}
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        {s.aka && <p className="text-xs text-muted-foreground">{s.aka}</p>}
                        {s.isEntity && <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Entity</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium badge-${s.type || "other"}`}>
                        {getRoundLabel(s.type || "other")}
                      </span>
                    </td>
                    <td className="text-muted-foreground text-sm">{s.nationality || "—"}</td>
                    <td className="text-right tabular-nums font-medium">{formatShares(shares)}</td>
                    <td className="text-right tabular-nums">{pct}%</td>
                    <td className="text-muted-foreground text-xs">{s.email || "—"}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        {canEdit && (
                          <button onClick={e => { e.stopPropagation(); startEdit(s); }} className="text-muted-foreground hover:text-foreground transition-colors" title="Edit investor">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={e => { e.stopPropagation(); if (confirm(`Remove "${s.name}"?`)) deleteShareholder.mutate({ id: s.id }); }}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete investor"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
               })}
              {/* ESOP row — shown inline before Total when showEsop is active */}
              {showEsop && esopList.map(s => {
                const esopPoolShares = summary?.esopPool?.total || 0;
                const fullyDilutedTotal = totalShares + esopPoolShares;
                const pct = fullyDilutedTotal > 0 ? (esopPoolShares / fullyDilutedTotal * 100).toFixed(2) : "0.00";
                return (
                  <tr key={`esop-${s.id}`} className="cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors border-t border-amber-200/60 dark:border-amber-800/30 bg-amber-50/20 dark:bg-amber-900/5" onClick={() => setDrawerShareholder(s)}>
                    <td className="text-center text-[11px] font-mono text-muted-foreground/40 tabular-nums">
                      {/* no # index for ESOP */}
                    </td>
                    <td>
                      <div>
                        <p className="font-medium text-amber-700 dark:text-amber-400">{s.name}</p>
                        {s.aka && <p className="text-xs text-muted-foreground">{s.aka}</p>}
                      </div>
                    </td>
                    <td>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        ESOP
                      </span>
                    </td>
                    <td className="text-muted-foreground text-sm">{s.nationality || "—"}</td>
                    <td className="text-right tabular-nums font-medium">{formatShares(esopPoolShares)}</td>
                    <td className="text-right tabular-nums">
                      <span title="Fully diluted basis — assumes all options exercised">{pct}%</span>
                    </td>
                    <td className="text-muted-foreground text-xs">{s.email || "—"}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        {canEdit && (
                          <button onClick={e => { e.stopPropagation(); startEdit(s); }} className="text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={e => { e.stopPropagation(); if (confirm(`Remove "${s.name}"?`)) deleteShareholder.mutate({ id: s.id }); }}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Total row */}
            <tfoot className="border-t-2 border-border bg-secondary/40">
              {showEsop && (
                <tr>
                  <td colSpan={8} className="px-4 py-1.5 text-[10px] text-amber-600/70 dark:text-amber-400/60 italic">
                    * Ownership % shown as <strong>fully diluted</strong> — assumes all ESOP options are exercised.
                    Fully diluted total = {formatShares(totalShares + (summary?.esopPool?.total || 0))} shares
                    ({formatShares(totalShares)} issued + {formatShares(summary?.esopPool?.total || 0)} ESOP pool).
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {showEsop ? "Total (Fully Diluted)" : "Total"}
                </td>
                <td className="text-right px-4 py-2.5 tabular-nums font-bold text-sm">
                  {formatShares(showEsop
                    ? totalShares + (summary?.esopPool?.total || 0)
                    : totalShares
                  )}
                </td>
                <td className="text-right px-4 py-2.5 tabular-nums font-bold text-sm">
                  100.00%
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ESOP Pool Section removed — ESOP is now shown inline in the main table */}

      {/* Right-side Drawer for Shareholder Details */}
      <Sheet open={!!drawerShareholder} onOpenChange={open => { if (!open) setDrawerShareholder(null); }}>
        <SheetContent side="right" className="w-[700px] sm:max-w-[700px] overflow-y-auto p-0">
          <SheetTitle className="sr-only">
            {drawerShareholder?.name ?? "Shareholder Details"}
          </SheetTitle>
          {drawerShareholder && (
            <ShareholderDrawer
              shareholder={drawerShareholder}
              allHoldings={allHoldings || []}
              canEdit={canEdit}
              fundingRounds={fundingRounds || []}
              totalShares={totalShares}
              idxMap={idxMap}
              onClose={() => setDrawerShareholder(null)}
              onEdit={() => { startEdit(drawerShareholder); setDrawerShareholder(null); }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Shareholder Drawer ───────────────────────────────────────────────────────
type HoldingRow = {
  id: number;
  shareholderId: number;
  fundingRoundId: number | null;
  totalShares: number;
  ownershipPct: string | null;
  paidInCapitalNtd: string | null;
  investmentDate?: string | Date | null;
};
type FundingRound = {
  id: number;
  name: string;
  roundDate?: string | Date | null;
  pricePerShareNtd?: string | null;
  postMoneyCalc?: number | null;
  preMoneyCalc?: number | null;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  sha: "SHA", subscription: "Subscription", nda: "NDA",
  board_consent: "Board Consent", side_letter: "Side Letter", warrant: "Warrant", other: "Other",
};

const DOC_STATUS_ICONS: Record<string, React.ReactNode> = {
  signed: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  pending: <Clock className="h-3.5 w-3.5 text-amber-500" />,
  expired: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
  waived: <X className="h-3.5 w-3.5 text-muted-foreground" />,
};

function ShareholderDrawer({
  shareholder, allHoldings, canEdit, fundingRounds, totalShares, idxMap, onClose, onEdit,
}: {
  shareholder: { id: number; name: string; aka?: string | null; type?: string | null; email?: string | null; phone?: string | null; nationality?: string | null; isEntity?: boolean | null; notes?: string | null; lockupPeriod?: string | null; taxBenefits?: string | null };
  allHoldings: HoldingRow[];
  canEdit: boolean;
  fundingRounds: FundingRound[];
  totalShares: number;
  idxMap: Map<number, number>;
  onClose: () => void;
  onEdit: () => void;
}) {
  const shareholderId = shareholder.id;
  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState({
    documentType: "sha", documentName: "", status: "pending",
    signedDate: "", expiryDate: "", notes: "", fileUrl: "",
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(shareholder.notes || "");
  const [editingTaxBenefits, setEditingTaxBenefits] = useState(false);
  const [taxBenefitsValue, setTaxBenefitsValue] = useState(shareholder.taxBenefits || "");
  // Holdings: add new form
  const [showHoldingForm, setShowHoldingForm] = useState(false);
  const [holdingForm, setHoldingForm] = useState({ fundingRoundId: "", shares: "", paidIn: "", investmentDate: "" });
  // Holdings: inline edit
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null);
  const [editHoldingForm, setEditHoldingForm] = useState({ shares: "", paidIn: "", investmentDate: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: transactions } = trpc.transactions.byShareholder.useQuery({ shareholderId });
  const { data: documents } = trpc.documents.listByShareholder.useQuery({ shareholderId });

  const updateShareholderMutation = trpc.shareholders.update.useMutation({
    onSuccess: () => {
      utils.shareholders.list.invalidate();
      setEditingNotes(false);
      setEditingTaxBenefits(false);
      toast.success("Saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const upsertHolding = trpc.holdings.upsert.useMutation({
    onSuccess: () => {
      utils.holdings.all.invalidate();
      utils.capTable.summary.invalidate();
      setShowHoldingForm(false);
      setHoldingForm({ fundingRoundId: "", shares: "", paidIn: "", investmentDate: "" });
      toast.success("Holding saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateHolding = trpc.holdings.update.useMutation({
    onSuccess: () => {
      utils.holdings.all.invalidate();
      utils.capTable.summary.invalidate();
      setEditingHoldingId(null);
      toast.success("Holding updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteHolding = trpc.holdings.delete.useMutation({
    onSuccess: () => {
      utils.holdings.all.invalidate();
      utils.capTable.summary.invalidate();
      toast.success("Holding deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const createDoc = trpc.documents.create.useMutation({
    onSuccess: () => {
      utils.documents.listByShareholder.invalidate({ shareholderId });
      utils.documents.list.invalidate();
      setShowDocForm(false);
      setDocForm({ documentType: "sha", documentName: "", status: "pending", signedDate: "", expiryDate: "", notes: "", fileUrl: "" });
      toast.success("Document added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateDocStatus = trpc.documents.update.useMutation({
    onSuccess: () => {
      utils.documents.listByShareholder.invalidate({ shareholderId });
      utils.documents.list.invalidate();
      toast.success("Document updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.listByShareholder.invalidate({ shareholderId });
      utils.documents.list.invalidate();
      toast.success("Document removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const today = new Date();
  const holdings = allHoldings.filter(h => h.shareholderId === shareholderId);
  const sharesOwned = holdings.reduce((sum, h) => sum + h.totalShares, 0);
  const ownershipPct = totalShares > 0 ? (sharesOwned / totalShares * 100).toFixed(2) : "0.00";

  async function handleFileUpload(file: File) {
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/document", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      const data = await res.json();
      setDocForm(f => ({ ...f, fileUrl: data.url, documentName: f.documentName || file.name }));
      toast.success("File uploaded successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingFile(false);
    }
  }

  function handleHoldingSubmit() {
    const roundId = parseInt(holdingForm.fundingRoundId, 10);
    const shares = parseInt(holdingForm.shares.replace(/,/g, ""), 10);
    if (isNaN(roundId) || isNaN(shares) || shares <= 0) {
      toast.error("Please enter valid round and shares");
      return;
    }
    upsertHolding.mutate({
      shareholderId,
      fundingRoundId: roundId,
      commonShares: shares,
      totalShares: shares,
      paidInCapitalNtd: holdingForm.paidIn || undefined,
      investmentDate: holdingForm.investmentDate || undefined,
    });
  }

  function startEditHolding(h: HoldingRow) {
    setEditingHoldingId(h.id);
    const invDate = h.investmentDate
      ? (h.investmentDate instanceof Date
          ? h.investmentDate.toISOString().slice(0, 10)
          : String(h.investmentDate).slice(0, 10))
      : "";
    setEditHoldingForm({
      shares: String(h.totalShares),
      paidIn: h.paidInCapitalNtd || "",
      investmentDate: invDate,
    });
  }

  function handleEditHoldingSubmit(h: HoldingRow) {
    const shares = parseInt(editHoldingForm.shares.replace(/,/g, ""), 10);
    if (isNaN(shares) || shares <= 0) {
      toast.error("Please enter valid shares");
      return;
    }
    updateHolding.mutate({
      id: h.id,
      totalShares: shares,
      commonShares: shares,
      paidInCapitalNtd: editHoldingForm.paidIn || undefined,
      investmentDate: editHoldingForm.investmentDate || undefined,
    });
  }

  const shareholderIdx = idxMap.get(shareholderId) || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Drawer Header */}
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono text-muted-foreground">
                #{String(shareholderIdx).padStart(3, "0")}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium badge-${shareholder.type || "other"}`}>
                {getRoundLabel(shareholder.type || "other")}
              </span>
              {shareholder.isEntity && (
                <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Entity</span>
              )}
            </div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {shareholder.name}
            </h2>
            {shareholder.aka && <p className="text-sm text-muted-foreground">{shareholder.aka}</p>}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs rounded-sm hover:bg-secondary transition-colors">
                <Edit2 className="h-3 w-3" /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-background rounded-sm p-3 border border-border/60">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Shares</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{formatShares(sharesOwned)}</p>
          </div>
          <div className="bg-background rounded-sm p-3 border border-border/60">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ownership</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{ownershipPct}%</p>
          </div>
          <div className="bg-background rounded-sm p-3 border border-border/60">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Rounds</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{holdings.length}</p>
          </div>
        </div>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Holdings by Round ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Holdings by Round</p>
            {canEdit && (
              <button onClick={() => setShowHoldingForm(v => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                <PlusCircle className="h-3.5 w-3.5" /> Add / Update
              </button>
            )}
          </div>

          {/* Add Holding Form */}
          {showHoldingForm && (
            <div className="bg-background border border-border rounded-sm p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">New Holding Entry</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Funding Round *</label>
                  <select value={holdingForm.fundingRoundId} onChange={e => setHoldingForm(f => ({ ...f, fundingRoundId: e.target.value }))}
                    className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background mt-0.5">
                    <option value="">— Select —</option>
                    {fundingRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Shares *</label>
                  <input type="text" value={holdingForm.shares} onChange={e => setHoldingForm(f => ({ ...f, shares: e.target.value }))}
                    className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background mt-0.5" placeholder="e.g. 1,000,000" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid-in Capital (NT$)</label>
                  <input type="text" value={holdingForm.paidIn} onChange={e => setHoldingForm(f => ({ ...f, paidIn: e.target.value }))}
                    className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background mt-0.5" placeholder="Optional" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Investment Date</label>
                  <input type="date" value={holdingForm.investmentDate} onChange={e => setHoldingForm(f => ({ ...f, investmentDate: e.target.value }))}
                    className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background mt-0.5" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleHoldingSubmit} disabled={upsertHolding.isPending}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-sm disabled:opacity-50">
                  Save Holding
                </button>
                <button onClick={() => setShowHoldingForm(false)} className="px-3 py-1.5 border border-border text-xs rounded-sm">Cancel</button>
              </div>
            </div>
          )}

          {/* Holdings Table */}
          {holdings.length === 0 && !showHoldingForm ? (
            <p className="text-muted-foreground italic text-xs">No holdings recorded</p>
          ) : (
            <div className="overflow-x-auto rounded-sm border border-border">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Round</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Investment Date</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Price/Share</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Post-Money</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Shares (This Round)</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Paid-in (NT$)</th>
                    {canEdit && <th className="px-3 py-2 w-16"></th>}
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => {
                    const round = fundingRounds.find(r => r.id === h.fundingRoundId);
                    const isEditing = editingHoldingId === h.id;

                    // Display date: prefer investmentDate, fallback to roundDate
                    const displayDate = (() => {
                      const d = h.investmentDate || round?.roundDate;
                      if (!d) return "—";
                      return new Date(d as string).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
                    })();

                    const pricePerShare = round?.pricePerShareNtd
                      ? `NT$${parseFloat(round.pricePerShareNtd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—";
                    const postMoney = round?.postMoneyCalc
                      ? `NT$${(round.postMoneyCalc / 1e6).toFixed(1)}M`
                      : "—";

                    if (isEditing) {
                      return (
                        <tr key={h.id} className="bg-primary/5 border-b border-border">
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] badge-${round?.name?.toLowerCase().replace(/[^a-z0-9]/g, "_") || "other"}`}>
                              {round?.name || `#${h.fundingRoundId || "—"}`}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <input type="date" value={editHoldingForm.investmentDate}
                              onChange={e => setEditHoldingForm(f => ({ ...f, investmentDate: e.target.value }))}
                              className="border border-input rounded-sm px-2 py-1 text-xs bg-background w-36" />
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{pricePerShare}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{postMoney}</td>
                          <td className="px-3 py-2 text-right">
                            <input type="text" value={editHoldingForm.shares}
                              onChange={e => setEditHoldingForm(f => ({ ...f, shares: e.target.value }))}
                              className="border border-input rounded-sm px-2 py-1 text-xs bg-background w-28 text-right tabular-nums" />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input type="text" value={editHoldingForm.paidIn}
                              onChange={e => setEditHoldingForm(f => ({ ...f, paidIn: e.target.value }))}
                              className="border border-input rounded-sm px-2 py-1 text-xs bg-background w-32 text-right tabular-nums" placeholder="Optional" />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => handleEditHoldingSubmit(h)} disabled={updateHolding.isPending}
                                className="p-1 text-primary hover:text-primary/80 disabled:opacity-50" title="Save">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setEditingHoldingId(null)}
                                className="p-1 text-muted-foreground hover:text-foreground" title="Cancel">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={h.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors group">
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] badge-${round?.name?.toLowerCase().replace(/[^a-z0-9]/g, "_") || "other"}`}>
                            {round?.name || `#${h.fundingRoundId || "—"}`}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {displayDate}
                          {h.investmentDate && (
                            <span className="ml-1 text-[9px] text-primary/60">(custom)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{pricePerShare}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{postMoney}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{formatShares(h.totalShares)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {h.paidInCapitalNtd ? `NT$${parseInt(h.paidInCapitalNtd).toLocaleString()}` : "—"}
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEditHolding(h)}
                                className="p-1 text-muted-foreground hover:text-primary transition-colors" title="Edit holding">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button onClick={() => { if (confirm("Delete this holding record?")) deleteHolding.mutate({ id: h.id }); }}
                                className="p-1 text-muted-foreground hover:text-destructive transition-colors" title="Delete holding">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {holdings.length > 1 && (
                  <tfoot className="bg-secondary/30">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-muted-foreground text-[10px] uppercase tracking-wide font-semibold">Total</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">
                        {formatShares(holdings.reduce((sum, h) => sum + h.totalShares, 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-muted-foreground">
                        {holdings.some(h => h.paidInCapitalNtd)
                          ? `NT$${holdings.reduce((sum, h) => sum + (h.paidInCapitalNtd ? parseInt(h.paidInCapitalNtd) : 0), 0).toLocaleString()}`
                          : "—"}
                      </td>
                      {canEdit && <td />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* ── Contact Info ── */}
        {(shareholder.email || shareholder.phone || shareholder.nationality) && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Contact</p>
            <div className="grid grid-cols-3 gap-3">
              {shareholder.email && (
                <div className="bg-background border border-border/60 rounded-sm p-3">
                  <p className="text-[10px] text-muted-foreground">Email</p>
                  <p className="text-xs font-medium mt-0.5 truncate">{shareholder.email}</p>
                </div>
              )}
              {shareholder.phone && (
                <div className="bg-background border border-border/60 rounded-sm p-3">
                  <p className="text-[10px] text-muted-foreground">Phone</p>
                  <p className="text-xs font-medium mt-0.5">{shareholder.phone}</p>
                </div>
              )}
              {shareholder.nationality && (
                <div className="bg-background border border-border/60 rounded-sm p-3">
                  <p className="text-[10px] text-muted-foreground">Nationality</p>
                  <p className="text-xs font-medium mt-0.5">{shareholder.nationality}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tax Benefits & Lock-up (read-only, from transactions) ── */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Tax Benefits & Lock-up
          </p>
          {transactions && transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="bg-secondary/30 rounded-sm p-2.5 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tx.transactionType.replace(/_/g, " ")} — {tx.sharesAmount?.toLocaleString()} shares</span>
                    <span className="text-muted-foreground">{tx.transactionDate ? formatDate(tx.transactionDate) : ""}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <div>
                      <span className="text-[10px] text-muted-foreground/70 block">Tax Qualified</span>
                      <span className={tx.taxQualified ? "text-green-600 font-medium" : "text-muted-foreground"}>
                        {tx.taxQualified ? "Yes" : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground/70 block">Lock-up Expiry</span>
                      <span className="text-muted-foreground">{tx.lockUpEndDate ? formatDate(tx.lockUpEndDate) : "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground/70 block">Tax Deduction</span>
                      <span className="text-muted-foreground">
                        {tx.taxDeductionYear ? `${tx.taxDeductionYear} / NT$ ${parseFloat(tx.taxDeductionAmountNtd || "0").toLocaleString()}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No transactions recorded</p>
          )}
        </div>

        {/* ── Notes ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Notes</p>
            {canEdit && !editingNotes && (
              <button onClick={() => { setNotesValue(shareholder.notes || ""); setEditingNotes(true); }}
                className="text-muted-foreground hover:text-primary transition-colors" title="Edit notes">
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                rows={4}
                className="w-full border border-input rounded-sm px-3 py-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Add notes..."
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => updateShareholderMutation.mutate({ id: shareholderId, data: { notes: notesValue || undefined } })}
                  disabled={updateShareholderMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-sm disabled:opacity-50"
                >
                  <Save className="h-3 w-3" /> Save Notes
                </button>
                <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 border border-border text-xs rounded-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-foreground leading-relaxed">
              {shareholder.notes || <span className="text-muted-foreground italic">No notes — click pencil to add</span>}
            </p>
          )}
        </div>

        {/* ── Documents ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1">
              <FileText className="h-3 w-3" /> Documents
            </p>
            {canEdit && (
              <button
                onClick={() => setShowDocForm(v => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <PlusCircle className="h-3.5 w-3.5" /> Add
              </button>
            )}
          </div>

          {showDocForm && (
            <div className="bg-background border border-border rounded-sm p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</label>
                  <select value={docForm.documentType} onChange={e => setDocForm(f => ({ ...f, documentType: e.target.value }))}
                    className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background mt-0.5">
                    {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</label>
                  <select value={docForm.status} onChange={e => setDocForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background mt-0.5">
                    <option value="pending">Pending</option>
                    <option value="signed">Signed</option>
                    <option value="expired">Expired</option>
                    <option value="waived">Waived</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Document Name *</label>
                <input type="text" value={docForm.documentName} onChange={e => setDocForm(f => ({ ...f, documentName: e.target.value }))}
                  className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background mt-0.5" placeholder="e.g. SHA v2.0" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Signed Date</label>
                  <input type="date" value={docForm.signedDate} onChange={e => setDocForm(f => ({ ...f, signedDate: e.target.value }))}
                    className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Expiry Date</label>
                  <input type="date" value={docForm.expiryDate} onChange={e => setDocForm(f => ({ ...f, expiryDate: e.target.value }))}
                    className="w-full border border-input rounded-sm px-2 py-1.5 text-xs bg-background mt-0.5" />
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Attach File</label>
                <div className="mt-0.5 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="flex items-center gap-1.5 px-2 py-1 border border-dashed border-border rounded-sm text-[10px] text-muted-foreground hover:text-foreground hover:border-primary transition-colors disabled:opacity-50"
                  >
                    <Upload className="h-3 w-3" />
                    {uploadingFile ? "Uploading..." : "Upload File"}
                  </button>
                  {docForm.fileUrl && (
                    <a href={docForm.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> View
                    </a>
                  )}
                </div>
                {docForm.fileUrl && (
                  <p className="text-[9px] text-green-600 mt-1">✓ File uploaded successfully</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => createDoc.mutate({
                    shareholderId,
                    documentType: docForm.documentType as "sha" | "subscription" | "nda" | "board_consent" | "side_letter" | "warrant" | "other",
                    documentName: docForm.documentName,
                    status: docForm.status as "pending" | "signed" | "expired" | "waived",
                    signedDate: docForm.signedDate || undefined,
                    expiryDate: docForm.expiryDate || undefined,
                    fileUrl: docForm.fileUrl || undefined,
                    notes: docForm.notes || undefined,
                  })}
                  disabled={!docForm.documentName || createDoc.isPending}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-sm disabled:opacity-50"
                >
                  Add Document
                </button>
                <button onClick={() => setShowDocForm(false)} className="px-3 py-1.5 border border-border text-xs rounded-sm">Cancel</button>
              </div>
            </div>
          )}

          {(!documents || documents.length === 0) && !showDocForm ? (
            <p className="text-muted-foreground italic text-xs">No documents tracked</p>
          ) : (
            <div className="space-y-1">
              {(documents || []).map(d => (
                <div key={d.id} className="flex items-center justify-between py-1.5 px-2 border border-border/40 rounded-sm group hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    {DOC_STATUS_ICONS[d.status]}
                    <span className="text-xs truncate">{d.documentName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{DOC_TYPE_LABELS[d.documentType]}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {d.fileUrl && (
                      <a href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors" title="Download / view file">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <select
                      value={d.status}
                      onChange={e => updateDocStatus.mutate({ id: d.id, data: { status: e.target.value as "pending" | "signed" | "expired" | "waived" } })}
                      className="text-[10px] border-0 bg-transparent cursor-pointer text-muted-foreground focus:outline-none"
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="pending">Pending</option>
                      <option value="signed">Signed</option>
                      <option value="expired">Expired</option>
                      <option value="waived">Waived</option>
                    </select>
                    {canEdit && (
                      <button
                        onClick={() => deleteDoc.mutate({ id: d.id })}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        title="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
