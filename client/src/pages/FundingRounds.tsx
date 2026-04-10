import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, X, Check, TrendingUp, DollarSign, Layers, BarChart2, Info } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { usePermissions } from "@/hooks/usePermissions";

export default function FundingRoundsPage() {
  return (
    <DashboardLayout>
      <FundingRoundsContent />
    </DashboardLayout>
  );
}

type RoundForm = {
  name: string;
  roundDate: string;
  pricePerShareNtd: string;
  moneyRaisedNtd: string;
  preMoneyValuationNtd: string;
  postMoneyValuationNtd: string;
  status: "completed" | "projected" | "bridge";
  notes: string;
};

const emptyForm: RoundForm = {
  name: "", roundDate: "", pricePerShareNtd: "", moneyRaisedNtd: "",
  preMoneyValuationNtd: "", postMoneyValuationNtd: "", status: "completed", notes: "",
};

function fmtV(v: number | null | undefined, currency: "NTD" | "USD", exchangeRate: number): string {
  if (!v || v === 0) return "—";
  if (currency === "USD") {
    const usd = v * exchangeRate;
    if (usd >= 1_000_000) return `USD ${(usd / 1_000_000).toFixed(2)}M`;
    return `USD ${(usd / 1_000).toFixed(0)}K`;
  }
  if (v >= 100_000_000) return `NT$ ${(v / 100_000_000).toFixed(2)}億`;
  if (v >= 10_000_000) return `NT$ ${(v / 10_000_000).toFixed(1)}千萬`;
  if (v >= 10_000) return `NT$ ${(v / 10_000).toFixed(0)}萬`;
  return `NT$ ${v.toLocaleString()}`;
}

