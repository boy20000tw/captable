import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatShares, formatDate } from "@/lib/utils";
import { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, X, Check, Sparkles, TrendingUp, Calculator, AlertTriangle, ChevronDown, ChevronUp, Briefcase, Download } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";

export default function EsopPage() {
  return (
    <DashboardLayout>
      <EsopContent />
    </DashboardLayout>
  );
}

// ─── Vesting Chart ────────────────────────────────────────────────────────────
function VestingChart({ grantId }: { grantId: number }) {
  const { data, isLoading } = trpc.esop.vestingSchedule.useQuery({ grantId });

  if (isLoading) return <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">Loading vesting schedule...</div>;
  if (!data) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-foreground inline-block opacity-80" /> Cumulative Vested</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-amber-400 inline-block" /> Cliff ({data.cliffMonths}mo)</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data.schedule} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="vestGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--foreground)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--foreground)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" tick={{ fontSize: 9 }} label={{ value: "Month", position: "insideBottom", offset: -2, fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <Tooltip
            formatter={(v: number) => [v.toLocaleString(), "Cumulative"]}
            labelFormatter={l => `Month ${l}`}
            contentStyle={{ fontSize: 11, border: "1px solid var(--border)", borderRadius: "2px" }}
          />
          <ReferenceLine x={data.cliffMonths} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: "Cliff", fill: "#f59e0b", fontSize: 9 }} />
          <Area type="stepAfter" dataKey="cumulative" stroke="var(--foreground)" strokeWidth={1.5} fill="url(#vestGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-1">
        Total: <strong>{data.totalShares.toLocaleString()}</strong> · Cliff: {data.cliffMonths}mo · Full vest: {data.totalMonths}mo
      </p>
    </div>
  );
}

