import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatShares, formatValuation, formatDate, getRoundLabel, ROUND_CHART_COLORS } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, Users, PieChart as PieIcon, Sparkles, ArrowRight, AlertTriangle, Lock, FileText, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useMemo } from "react";

export default function Home() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}

function DashboardContent() {
  const [, setLocation] = useLocation();
  const { data: summary, isLoading } = trpc.capTable.summary.useQuery();
  const { data: rounds } = trpc.fundingRounds.list.useQuery();

  const pieData = useMemo(() => {
    if (!summary?.shareholders) return [];
    return summary.shareholders
      .filter(s => s.totalShares > 0)
      .slice(0, 8)
      .map(s => ({
        id: s.id,
        name: s.name,
        value: s.totalShares,
        type: s.type || "other",
      }));
  }, [summary]);

  const roundsChartData = useMemo(() => {
    if (!rounds) return [];
    return rounds
      .filter(r => (r as any).postMoneyCalc || r.postMoneyValuationNtd)
      .map(r => ({
        name: r.name,
        valuation: ((r as any).postMoneyCalc ?? parseFloat(r.postMoneyValuationNtd || "0")) / 1_000_000,
        raised: parseFloat(r.moneyRaisedNtd || "0") / 1_000_000,
      }));
  }, [rounds]);

  const latestRound = summary?.latestRound;
  const totalShares = summary?.totalShares || 0;
  const shareholderCount = summary?.shareholders?.length || 0;
  const esopPool = summary?.esopPool;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = totalShares > 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="space-y-1">
        <div className="h-px bg-foreground/20 w-16 mb-4" />
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Equity Dashboard
        </h1>
        <p className="text-sm text-muted-foreground" style={{ letterSpacing: "0.05em" }}>
          {hasData ? `As of ${formatDate(latestRound?.roundDate || new Date())} · ${latestRound?.name || "Current"} Round` : "No data yet — import your cap table to get started"}
        </p>
      </div>

      {!hasData ? (
        /* Empty State */
        <div className="border border-dashed border-border rounded-sm p-16 text-center space-y-6">
          <div className="space-y-2">
            <p className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Begin Your Cap Table
            </p>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Import your existing Excel cap table or add shareholders manually to start tracking your equity structure.
            </p>
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setLocation("/import")}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
            >
              Import Excel <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLocation("/investors")}
              className="flex items-center gap-2 px-6 py-3 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors"
            >
              Add Manually
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Shares"
              value={formatShares(totalShares)}
              icon={<PieIcon className="h-4 w-4" />}
              sub={`${shareholderCount} shareholders`}
              onClick={() => setLocation("/cap-table")}
            />
            <KpiCard
              label="Post-Money Valuation"
              value={formatValuation(
                String((latestRound as any)?.postMoneyCalc ?? latestRound?.postMoneyValuationNtd ?? ""),
                "USD"
              )}
              icon={<TrendingUp className="h-4 w-4" />}
              sub={formatValuation(
                String((latestRound as any)?.postMoneyCalc ?? latestRound?.postMoneyValuationNtd ?? ""),
                "NTD"
              )}
              onClick={() => setLocation("/funding-rounds")}
            />
            <KpiCard
              label="Shareholders"
              value={String(shareholderCount)}
              icon={<Users className="h-4 w-4" />}
              sub={`Latest: ${getRoundLabel(latestRound?.name || "")}`}
              onClick={() => setLocation("/investors")}
            />
            <KpiCard
              label="ESOP Pool"
              value={formatShares(esopPool?.total)}
              icon={<Sparkles className="h-4 w-4" />}
              sub={`${formatShares(esopPool?.unallocated)} unallocated`}
              onClick={() => setLocation("/esop")}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Ownership Pie */}
            <div className="lg:col-span-2 bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-0.5">
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">Ownership</p>
                <h3 className="text-lg font-semibold tracking-tight">Equity Distribution</h3>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={ROUND_CHART_COLORS[index % ROUND_CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatShares(value) + " shares", ""]}
                      contentStyle={{ fontSize: "12px", border: "1px solid var(--border)", borderRadius: "2px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="space-y-1.5">
                {pieData.slice(0, 5).map((entry, i) => (
                  <div key={`pie-${entry.id ?? i}`} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: ROUND_CHART_COLORS[i % ROUND_CHART_COLORS.length] }}
                      />
                      <span className="text-foreground truncate max-w-[120px]">{entry.name}</span>
                    </div>
                    <span className="text-muted-foreground tabular-nums">
                      {totalShares > 0 ? ((entry.value / totalShares) * 100).toFixed(1) + "%" : "—"}
                    </span>
                  </div>
                ))}
                {pieData.length > 5 && (
                  <p className="text-xs text-muted-foreground">+{pieData.length - 5} more</p>
                )}
              </div>
            </div>

            {/* Valuation Bar Chart */}
            <div className="lg:col-span-3 bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-0.5">
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">Valuation History</p>
                <h3 className="text-lg font-semibold tracking-tight">Post-Money by Round (NT$ M)</h3>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={roundsChartData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${v}M`}
                    />
                    <Tooltip
                      formatter={(v: number) => [`NT$ ${v.toFixed(1)}M`, ""]}
                      contentStyle={{ fontSize: "12px", border: "1px solid var(--border)", borderRadius: "2px" }}
                    />
                    <Bar dataKey="valuation" fill="var(--primary)" radius={[2, 2, 0, 0]} name="Post-Money" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Rounds Table */}
          <div className="bg-card border border-border rounded-sm">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">History</p>
                <h3 className="text-base font-semibold tracking-tight">Funding Rounds</h3>
              </div>
              <button
                onClick={() => setLocation("/funding-rounds")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <table className="cap-table w-full">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Date</th>
                  <th>Price / Share</th>
                  <th>Raised</th>
                  <th>Post-Money</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(rounds || []).slice(0, 6).map(r => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => setLocation("/funding-rounds")}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-muted-foreground">{formatDate(r.roundDate)}</td>
                    <td className="tabular-nums">{r.pricePerShareNtd ? `NT$ ${parseFloat(r.pricePerShareNtd).toLocaleString()}` : "—"}</td>
                    <td className="tabular-nums">{formatValuation(r.moneyRaisedNtd)}</td>
                    <td className="tabular-nums">{formatValuation(String((r as any).postMoneyCalc ?? r.postMoneyValuationNtd ?? ""))}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === "completed" ? "bg-green-100 text-green-700" :
                        r.status === "bridge" ? "bg-orange-100 text-orange-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

          {/* Compliance Alerts Row */}
          <ComplianceAlerts />
    </div>
  );
}

function ComplianceAlerts() {
  const [, setLocation] = useLocation();
  const { data: lockups } = trpc.compliance.upcomingLockups.useQuery();
  const { data: taxDeductions } = trpc.compliance.taxDeductions.useQuery();
  const { data: documents } = trpc.documents.list.useQuery();
  const { data: expiringGrants } = trpc.esop.expiringGrants.useQuery();
  const { data: shareholders } = trpc.shareholders.list.useQuery();

  const shMap = useMemo(() => {
    const m = new Map<number, string>();
    (shareholders || []).forEach(s => m.set(s.id, s.name));
    return m;
  }, [shareholders]);

  const hasLockups = lockups && lockups.length > 0;
  const hasTax = taxDeductions && taxDeductions.length > 0;
  const hasExpGrants = expiringGrants && expiringGrants.length > 0;

  if (!hasLockups && !hasTax && !hasExpGrants) {
    return (
      <div className="bg-card border border-border rounded-sm p-6 text-center text-muted-foreground text-sm">
        No compliance alerts at this time.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Lock-up Expiry Table */}
      {hasLockups && (
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> Lock-up Expiry
              <span className="text-xs font-normal text-muted-foreground">({lockups.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="cap-table w-full">
              <thead>
                <tr>
                  <th>Shareholder</th>
                  <th>Transaction</th>
                  <th className="text-right">Shares</th>
                  <th>Lock-up End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lockups.map((l: any, i: number) => {
                  const isExpired = new Date(l.lockUpEndDate) < new Date();
                  const isExpiringSoon = !isExpired && new Date(l.lockUpEndDate) < new Date(Date.now() + 90 * 86400000);
                  return (
                    <tr key={i}>
                      <td className="font-medium text-sm">{shMap.get(l.shareholderId) || `#${l.shareholderId}`}</td>
                      <td className="text-xs text-muted-foreground">{l.transactionType?.replace(/_/g, " ") || "\u2014"}</td>
                      <td className="text-right tabular-nums">{l.sharesAmount?.toLocaleString() || "\u2014"}</td>
                      <td className="tabular-nums">{l.lockUpEndDate}</td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isExpired ? "bg-red-100 text-red-700" :
                          isExpiringSoon ? "bg-amber-100 text-amber-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {isExpired ? "Expired" : isExpiringSoon ? "Expiring Soon" : "Active"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tax Benefit Expiry Table */}
      {hasTax && (
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-500" /> Tax Benefit Expiry
              <span className="text-xs font-normal text-muted-foreground">({taxDeductions.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="cap-table w-full">
              <thead>
                <tr>
                  <th>Shareholder</th>
                  <th>Tax Deduction Year</th>
                  <th >Tax Deduction Amount</th>
                  <th>Tax Qualified</th>
                </tr>
              </thead>
              <tbody>
                {taxDeductions.map((t: any, i: number) => (
                  <tr key={i}>
                    <td className="font-medium text-sm">{shMap.get(t.shareholderId) || `#${t.shareholderId}`}</td>
                    <td className="tabular-nums">{t.taxDeductionYear || "\u2014"}</td>
                    <td className="tabular-nums">
                      {t.taxDeductionAmountNtd ? `NT$ ${parseFloat(t.taxDeductionAmountNtd).toLocaleString()}` : "\u2014"}
                    </td>
                    <td>
                      {t.taxQualified ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Yes</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">\u2014</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ESOP Expiring Grants Table */}
      {hasExpGrants && (
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-purple-500" /> Expiring ESOP Grants
              <span className="text-xs font-normal text-muted-foreground">({expiringGrants.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="cap-table w-full">
              <thead>
                <tr>
                  <th>Shareholder</th>
                  <th>Grant Date</th>
                  <th className="text-right">Shares</th>
                  <th>Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {expiringGrants.map((g: any, i: number) => (
                  <tr key={i}>
                    <td className="font-medium text-sm">{shMap.get(g.shareholderId) || `#${g.shareholderId}`}</td>
                    <td className="text-muted-foreground tabular-nums">{g.grantDate || "\u2014"}</td>
                    <td className="text-right tabular-nums">{g.sharesAmount?.toLocaleString() || "\u2014"}</td>
                    <td className="tabular-nums">{g.expiryDate || "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label, value, icon, sub, onClick,
}: {
  label: string; value: string; icon: React.ReactNode; sub?: string; onClick?: () => void;
}) {
  return (
    <div
      className="bg-card border border-border rounded-sm p-5 space-y-3 cursor-pointer hover:border-foreground/30 transition-colors group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">{label}</p>
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">{icon}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
