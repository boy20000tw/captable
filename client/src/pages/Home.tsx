import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatShares, formatDate, ROUND_CHART_COLORS } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  TrendingUp, Users, PieChart as PieIcon, Sparkles, ArrowRight,
  Briefcase, Shield, Camera, Calculator, FileText, Rocket, BookOpen,
} from "lucide-react";
import { useLocation } from "wouter";
import { useMemo } from "react";

// ════════════════════════════════════════════════════════════════════════════
// Dashboard — SPEC-mvp-split.md §2 V1 #6:
//   "一頁摘要：當前 cap table 簡圖、進行中 round 狀態、近期 allocations"
//
// Data sources are all V1-native:
//   trpc.v1.capTable.current  — derived cap table (holdings + ESOP)
//   trpc.v1.investors.list    — investor pipeline + invested
//   trpc.v1.allocations.list  — recent + in-flight allocations
//   trpc.v1.esop.poolSummary  — pool totals and allocation counts
//   trpc.fundingRounds.list   — rounds (shared table across versions)
// ════════════════════════════════════════════════════════════════════════════

export default function Home() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}

function DashboardContent() {
  const [, setLocation] = useLocation();
  const { formatAmount } = useCurrency();

  const capTable = trpc.v1.capTable.current.useQuery();
  const investors = trpc.v1.investors.list.useQuery();
  const allocations = trpc.v1.allocations.list.useQuery({});
  const register = trpc.v1.register.list.useQuery({});
  const esopSummary = trpc.v1.esop.poolSummary.useQuery();
  const rounds = trpc.fundingRounds.list.useQuery();

  const isLoading =
    capTable.isLoading || investors.isLoading || allocations.isLoading ||
    register.isLoading || esopSummary.isLoading || rounds.isLoading;

  // ── Derived metrics ─────────────────────────────────────────────────────
  const totalShares = capTable.data?.totalIssuedShares ?? capTable.data?.totalShares ?? 0;
  const holdings = capTable.data?.holdings ?? [];
  const nonEsopInvestors = (investors.data ?? []).filter(i => !i.name?.toUpperCase().includes('ESOP'));
  const investorCount = nonEsopInvestors.length;
  const investedCount = nonEsopInvestors.filter(i => i.status === "invested").length;
  const pipelineCount = (investors.data ?? []).filter(i =>
    i.status === "prospect" || i.status === "meeting" || i.status === "term_sheet"
  ).length;
  const esopUnallocated = esopSummary.data?.totalUnallocated ?? 0;
  const esopTotal = esopSummary.data?.totalPool ?? 0;

  // Active round = most recent non-completed status; fallback to most recent
  const sortedRounds = useMemo(() => {
    const list = (rounds.data ?? []).slice();
    list.sort((a, b) => {
      const da = a.roundDate ? new Date(a.roundDate).getTime() : 0;
      const db = b.roundDate ? new Date(b.roundDate).getTime() : 0;
      return db - da;
    });
    return list;
  }, [rounds.data]);
  const activeRound = sortedRounds.find(r => r.status !== "completed") ?? sortedRounds[0];

  // Allocation funnel by status
  const funnel = useMemo(() => {
    const base = { planned: 0, committed: 0, signed: 0, funded: 0, issued: 0 };
    for (const a of allocations.data ?? []) base[a.status as keyof typeof base]++;
    return base;
  }, [allocations.data]);
  const inFlight = funnel.planned + funnel.committed + funnel.signed + funnel.funded;
  const registerEntryCount = (register.data ?? []).length;

  // Ownership pie (top 8 by shares + a synthetic "Others" if more)
  // Note: keep the values as plain Number (not BigInt) — Recharts breaks on
  // huge numbers if represented oddly.
  const pieData = useMemo(() => {
    const sorted = holdings
      .filter(h => h.totalShares > 0 && !h.investorName?.includes('ESOP'))
      .slice()
      .sort((a, b) => b.totalShares - a.totalShares);
    const top = sorted.slice(0, 8);
    const otherTotal = sorted.slice(8).reduce((s, h) => s + h.totalShares, 0);
    const out = top.map(h => ({
      id: h.investorId,
      name: h.investorName,
      value: Number(h.totalShares),
    }));
    if (otherTotal > 0) {
      out.push({ id: -1, name: `+${sorted.length - 8} others`, value: Number(otherTotal) });
    }
    return out;
  }, [holdings]);

  // Valuation by round (post-money in NT$M)
  // Falls back to: postMoneyValuationNtd → postMoneyCalc → preMoney + moneyRaised → 0
  const roundsChartData = useMemo(() => {
    return (rounds.data ?? [])
      .map(r => {
        const stored = parseFloat(r.postMoneyValuationNtd || "0");
        const calc = (r as any).postMoneyCalc ?? null;
        const preMoney = parseFloat(r.preMoneyValuationNtd || "0");
        const raised = parseFloat(r.moneyRaisedNtd || "0");
        const fallback = preMoney > 0 && raised > 0 ? preMoney + raised : 0;
        const post = calc || stored || fallback;
        return { name: r.name, valuation: post / 1_000_000 };
      })
      .filter(r => r.valuation > 0);
  }, [rounds.data]);

  // Recent allocations (latest 6 by updated/created)
  const recentAllocations = useMemo(() => {
    const list = (allocations.data ?? []).slice();
    list.sort((a, b) => {
      const da = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const db = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return db - da;
    });
    return list.slice(0, 6);
  }, [allocations.data]);

  const investorName = (id: number) =>
    investors.data?.find(i => i.id === id)?.name ?? `Investor #${id}`;
  const roundName = (id: number) =>
    rounds.data?.find(r => r.id === id)?.name ?? `Round #${id}`;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = totalShares > 0 || investorCount > 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="h-px bg-foreground/20 w-16 mb-4" />
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}
          >
            Equity Dashboard
          </h1>
          <p
            className="text-sm text-muted-foreground"
            style={{ letterSpacing: "0.05em" }}
          >
            {hasData
              ? activeRound
                ? `Active round · ${activeRound.name}${activeRound.roundDate ? ` · ${formatDate(activeRound.roundDate)}` : ""}`
                : "Overview"
              : "No data yet — create your first funding round to get started"}
          </p>
        </div>
        {hasData && <CurrencyToggle />}
      </div>

      {!hasData ? (
        <EmptyState setLocation={setLocation} />
      ) : (
        <>
          {/* ─── KPI row ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Shares"
              value={formatShares(totalShares)}
              icon={<PieIcon className="h-4 w-4" />}
              sub={`${holdings.length} investors with holdings`}
              onClick={() => setLocation("/cap-table")}
            />
            <KpiCard
              label="Investors"
              value={String(investorCount)}
              icon={<Users className="h-4 w-4" />}
              sub={`${investedCount} invested · ${pipelineCount} in pipeline`}
              onClick={() => setLocation("/investors")}
            />
            <KpiCard
              label="Allocations in Flight"
              value={String(inFlight)}
              icon={<Rocket className="h-4 w-4" />}
              sub={`${funnel.issued} issued · ${registerEntryCount} register entries`}
              onClick={() => setLocation("/register")}
            />
            <KpiCard
              label="ESOP Pool"
              value={formatShares(esopTotal)}
              icon={<Sparkles className="h-4 w-4" />}
              sub={`${formatShares(esopUnallocated)} unallocated`}
              onClick={() => setLocation("/esop")}
            />
          </div>

          {/* ─── Charts + active round pipeline ──────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Ownership pie */}
            <div className="lg:col-span-2 bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    Ownership
                  </p>
                  <h3 className="text-lg font-semibold tracking-tight">
                    Current Cap Table
                  </h3>
                </div>
                <button
                  onClick={() => setLocation("/cap-table")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  Full view <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {pieData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-xs text-muted-foreground">
                  No shares issued yet
                </div>
              ) : (
                <>
                  <div className="h-52 w-full" style={{ minHeight: 208 }}>
                    <ResponsiveContainer width="100%" height={208}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={84}
                          paddingAngle={2}
                          dataKey="value"
                          isAnimationActive={true}
                          animationBegin={0}
                          animationDuration={800}
                          animationEasing="ease-out"
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={ROUND_CHART_COLORS[i % ROUND_CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [`${formatShares(v)} shares`, ""]}
                          contentStyle={{
                            fontSize: "12px",
                            border: "1px solid var(--border)",
                            borderRadius: "2px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">
                    {pieData.slice(0, 5).map((entry, i) => (
                      <div key={entry.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: ROUND_CHART_COLORS[i % ROUND_CHART_COLORS.length] }}
                          />
                          <span className="text-foreground truncate">{entry.name}</span>
                        </div>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {totalShares > 0 ? ((entry.value / totalShares) * 100).toFixed(1) + "%" : "—"}
                        </span>
                      </div>
                    ))}
                    {pieData.length > 5 && (
                      <p className="text-xs text-muted-foreground">+{pieData.length - 5} more</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Valuation by round */}
            <div className="lg:col-span-3 bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    Valuation History
                  </p>
                  <h3 className="text-lg font-semibold tracking-tight">
                    Post-Money by Round (NT$ M)
                  </h3>
                </div>
                <button
                  onClick={() => setLocation("/funding-rounds")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  Rounds <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {roundsChartData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
                  No valuations recorded yet
                </div>
              ) : (
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
                        contentStyle={{
                          fontSize: "12px",
                          border: "1px solid var(--border)",
                          borderRadius: "2px",
                        }}
                      />
                      <Bar dataKey="valuation" fill="var(--primary)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* ─── Allocation funnel + recent allocations ──────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <AllocationFunnel
                funnel={funnel}
                onClick={() => setLocation("/register")}
              />
            </div>
            <div className="lg:col-span-3 bg-card border border-border rounded-sm">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    Recent activity
                  </p>
                  <h3 className="text-base font-semibold tracking-tight">Allocations</h3>
                </div>
                <button
                  onClick={() => setLocation("/register")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  Register <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {recentAllocations.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No allocations yet. Create one from a funding round to start tracking commitments.
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="cap-table w-full min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Investor</th>
                      <th>Round</th>
                      <th className="text-right">Shares</th>
                      <th className="text-right">Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAllocations.map(a => (
                      <tr
                        key={a.id}
                        className="cursor-pointer"
                        onClick={() => setLocation(`/funding-rounds/${a.fundingRoundId}`)}
                      >
                        <td className="font-medium truncate max-w-[180px]">
                          {investorName(a.investorId)}
                        </td>
                        <td className="text-muted-foreground truncate max-w-[120px]">
                          {roundName(a.fundingRoundId)}
                        </td>
                        <td className="text-right tabular-nums">
                          {a.sharesAllocated ? a.sharesAllocated.toLocaleString() : "—"}
                        </td>
                        <td className="text-right tabular-nums">
                          {a.amount ? `${a.currency || "NTD"} ${parseFloat(a.amount).toLocaleString()}` : "—"}
                        </td>
                        <td>
                          <AllocationStatusPill status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>

          {/* ─── Funding rounds table ────────────────────────────────── */}
          <div className="bg-card border border-border rounded-sm">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                  History
                </p>
                <h3 className="text-base font-semibold tracking-tight">Funding Rounds</h3>
              </div>
              <button
                onClick={() => setLocation("/funding-rounds")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {sortedRounds.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No rounds yet.{" "}
                <button
                  onClick={() => setLocation("/funding-rounds")}
                  className="text-primary hover:underline"
                >
                  Create your first round
                </button>
                .
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="cap-table w-full min-w-[640px]">
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
                  {sortedRounds.slice(0, 6).map(r => (
                    <tr
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setLocation(`/funding-rounds/${r.id}`)}
                    >
                      <td className="font-medium">{r.name}</td>
                      <td className="text-muted-foreground">{formatDate(r.roundDate)}</td>
                      <td className="text-right tabular-nums">
                        {r.pricePerShareNtd
                          ? `NT$ ${parseFloat(r.pricePerShareNtd).toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatAmount(r.moneyRaisedNtd)}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatAmount(
                          String((r as any).postMoneyCalc ?? r.postMoneyValuationNtd ?? "")
                        )}
                      </td>
                      <td>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : r.status === "bridge"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────
function EmptyState({ setLocation }: { setLocation: (url: string) => void }) {
  return (
    <>
      <div className="border border-dashed border-border rounded-sm p-16 text-center space-y-6">
        <div className="space-y-2">
          <p
            className="text-2xl font-bold"
            style={{ fontFamily: "'Poppins', Inter, system-ui, sans-serif" }}
          >
            Begin Your Cap Table
          </p>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Create your first funding round, add investors, then allocate shares.
            The register and cap table update automatically as allocations reach Issued.
          </p>
        </div>
        <div className="flex gap-4 justify-center flex-wrap">
          <button
            onClick={() => setLocation("/funding-rounds")}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
          >
            <Rocket className="h-4 w-4" /> Create a Funding Round
          </button>
          <button
            onClick={() => setLocation("/investors")}
            className="flex items-center gap-2 px-6 py-3 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors"
          >
            <Users className="h-4 w-4" /> Add Investors
          </button>
          <button
            onClick={() => setLocation("/import")}
            className="flex items-center gap-2 px-6 py-3 border border-border text-sm font-medium rounded-sm hover:bg-secondary transition-colors"
          >
            <FileText className="h-4 w-4" /> Import Excel
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-0.5">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
            Getting Started
          </p>
          <h2 className="font-serif text-xl font-semibold">
            What you can do with Caploom
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURE_CARDS.map(item => {
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
  );
}

const FEATURE_CARDS = [
  { icon: Rocket,     title: "Funding Rounds & Allocations", desc: "Plan each raise, track commitments from Planned to Issued.",             href: "/funding-rounds" },
  { icon: Users,      title: "Investors",                    desc: "Pipeline + invested. Prospects through invested, all in one place.",      href: "/investors" },
  { icon: BookOpen,   title: "Share Register",               desc: "Append-only ledger of every issued share. Immutable law-of-record view.",  href: "/register" },
  { icon: PieIcon,    title: "Cap Table",                    desc: "Derived from the register. Never directly edited.",                        href: "/cap-table" },
  { icon: Briefcase,  title: "ESOP",                         desc: "Pool + grants + vesting. Unallocated shares show on the cap table.",      href: "/esop" },
  { icon: Calculator, title: "Valuation & Scenario Modeling", desc: "Per-round estimates today; what-if scenario modeling in V2.",             href: "/valuation" },
  { icon: TrendingUp, title: "Projections & DCF",            desc: "5-year forecast → DCF → implied pre-money valuation.",                    href: "/projections" },
  { icon: Shield,     title: "Anti-Dilution & Waterfall",    desc: "Protection clauses today; exit simulation in V2.",                         href: "/anti-dilution" },
  { icon: Camera,     title: "Snapshots",                    desc: "Auto-saved on every register write. Point-in-time cap tables.",            href: "/snapshots" },
];

// ─── Allocation Funnel ────────────────────────────────────────────────────
function AllocationFunnel({
  funnel,
  onClick,
}: {
  funnel: { planned: number; committed: number; signed: number; funded: number; issued: number };
  onClick: () => void;
}) {
  const steps: Array<[keyof typeof funnel, string, string]> = [
    ["planned",   "Planned",   "bg-slate-200 text-slate-700"],
    ["committed", "Committed", "bg-blue-100 text-blue-700"],
    ["signed",    "Signed",    "bg-indigo-100 text-indigo-700"],
    ["funded",    "Funded",    "bg-amber-100 text-amber-700"],
    ["issued",    "Issued",    "bg-emerald-100 text-emerald-700"],
  ];
  const total = Object.values(funnel).reduce((s, v) => s + v, 0);

  return (
    <div className="bg-card border border-border rounded-sm p-6 space-y-4 h-full">
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
            Pipeline
          </p>
          <h3 className="text-lg font-semibold tracking-tight">Allocation Funnel</h3>
        </div>
        <button
          onClick={onClick}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          All <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      {total === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No allocations yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {steps.map(([key, label, color]) => {
            const count = funnel[key];
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Allocation Status Pill ───────────────────────────────────────────────
function AllocationStatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    planned:   "bg-slate-100 text-slate-700",
    committed: "bg-blue-100 text-blue-700",
    signed:    "bg-indigo-100 text-indigo-700",
    funded:    "bg-amber-100 text-amber-700",
    issued:    "bg-emerald-100 text-emerald-700",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  icon,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-sm p-5 text-left space-y-2 hover:border-foreground/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-[10px] tracking-widest uppercase font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </button>
  );
}