function FundingRoundsContent() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<RoundForm>(emptyForm);
  const [currency, setCurrency] = useState<"NTD" | "USD">("NTD");
  const exchangeRate = 0.03128;
  const { canEdit, canDelete } = usePermissions();
  const utils = trpc.useUtils();

  const { data: rounds, isLoading } = trpc.fundingRounds.list.useQuery();

  const createRound = trpc.fundingRounds.create.useMutation({
    onSuccess: () => {
      utils.fundingRounds.list.invalidate();
      utils.capTable.summary.invalidate();
      setShowForm(false);
      setForm(emptyForm);
      toast.success("Round created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRound = trpc.fundingRounds.update.useMutation({
    onSuccess: () => {
      utils.fundingRounds.list.invalidate();
      utils.capTable.summary.invalidate();
      setEditId(null);
      setShowForm(false);
      toast.success("Round updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteRound = trpc.fundingRounds.delete.useMutation({
    onSuccess: () => {
      utils.fundingRounds.list.invalidate();
      utils.capTable.summary.invalidate();
      toast.success("Round deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  // Auto-calculate derived fields from form inputs
  const derived = useMemo(() => {
    const price = parseFloat(form.pricePerShareNtd) || 0;
    const raised = parseFloat(form.moneyRaisedNtd) || 0;
    const preMoney = parseFloat(form.preMoneyValuationNtd) || 0;
    const postMoney = parseFloat(form.postMoneyValuationNtd) || 0;

    const sharesIssuedCalc = price > 0 && raised > 0 ? Math.round(raised / price) : null;
    const postMoneyCalc = preMoney > 0 && raised > 0 && !form.postMoneyValuationNtd ? preMoney + raised : null;
    const preMoneyCalc = postMoney > 0 && raised > 0 && !form.preMoneyValuationNtd ? postMoney - raised : null;

    return { sharesIssuedCalc, postMoneyCalc, preMoneyCalc };
  }, [form.pricePerShareNtd, form.moneyRaisedNtd, form.preMoneyValuationNtd, form.postMoneyValuationNtd]);

  function handleSubmit() {
    const payload = {
      name: form.name,
      roundDate: form.roundDate || undefined,
      pricePerShareNtd: form.pricePerShareNtd || undefined,
      moneyRaisedNtd: form.moneyRaisedNtd || undefined,
      preMoneyValuationNtd: form.preMoneyValuationNtd ||
        (derived.preMoneyCalc ? String(derived.preMoneyCalc) : undefined),
      postMoneyValuationNtd: form.postMoneyValuationNtd ||
        (derived.postMoneyCalc ? String(derived.postMoneyCalc) : undefined),
      status: form.status,
      notes: form.notes || undefined,
    };
    if (editId !== null) {
      updateRound.mutate({ id: editId, data: payload });
    } else {
      createRound.mutate(payload);
    }
  }

  function startEdit(r: NonNullable<typeof rounds>[0]) {
    setEditId(r.id);
    setForm({
      name: r.name,
      roundDate: r.roundDate ? String(r.roundDate).slice(0, 10) : "",
      pricePerShareNtd: r.pricePerShareNtd ?? "",
      moneyRaisedNtd: r.moneyRaisedNtd ?? "",
      preMoneyValuationNtd: r.preMoneyValuationNtd ?? "",
      postMoneyValuationNtd: r.postMoneyValuationNtd ?? "",
      status: r.status,
      notes: r.notes ?? "",
    });
    setShowForm(true);
  }

  const sortedRounds = rounds ?? [];

  // Summary stats
  const totalRaised = sortedRounds.reduce((s, r) => s + (Number(r.moneyRaisedNtd) || 0), 0);
  const latestRound = sortedRounds.filter(r => r.status === "completed").at(-1);
  const latestPostMoney = latestRound
    ? ((latestRound as any).postMoneyCalc ?? Number(latestRound.postMoneyValuationNtd) ?? 0)
    : 0;
  const totalSharesIssued = sortedRounds.reduce((s, r) => s + ((r as any).sharesIssued ?? 0), 0);

  const chartData = sortedRounds.map(r => ({
    name: r.name,
    preMoney: ((r as any).preMoneyCalc ?? 0) / 1_000_000,
    postMoney: ((r as any).postMoneyCalc ?? 0) / 1_000_000,
    raised: (Number(r.moneyRaisedNtd) || 0) / 1_000_000,
  }));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funding Rounds</h1>
          <p className="text-muted-foreground mt-1">
            Track investment rounds, share issuance, and valuation history.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border border-border rounded-sm overflow-hidden text-xs">
            {(["NTD", "USD"] as const).map(c => (
              <button key={c} onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 font-medium transition-colors ${currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {c}
              </button>
            ))}
          </div>
          {canEdit && (
            <button
              onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Add Round
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Rounds", value: sortedRounds.length.toString(), icon: Layers, sub: `${sortedRounds.filter(r => r.status === "completed").length} completed` },
          { label: "Total Raised", value: fmtV(totalRaised, currency, exchangeRate), icon: DollarSign, sub: latestRound ? `Latest: ${latestRound.name}` : "No rounds yet" },
          { label: "Latest Post-Money", value: fmtV(latestPostMoney, currency, exchangeRate), icon: TrendingUp, sub: latestRound?.name ?? "—" },
          { label: "Total Shares Issued", value: totalSharesIssued > 0 ? totalSharesIssued.toLocaleString() : "—", icon: BarChart2, sub: "From all rounds" },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium tracking-widest uppercase text-muted-foreground">{card.label}</span>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold tabular-nums">{card.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {chartData.some(d => d.postMoney > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-sm p-5 space-y-3">
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Pre vs Post-Money Valuation (NT$ M)</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={2} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}M`} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`NT$ ${v.toFixed(1)}M`, name === "preMoney" ? "Pre-Money" : "Post-Money"]}
                    contentStyle={{ fontSize: "11px", border: "1px solid var(--border)", borderRadius: "4px" }}
                  />
                  <Bar dataKey="preMoney" name="Pre-Money" fill="#A8D8D5" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="postMoney" name="Post-Money" fill="#4BBFB5" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card border border-border rounded-sm p-5 space-y-3">
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Capital Raised per Round (NT$ M)</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}M`} />
                  <Tooltip formatter={(v: number) => [`NT$ ${v.toFixed(1)}M`, "Raised"]} contentStyle={{ fontSize: "11px", border: "1px solid var(--border)", borderRadius: "4px" }} />
                  <Bar dataKey="raised" fill="#2C3E50" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">{editId !== null ? "Edit Round" : "New Funding Round"}</h3>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Round Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Series A" />
            <FormField label="Close Date" type="date" value={form.roundDate} onChange={v => setForm(f => ({ ...f, roundDate: v }))} />
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as RoundForm["status"] }))}
                className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="completed">Completed</option>
                <option value="bridge">Bridge</option>
                <option value="projected">Projected</option>
              </select>
            </div>
          </div>

          {/* Financial Inputs with auto-calc hint */}
          <div className="border border-border/60 rounded-sm p-4 space-y-4 bg-secondary/20">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Enter Price/Share + Money Raised to auto-calculate Shares Issued and Post-Money Valuation.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Price / Share (NT$)</label>
                <input
                  type="number" value={form.pricePerShareNtd}
                  onChange={e => setForm(f => ({ ...f, pricePerShareNtd: e.target.value }))}
                  placeholder="e.g. 10.00"
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Money Raised (NT$)</label>
                <input
                  type="number" value={form.moneyRaisedNtd}
                  onChange={e => setForm(f => ({ ...f, moneyRaisedNtd: e.target.value }))}
                  placeholder="e.g. 5000000"
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  Shares Issued
                  {derived.sharesIssuedCalc !== null && (
                    <span className="ml-1 text-primary font-normal normal-case">(auto)</span>
                  )}
                </label>
                <input
                  type="text" disabled
                  value={derived.sharesIssuedCalc !== null ? derived.sharesIssuedCalc.toLocaleString() : ""}
                  placeholder="Auto-calculated"
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-secondary/40 text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  Pre-Money Valuation (NT$)
                  {derived.preMoneyCalc !== null && !form.preMoneyValuationNtd && (
                    <span className="ml-1 text-primary font-normal normal-case">(auto)</span>
                  )}
                </label>
                <input
                  type="number" value={form.preMoneyValuationNtd}
                  onChange={e => setForm(f => ({ ...f, preMoneyValuationNtd: e.target.value }))}
                  placeholder={derived.preMoneyCalc ? `Auto: ${derived.preMoneyCalc.toLocaleString()}` : "e.g. 20000000"}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  Post-Money Valuation (NT$)
                  {derived.postMoneyCalc !== null && !form.postMoneyValuationNtd && (
                    <span className="ml-1 text-primary font-normal normal-case">(auto)</span>
                  )}
                </label>
                <input
                  type="number" value={form.postMoneyValuationNtd}
                  onChange={e => setForm(f => ({ ...f, postMoneyValuationNtd: e.target.value }))}
                  placeholder={derived.postMoneyCalc ? `Auto: ${derived.postMoneyCalc.toLocaleString()}` : "e.g. 25000000"}
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Notes</label>
            <textarea
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Optional notes..."
              className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={!form.name || createRound.isPending || updateRound.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Check className="h-4 w-4" /> {editId !== null ? "Update" : "Create"} Round
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-5 py-2 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rounds Detail Table */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight">Round Details</h3>
          <span className="text-xs text-muted-foreground">{sortedRounds.length} round{sortedRounds.length !== 1 ? "s" : ""}</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !sortedRounds.length ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No funding rounds yet. Add your first round above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">#</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Round</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Price / Share</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Shares Issued</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Money Raised</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Pre-Money</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Post-Money</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Cumul. Shares</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedRounds.map((r, i) => {
                  const sharesIssued = (r as any).sharesIssued ?? 0;
                  const preMoneyCalc = (r as any).preMoneyCalc as number | null;
                  const postMoneyCalc = (r as any).postMoneyCalc as number | null;
                  const cumulativeAfter = (r as any).cumulativeSharesAfter ?? 0;
                  const price = Number(r.pricePerShareNtd) || 0;
                  const priceDisplay = price
                    ? currency === "USD"
                      ? `$${(price * exchangeRate).toFixed(4)}`
                      : `NT$ ${price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                    : "—";

                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/10 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold">{r.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(r.roundDate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">{priceDisplay}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {sharesIssued > 0
                          ? <span className="font-medium">{sharesIssued.toLocaleString()}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtV(Number(r.moneyRaisedNtd) || null, currency, exchangeRate)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {preMoneyCalc != null && preMoneyCalc > 0
                          ? fmtV(preMoneyCalc, currency, exchangeRate)
                          : <span className="text-muted-foreground/40">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {postMoneyCalc != null && postMoneyCalc > 0
                          ? <span className="text-primary">{fmtV(postMoneyCalc, currency, exchangeRate)}</span>
                          : <span className="text-muted-foreground/40">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                        {cumulativeAfter > 0 ? cumulativeAfter.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.status === "completed" ? "bg-green-100 text-green-700" :
                          r.status === "bridge" ? "bg-orange-100 text-orange-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <button onClick={() => startEdit(r)} className="text-muted-foreground hover:text-foreground transition-colors">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => { if (confirm(`Delete "${r.name}"?`)) deleteRound.mutate({ id: r.id }); }}
                              className="text-muted-foreground hover:text-destructive transition-colors"
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
              {sortedRounds.length > 1 && (
                <tfoot className="bg-secondary/30 border-t-2 border-border">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-sm">
                      {totalSharesIssued > 0 ? totalSharesIssued.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-sm">
                      {fmtV(totalRaised, currency, exchangeRate)}
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Calculation Note */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-sm p-4">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div>
          <strong>How values are calculated:</strong> Pre-Money = Price/Share × Shares outstanding before this round.
          Post-Money = Pre-Money + Money Raised. Shares Issued = Money Raised ÷ Price/Share.
          If you enter manual valuations, those take precedence. Shares Issued is sourced from Share Register transactions where available.
        </div>
      </div>
    </div>
  );
}

function FormField({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium tracking-wide uppercase text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-input rounded-sm px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}