// ─── Exercise Simulator ───────────────────────────────────────────────────────
function ExerciseSimulator({ grantId }: { grantId: number }) {
  const [shares, setShares] = useState("");
  const [fmv, setFmv] = useState("");
  const [taxRate, setTaxRate] = useState("20");
  const [enabled, setEnabled] = useState(false);

  const { data: latestFmvList } = trpc.valuations409a.list.useQuery();
  const latestFmvPrice = latestFmvList?.[0]?.fmvPerShareNtd ?? "";

  const { data: sim } = trpc.esop.exerciseSimulation.useQuery(
    { grantId, sharesToExercise: Number(shares), currentFmvNtd: fmv || latestFmvPrice || "0", taxRate: Number(taxRate) / 100 },
    { enabled: enabled && !!shares && !!(fmv || latestFmvPrice) }
  );

  const handleCalc = () => {
    if (!shares || Number(shares) <= 0) { toast.error("Enter shares to exercise"); return; }
    if (!fmv && !latestFmvPrice) { toast.error("Enter FMV or add a FMV Valuation record"); return; }
    setEnabled(true);
  };

  return (
    <div className="mt-4 p-4 bg-secondary/40 border border-border rounded-sm">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Exercise Simulator</span>
        {latestFmvPrice && <span className="text-xs text-muted-foreground ml-2">Latest FMV: NT${parseFloat(latestFmvPrice).toLocaleString()}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        {[
          { label: "Shares to Exercise", val: shares, set: (v: string) => { setShares(v); setEnabled(false); }, placeholder: "e.g. 10000" },
          { label: `Current FMV (NT$)`, val: fmv, set: (v: string) => { setFmv(v); setEnabled(false); }, placeholder: latestFmvPrice ? `Auto: ${parseFloat(latestFmvPrice).toFixed(2)}` : "e.g. 25.00" },
          { label: "Tax Rate (%)", val: taxRate, set: (v: string) => { setTaxRate(v); setEnabled(false); }, placeholder: "20" },
        ].map(f => (
          <div key={f.label} className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">{f.label}</label>
            <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
              className="w-full border border-input rounded-sm px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        ))}
      </div>
      <button onClick={handleCalc} className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-sm hover:opacity-90">Calculate</button>
      {sim && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Exercise Cost", val: `NT$${sim.exerciseCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-foreground" },
            { label: "Spread (Pre-Tax)", val: `NT$${sim.spread.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: sim.spread >= 0 ? "text-green-700" : "text-red-600" },
            { label: `Est. Tax (${taxRate}%)`, val: `NT$${sim.taxLiability.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-amber-700" },
            { label: "Net Gain", val: `NT$${sim.netGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: sim.netGain >= 0 ? "text-green-700" : "text-red-600" },
          ].map(c => (
            <div key={c.label} className="p-2 bg-card border border-border rounded-sm">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <p className={`text-sm font-semibold tabular-nums ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Grant Row (expandable) ───────────────────────────────────────────────────
function GrantRow({ grant, shareholders }: { grant: any; shareholders: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showVesting, setShowVesting] = useState(false);
  const [showSim, setShowSim] = useState(false);
  const { canDelete } = usePermissions();
  const utils = trpc.useUtils();

  const deleteGrant = trpc.esop.deleteGrant.useMutation({
    onSuccess: () => { utils.esop.grants.invalidate(); toast.success("Grant deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const granteeName = grant.granteeName || shareholders.find((s: any) => s.id === grant.shareholderId)?.name || `Grantee #${grant.id}`;
  const now = new Date();
  const expiryDate = grant.expiryDate ? new Date(grant.expiryDate) : null;
  const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000) : null;
  const vestedPct = grant.sharesGranted > 0 ? Math.round((grant.sharesVested / grant.sharesGranted) * 100) : 0;

  return (
    <>
      <tr className="cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => setExpanded(e => !e)}>
        <td className="font-medium">{granteeName}</td>
        <td className="text-muted-foreground">{formatDate(grant.grantDate)}</td>
        <td className="text-right tabular-nums">{formatShares(grant.sharesGranted)}</td>
        <td className="text-right tabular-nums">
          <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-foreground rounded-full" style={{ width: `${vestedPct}%` }} />
            </div>
            <span>{formatShares(grant.sharesVested)}</span>
          </div>
        </td>
        <td className="text-right tabular-nums">{formatShares(grant.sharesExercised)}</td>
        <td className="tabular-nums">{grant.exercisePriceNtd ? `NT$${parseFloat(grant.exercisePriceNtd).toFixed(2)}` : "—"}</td>
        <td className="text-muted-foreground text-xs">{grant.vestingCliffMonths}mo / {grant.vestingTotalMonths}mo</td>
        <td>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            grant.status === "active" ? "bg-green-100 text-green-700" :
            grant.status === "fully_vested" ? "bg-blue-100 text-blue-700" :
            grant.status === "exercised" ? "bg-purple-100 text-purple-700" :
            "bg-gray-100 text-gray-600"
          }`}>{grant.status}</span>
        </td>
        <td>
          {daysUntilExpiry !== null && daysUntilExpiry <= 90 && daysUntilExpiry >= 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full flex items-center gap-1 w-fit">
              <AlertTriangle className="h-2.5 w-2.5" />{daysUntilExpiry}d
            </span>
          )}
        </td>
        <td>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button onClick={e => { e.stopPropagation(); if (confirm("Delete this grant?")) deleteGrant.mutate({ id: grant.id }); }}
                className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="p-0">
            <div className="px-6 py-4 bg-secondary/20 border-t border-border space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground uppercase tracking-widest text-[10px]">Vesting Start</p>
                  <p className="font-medium mt-0.5">{formatDate(grant.vestingStartDate) || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-widest text-[10px]">Expiry Date</p>
                  <p className={`font-medium mt-0.5 ${daysUntilExpiry !== null && daysUntilExpiry <= 90 ? 'text-red-600' : ''}`}>
                    {expiryDate ? expiryDate.toLocaleDateString() : "—"}
                    {daysUntilExpiry !== null && daysUntilExpiry > 0 && <span className="text-muted-foreground ml-1">({daysUntilExpiry}d left)</span>}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-widest text-[10px]">Cancelled</p>
                  <p className="font-medium mt-0.5">{formatShares(grant.sharesCancelled)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-widest text-[10px]">Vested %</p>
                  <p className="font-medium mt-0.5">{vestedPct}%</p>
                </div>
              </div>
              {grant.notes && <p className="text-xs text-muted-foreground italic border-t border-border pt-2">{grant.notes}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowVesting(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-sm hover:bg-secondary transition-colors">
                  <TrendingUp className="h-3 w-3" /> {showVesting ? "Hide" : "Show"} Vesting Chart
                </button>
                <button onClick={() => setShowSim(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-sm hover:bg-secondary transition-colors">
                  <Calculator className="h-3 w-3" /> {showSim ? "Hide" : "Show"} Exercise Simulator
                </button>
              </div>
              {showVesting && <VestingChart grantId={grant.id} />}
              {showSim && <ExerciseSimulator grantId={grant.id} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function EsopContent() {
  const [showPoolForm, setShowPoolForm] = useState(false);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [editPoolId, setEditPoolId] = useState<number | null>(null);
  const { canEdit, canDelete } = usePermissions();
  const [poolForm, setPoolForm] = useState({ poolName: "ESOP Pool", totalShares: "", notes: "" });
  const [grantForm, setGrantForm] = useState({
    esopPoolId: 0, granteeName: "", grantDate: "", sharesGranted: "",
    exercisePriceNtd: "", vestingStartDate: "", vestingCliffMonths: "12",
    vestingTotalMonths: "48", expiryDate: "", notes: "",
  });

  const utils = trpc.useUtils();
  const { data: pools } = trpc.esop.pools.useQuery();
  const { data: grants, isLoading: grantsLoading } = trpc.esop.grants.useQuery();
  const { data: shareholders } = trpc.shareholders.list.useQuery();
  const { data: expiringGrants = [] } = trpc.esop.expiringGrants.useQuery({ withinDays: 90 });

  const createPool = trpc.esop.createPool.useMutation({
    onSuccess: () => { utils.esop.pools.invalidate(); setShowPoolForm(false); toast.success("ESOP pool created"); },
    onError: (e) => toast.error(e.message),
  });
  const updatePool = trpc.esop.updatePool.useMutation({
    onSuccess: () => { utils.esop.pools.invalidate(); setEditPoolId(null); setShowPoolForm(false); toast.success("Pool updated"); },
    onError: (e) => toast.error(e.message),
  });
  const createGrant = trpc.esop.createGrant.useMutation({
    onSuccess: () => { utils.esop.grants.invalidate(); utils.esop.pools.invalidate(); setShowGrantForm(false); toast.success("Grant created"); },
    onError: (e) => toast.error(e.message),
  });

  const totalPool = useMemo(() => (pools || []).reduce((s, p) => s + p.totalShares, 0), [pools]);
  const totalAllocated = useMemo(() => (pools || []).reduce((s, p) => s + p.allocatedShares, 0), [pools]);
  const totalVested = useMemo(() => (pools || []).reduce((s, p) => s + p.vestedShares, 0), [pools]);
  const totalExercised = useMemo(() => (pools || []).reduce((s, p) => s + p.exercisedShares, 0), [pools]);
  const totalUnallocated = totalPool - totalAllocated;

  const poolPieData = [
    { name: "Allocated", value: totalAllocated, color: "#1a1a14" },
    { name: "Unallocated", value: Math.max(0, totalUnallocated), color: "#d4c9a8" },
  ].filter(d => d.value > 0);

  const vestingPieData = [
    { name: "Vested", value: totalVested, color: "#3d8c5a" },
    { name: "Unvested", value: Math.max(0, totalAllocated - totalVested), color: "#d4c9a8" },
    { name: "Exercised", value: totalExercised, color: "#1a1a14" },
  ].filter(d => d.value > 0);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            ESOP Management
          </h1>
          <p className="text-sm text-muted-foreground">Employee Stock Option Plan · {formatShares(totalPool)} total pool shares</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const headers = ["Grantee", "Grant Date", "Shares Granted", "Vested", "Exercised", "Exercise Price (NTD)", "Vesting Start", "Expiry Date", "Status", "Notes"];
              const rows = (grants || []).map(g => [
                g.granteeName || "",
                g.grantDate || "",
                g.sharesGranted ?? "",
                g.sharesVested ?? "",
                g.sharesExercised ?? "",
                g.exercisePriceNtd || "",
                g.vestingStartDate || "",
                g.expiryDate || "",
                g.status || "",
                g.notes || "",
              ]);
              const csv = [headers, ...rows]
                .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
                .join("\n");
              const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `esop-grants-${new Date().toISOString().split("T")[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${rows.length} grants`);
            }}
            disabled={!(grants || []).length}
            className="flex items-center gap-2 px-3 py-2 border border-border text-sm text-muted-foreground font-medium rounded-sm hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          {canEdit && (
            <button
              onClick={() => { setEditPoolId(null); setPoolForm({ poolName: "ESOP Pool", totalShares: "", notes: "" }); setShowPoolForm(true); }}
              className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Pool
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => { setGrantForm(f => ({ ...f, esopPoolId: pools?.[0]?.id || 0, granteeName: "", grantDate: "", sharesGranted: "", exercisePriceNtd: "", vestingStartDate: "", expiryDate: "", notes: "" })); setShowGrantForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
              disabled={!pools?.length}
            >
              <Sparkles className="h-4 w-4" /> New Grant
            </button>
          )}
        </div>
      </div>

      {/* Expiry Alerts */}
      {expiringGrants.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">{expiringGrants.length} grant{expiringGrants.length > 1 ? 's' : ''} expiring within 90 days</span>
          </div>
          <div className="space-y-1">
            {expiringGrants.map(g => {
              const sh = (shareholders || []).find(s => s.id === g.shareholderId);
              return (
                <div key={g.id} className="flex justify-between text-xs text-red-700">
                  <span>{sh?.name ?? `Grantee #${g.shareholderId}`} — {g.sharesGranted.toLocaleString()} shares</span>
                  <span className="font-semibold">{g.daysUntilExpiry} days left</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {totalPool > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Pool", value: formatShares(totalPool), sub: "authorized shares" },
            { label: "Allocated", value: formatShares(totalAllocated), sub: `${totalPool > 0 ? ((totalAllocated / totalPool) * 100).toFixed(1) : 0}% of pool` },
            { label: "Vested", value: formatShares(totalVested), sub: `${totalAllocated > 0 ? ((totalVested / totalAllocated) * 100).toFixed(1) : 0}% of allocated` },
            { label: "Unallocated", value: formatShares(totalUnallocated), sub: "available to grant" },
          ].map(card => (
            <div key={card.label} className="bg-card border border-border rounded-sm p-5 space-y-2">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">{card.label}</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {totalPool > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-sm p-5 space-y-3">
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Pool Allocation</p>
            <div className="flex items-center gap-6">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={poolPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                      {poolPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [formatShares(v), ""]} contentStyle={{ fontSize: "11px", border: "1px solid var(--border)", borderRadius: "2px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {poolPieData.map((d, i) => (
                  <div key={`legend-${i}-${d.name}`} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-medium tabular-nums">{formatShares(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-sm p-5 space-y-3">
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Vesting Status</p>
            <div className="flex items-center gap-6">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={vestingPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                      {vestingPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [formatShares(v), ""]} contentStyle={{ fontSize: "11px", border: "1px solid var(--border)", borderRadius: "2px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {vestingPieData.map((d, i) => (
                  <div key={`legend-${i}-${d.name}`} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-medium tabular-nums">{formatShares(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pool Form */}
      {showPoolForm && (
        <div className="bg-card border border-border rounded-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">{editPoolId !== null ? "Edit ESOP Pool" : "New ESOP Pool"}</h3>
            <button onClick={() => { setShowPoolForm(false); setEditPoolId(null); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Pool Name</label>
              <input type="text" value={poolForm.poolName} onChange={e => setPoolForm(f => ({ ...f, poolName: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Total Shares *</label>
              <input type="number" value={poolForm.totalShares} onChange={e => setPoolForm(f => ({ ...f, totalShares: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="1250000" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Notes</label>
              <textarea value={poolForm.notes} onChange={e => setPoolForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (editPoolId !== null) {
                  updatePool.mutate({ id: editPoolId, data: { totalShares: parseInt(poolForm.totalShares), notes: poolForm.notes || undefined } });
                } else {
                  createPool.mutate({ poolName: poolForm.poolName, totalShares: parseInt(poolForm.totalShares), notes: poolForm.notes || undefined });
                }
              }}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
            >
              <Check className="h-4 w-4" /> {editPoolId !== null ? "Update" : "Create"} Pool
            </button>
            <button onClick={() => { setShowPoolForm(false); setEditPoolId(null); }} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Grant Form */}
      {showGrantForm && (
        <div className="bg-card border border-border rounded-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">New ESOP Grant</h3>
            <button onClick={() => setShowGrantForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "ESOP Pool *", type: "select", key: "esopPoolId", options: (pools || []).map(p => ({ value: p.id, label: p.poolName })) },
              { label: "Grantee Name *", type: "text", key: "granteeName", placeholder: "e.g. John Smith" },
              { label: "Shares Granted *", type: "number", key: "sharesGranted", placeholder: "50000" },
              { label: "Grant Date", type: "date", key: "grantDate" },
              { label: "Exercise Price (NT$)", type: "number", key: "exercisePriceNtd", placeholder: "10" },
              { label: "Vesting Start", type: "date", key: "vestingStartDate" },
              { label: "Cliff (months)", type: "number", key: "vestingCliffMonths" },
              { label: "Vesting Period (months)", type: "number", key: "vestingTotalMonths" },
              { label: "Expiry Date", type: "date", key: "expiryDate" },
            ].map(field => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">{field.label}</label>
                {field.type === "select" ? (
                  <select value={(grantForm as any)[field.key]} onChange={e => setGrantForm(f => ({ ...f, [field.key]: field.key === "esopPoolId" ? parseInt(e.target.value) : e.target.value }))}
                    className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring">
                    {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input type={field.type} value={(grantForm as any)[field.key]} onChange={e => setGrantForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={(field as any).placeholder}
                    className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                )}
              </div>
            ))}
            <div className="col-span-2 lg:col-span-3 space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Notes</label>
              <input type="text" value={grantForm.notes} onChange={e => setGrantForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => createGrant.mutate({
                esopPoolId: grantForm.esopPoolId,
                granteeName: grantForm.granteeName || undefined,
                sharesGranted: parseInt(grantForm.sharesGranted),
                grantDate: grantForm.grantDate || undefined,
                exercisePriceNtd: grantForm.exercisePriceNtd || undefined,
                vestingStartDate: grantForm.vestingStartDate || undefined,
                vestingCliffMonths: parseInt(grantForm.vestingCliffMonths),
                vestingTotalMonths: parseInt(grantForm.vestingTotalMonths),
                expiryDate: grantForm.expiryDate || undefined,
                notes: grantForm.notes || undefined,
              })}
              disabled={!grantForm.sharesGranted || !grantForm.granteeName || !grantForm.esopPoolId || createGrant.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Check className="h-4 w-4" /> {createGrant.isPending ? "Creating..." : "Create Grant"}
            </button>
            <button onClick={() => setShowGrantForm(false)} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Pools Table */}
      {(pools || []).length > 0 && (
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold tracking-tight">ESOP Pools</h3>
          </div>
          <table className="cap-table w-full">
            <thead>
              <tr>
                <th>Pool Name</th>
                <th className="text-right">Total Shares</th>
                <th className="text-right">Allocated</th>
                <th className="text-right">Vested</th>
                <th className="text-right">Exercised</th>
                <th className="text-right">Unallocated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(pools || []).map(p => (
                <tr key={p.id}>
                  <td className="font-medium">{p.poolName}</td>
                  <td className="text-right tabular-nums">{formatShares(p.totalShares)}</td>
                  <td className="text-right tabular-nums">{formatShares(p.allocatedShares)}</td>
                  <td className="text-right tabular-nums">{formatShares(p.vestedShares)}</td>
                  <td className="text-right tabular-nums">{formatShares(p.exercisedShares)}</td>
                  <td className="text-right tabular-nums font-medium">{formatShares(p.totalShares - p.allocatedShares)}</td>
                  <td>
                    {canEdit && (
                      <button onClick={() => { setEditPoolId(p.id); setPoolForm({ poolName: p.poolName, totalShares: String(p.totalShares), notes: p.notes || "" }); setShowPoolForm(true); }}
                        className="text-muted-foreground hover:text-foreground transition-colors">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grants Table */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight">Option Grants</h3>
          <p className="text-xs text-muted-foreground">Click a row to expand vesting chart and exercise simulator</p>
        </div>
        {grantsLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !(grants || []).length ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-semibold">No option grants yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {(pools || []).length === 0
                  ? "Create an ESOP pool first, then issue grants from that pool to employees."
                  : "Issue your first grant from the pool to an employee."}
              </p>
            </div>
            {canEdit && (
              <div className="flex items-center justify-center gap-3 pt-2">
                {(pools || []).length === 0 ? (
                  <button
                    onClick={() => { setEditPoolId(null); setPoolForm({ poolName: "ESOP Pool", totalShares: "", notes: "" }); setShowPoolForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
                  >
                    <Plus className="h-4 w-4" /> Create Pool
                  </button>
                ) : (
                  <button
                    onClick={() => { setGrantForm(f => ({ ...f, esopPoolId: pools?.[0]?.id || 0, granteeName: "", grantDate: "", sharesGranted: "", exercisePriceNtd: "", vestingStartDate: "", expiryDate: "", notes: "" })); setShowGrantForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="h-4 w-4" /> Issue First Grant
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <table className="cap-table w-full">
            <thead>
              <tr>
                <th>Grantee</th>
                <th>Grant Date</th>
                <th className="text-right">Shares</th>
                <th className="text-right">Vested</th>
                <th className="text-right">Exercised</th>
                <th>Exercise Price</th>
                <th>Cliff / Period</th>
                <th>Status</th>
                <th>Expiry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(grants || []).map(g => (
                <GrantRow key={g.id} grant={g} shareholders={shareholders || []} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
