import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatShares, formatValuation, formatDate, getRoundLabel, ROUND_CHART_COLORS } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, Users, PieChart as PieIcon, Sparkles, ArrowRight, AlertTriangle, Lock, FileText, Clock, Briefcase, Shield, Camera, Calculator } from "lucide-react";
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
        /* Empty State + Onboarding */
        <>
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

          {/* Feature Guide */}
          <div className="space-y-4">
            <div className="space-y-0.5">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">Getting Started</p>
              <h2 className="font-serif text-xl font-semibold">What you can do with Cap Table Manager</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Users,      title: "Manage shareholders",  desc: "Track investors across founders, seed, angel, and priced rounds.", href: "/investors" },
                { icon: TrendingUp, title: "Track funding rounds", desc: "Record price, raise, pre/post-money for each round.",              href: "/funding-rounds" },
                { icon: Briefcase,  title: "Run ESOP",             desc: "Create option pools, issue grants, track vesting + exercise.",    href: "/esop" },
                { icon: PieIcon,    title: "Visualise cap table",  desc: "Ownership breakdown by round, export to CSV or PDF.",             href: "/cap-table" },
                { icon: Calculator, title: "Valuation & Scenario Modeling",   desc: "Simulate future rounds and per-shareholder dilution impact.",     href: "/valuation" },
                { icon: TrendingUp, title: "Projections & DCF",   desc: "5-year financial forecast → DCF → implied pre-money valuation.", href: "/projections" },
                { icon: Shield,     title: "Anti-dilution & waterfall", desc: "Track investor protection clauses and simulate exit distributions.", href: "/anti-dilution" },
                { icon: Camera,     title: "Snapshots",            desc: "Save point-in-time records for compliance and board reporting.",  href: "/snapshots" },
                { icon: FileText,   title: "Audit log",            desc: "Full history of all data changes for traceability.",              href: "/audit-log" },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    onClick={() => setLocation(item.href)}
                    className="text-left border border-border rounded-sm p-4 bg-card hover:border-foreground/30 hover:shadow-sm transition-all space-y-2"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-medium text-sm">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-snug">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </>
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

          {/* Compliance Alerts Row */}
          <ComplianceAlerts />

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
                  <th className="text-right">Price / Share</th>
                  <th className="text-right">Raised</th>
                  <th className="text-right">Post-Money</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(rounds || []).slice(0, 6).map(r => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => setLocation("/funding-rounds")}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-muted-foreground">{formatDate(r.roundDate)}</td>
                    <td className="text-right tabular-nums">{r.pricePerShareNtd ? `NT$ ${parseFloat(r.pricePerShareNtd).toLocaleString()}` : "—"}</td>
                    <td className="text-right tabular-nums">{formatValuation(r.moneyRaisedNtd)}</td>
                    <td className="text-right tabular-nums">{formatValuation(String((r as any).postMoneyCalc ?? r.postMoneyValuationNtd ?? ""))}</td>
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
    </div>
  );
}

function ComplianceAlerts() {
  const [, setLocation] = useLocation();
  const { data: lockups } = trpc.compliance.upcomingLockups.useQuery({ daysAhead: 180 });
  const { data: taxData } = trpc.compliance.taxDeductions.useQuery();
  const { data: documents } = trpc.documents.list.useQuery();
  const { data: expiringGrants = [] } = trpc.esop.expiringGrants.useQuery({ withinDays: 90 });
  const { data: shareholders } = trpc.shareholders.list.useQuery();
  const today = new Date();

  // Tax expiry alerts: transactions where taxDeductionYear is this year or next year
  const taxAlerts = useMemo(() => {
    if (!taxData) return [];
    const currentYear = today.getFullYear();
    return taxData
      .filter(t => t.taxDeductionYear && (t.taxDeductionYear === currentYear || t.taxDeductionYear === currentYear + 1))
      .slice(0, 5);
  }, [taxData, today]);

  // Lockup expirations in the next 180 days
  const upcomingLockups = useMemo(() => {
    if (!lockups) return [];
    return lockups.slice(0, 5);
  }, [lockups]);

  // Pending documents
  const pendingDocs = useMemo(() => {
    if (!documents) return [];
    return documents.filter(d => d.status === "pending").slice(0, 5);
  }, [documents]);

   const hasTaxAlerts = taxAlerts.length > 0;
  const hasLockups = upcomingLockups.length > 0;
  const hasPendingDocs = pendingDocs.length > 0;
  const hasExpiringGrants = expiringGrants.length > 0;
  if (!hasTaxAlerts && !hasLockups && !hasPendingDocs && !hasExpiringGrants) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px bg-foreground/20 flex-1" />
        <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">Compliance Alerts</p>
        <div className="h-px bg-foreground/20 flex-1" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Tax Deduction Alerts */}
        {hasTaxAlerts && (
          <div className="bg-amber-50 border border-amber-200 rounded-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-semibold text-amber-800 tracking-wide uppercase">Tax Benefit Expiry</p>
            </div>
            <div className="space-y-2">
              {taxAlerts.map(t => (
                <div key={`tax-${t.id}`} className="flex items-center justify-between text-xs">
                  <span className="text-amber-900 truncate max-w-[140px]">
                    {t.shareholderId ? `Shareholder #${t.shareholderId}` : "Unknown"}
                  </span>
                  <span className={`font-semibold tabular-nums ${
                    t.taxDeductionYear === today.getFullYear() ? "text-red-600" : "text-amber-700"
                  }`}>
                    {t.taxDeductionYear === today.getFullYear() ? "This Year" : `${t.taxDeductionYear}`}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLocation("/register")}
              className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1 font-medium"
            >
              View Register <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Upcoming Lock-up Expirations */}
        {hasLockups && (
          <div className="bg-blue-50 border border-blue-200 rounded-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-blue-600" />
              <p className="text-xs font-semibold text-blue-800 tracking-wide uppercase">Lock-up Expiring</p>
            </div>
            <div className="space-y-2">
              {upcomingLockups.map(t => {
                const expiry = t.lockUpEndDate ? new Date(t.lockUpEndDate) : null;
                const daysLeft = expiry ? Math.ceil((expiry.getTime() - today.getTime()) / 86400000) : null;
                return (
                  <div key={`lockup-${t.id}`} className="flex items-center justify-between text-xs">
                    <span className="text-blue-900 truncate max-w-[140px]">
                      {t.shareholderId ? `Shareholder #${t.shareholderId}` : "Unknown"}
                    </span>
                    <span className={`font-semibold tabular-nums ${
                      daysLeft !== null && daysLeft <= 30 ? "text-red-600" : "text-blue-700"
                    }`}>
                      {daysLeft !== null ? `${daysLeft}d` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setLocation("/investors")}
              className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1 font-medium"
            >
              View Investors <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* ESOP Expiry Alerts */}
        {hasExpiringGrants && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-xs font-semibold text-red-800 tracking-wide uppercase">Options Expiring</p>
            </div>
            <div className="space-y-2">
              {expiringGrants.slice(0, 5).map(g => {
                const sh = (shareholders || []).find(s => s.id === g.shareholderId);
                return (
                  <div key={g.id} className="flex items-center justify-between text-xs">
                    <span className="text-red-900 truncate max-w-[140px]">{sh?.name ?? `Grantee #${g.shareholderId}`}</span>
                    <span className={`font-semibold tabular-nums ${
                      g.daysUntilExpiry <= 30 ? "text-red-700" : "text-orange-600"
                    }`}>{g.daysUntilExpiry}d left</span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setLocation("/esop")}
              className="text-xs text-red-700 hover:text-red-900 flex items-center gap-1 font-medium"
            >
              View ESOP <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
        {/* Pending Documents */}
        {hasPendingDocs && (
          <div className="bg-rose-50 border border-rose-200 rounded-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-rose-600" />
              <p className="text-xs font-semibold text-rose-800 tracking-wide uppercase">Documents Pending</p>
            </div>
            <div className="space-y-2">
              {pendingDocs.map(d => (
                <div key={d.id} className="flex items-center justify-between text-xs">
                  <span className="text-rose-900 truncate max-w-[140px]">{d.documentName}</span>
                  <span className="font-medium text-rose-600 uppercase tracking-wide">{d.documentType}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLocation("/investors")}
              className="text-xs text-rose-700 hover:text-rose-900 flex items-center gap-1 font-medium"
            >
              View Investors <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
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
