import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { formatShares, formatDate, ROUND_CHART_COLORS } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Users, PieChart as PieIcon, Sparkles, ArrowRight,
  Briefcase, Shield, Camera, Calculator, Rocket, BookOpen,
  Building2, ChevronRight, Lightbulb, Upload, Target,
  AlertTriangle, Clock, Bell,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import OnboardingWizard from "@/components/OnboardingWizard";

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
  const { t } = useTranslation("pages");
  const [, setLocation] = useLocation();
  const { formatAmount, formatPrice } = useCurrency();
  const { hasCompany, loading: authLoading } = useAuth();
  const [skippedOnboarding, setSkippedOnboarding] = useState(() => {
    try { return localStorage.getItem("onboarding_skipped") === "1"; } catch { return false; }
  });
  // Once wizard is shown, keep it visible to prevent flicker during refresh()
  const [wizardShown, setWizardShown] = useState(false);

  const handleSkip = () => {
    setSkippedOnboarding(true);
    try { localStorage.setItem("onboarding_skipped", "1"); } catch { /* ignore */ }
  };

  // Show onboarding wizard for brand-new users (no company yet)
  const shouldShowWizard = !skippedOnboarding && !authLoading && !hasCompany;
  // Latch: once wizard appears, don't hide it mid-creation
  useEffect(() => {
    if (shouldShowWizard && !wizardShown) setWizardShown(true);
  }, [shouldShowWizard, wizardShown]);
  const needsOnboarding = wizardShown && !skippedOnboarding;

  const capTable = trpc.v1.capTable.current.useQuery();
  const investors = trpc.v1.investors.list.useQuery();
  const allocations = trpc.v1.allocations.list.useQuery({});
  const register = trpc.v1.register.list.useQuery({});
  const esopSummary = trpc.v1.esop.poolSummary.useQuery();
  const rounds = trpc.fundingRounds.list.useQuery();
  const deadlines = trpc.deadlines.list.useQuery({ withinDays: 180 });

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

  // Fundraising summary metrics
  const closedRounds = sortedRounds.filter(r => r.status === "completed");
  const totalRaised = closedRounds.reduce((s, r) => s + parseFloat(r.moneyRaisedNtd || "0"), 0);
  const latestClosedRound = closedRounds[0];
  const latestValuation = latestClosedRound
    ? parseFloat((latestClosedRound as any).postMoneyCalc ?? latestClosedRound.postMoneyValuationNtd ?? "0")
      || (parseFloat(latestClosedRound.preMoneyValuationNtd || "0") + parseFloat(latestClosedRound.moneyRaisedNtd || "0"))
    : 0;
  const uniqueInvestorsAcrossRounds = new Set(
    (allocations.data ?? []).map(a => a.investorId)
  ).size;

  // Current fundraising goal: the active non-completed round
  const goalRound = sortedRounds.find(r => r.status !== "completed");
  const goalAllocations = useMemo(() => {
    if (!goalRound) return [];
    return (allocations.data ?? []).filter(a => a.fundingRoundId === goalRound.id);
  }, [allocations.data, goalRound]);
  const goalRaised = goalAllocations.reduce((s, a) => s + parseFloat(a.amount || "0"), 0);
  const goalTarget = goalRound ? parseFloat(goalRound.moneyRaisedNtd || "0") : 0;
  const goalSharesAllocated = goalAllocations.reduce((s, a) => s + (a.sharesAllocated ?? 0), 0);
  const goalPct = goalTarget > 0 ? Math.round((goalRaised / goalTarget) * 100) : 0;
  const goalFunnel = useMemo(() => {
    const base = { planned: 0, committed: 0, signed: 0, funded: 0, issued: 0 };
    for (const a of goalAllocations) base[a.status as keyof typeof base]++;
    return base;
  }, [goalAllocations]);

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

  // Show onboarding wizard overlay for first-time users
  if (needsOnboarding) {
    return (
      <>
        <div className="p-8 max-w-7xl mx-auto">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        </div>
        <OnboardingWizard onSkip={handleSkip} />
      </>
    );
  }

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
            {t("home.title")}
          </h1>
          <p
            className="text-sm text-muted-foreground"
            style={{ letterSpacing: "0.05em" }}
          >
            {hasData
              ? activeRound
                ? t("home.activeRoundLabelDate", {name: activeRound.name, date: activeRound.roundDate ? formatDate(activeRound.roundDate) : ""})
                : t("home.overview")
              : t("home.noDataYet")}
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
              label={t("home.totalShares")}
              value={formatShares(totalShares)}
              icon={<PieIcon className="h-4 w-4" />}
              sub={t("home.investorsWithHoldings", {count: holdings.length})}
              onClick={() => setLocation("/cap-table")}
            />
            <KpiCard
              label={t("home.investors")}
              value={String(investorCount)}
              icon={<Users className="h-4 w-4" />}
              sub={t("home.investedPipeline", {invested: investedCount, pipeline: pipelineCount})}
              onClick={() => setLocation("/investors")}
            />
            <KpiCard
              label={t("home.allocationsInFlight")}
              value={String(inFlight)}
              icon={<Rocket className="h-4 w-4" />}
              sub={t("home.issuedRegister", {issued: funnel.issued, register: registerEntryCount})}
              onClick={() => setLocation("/register")}
            />
            <KpiCard
              label={t("home.esopPool")}
              value={formatShares(esopTotal)}
              icon={<Sparkles className="h-4 w-4" />}
              sub={t("home.unallocated", {count: formatShares(esopUnallocated)})}
              onClick={() => setLocation("/esop")}
            />
          </div>

          {/* ─── Zone 2: Ownership Pie + Fundraising Summary ──────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Ownership pie */}
            <div className="lg:col-span-2 bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    {t("home.ownership")}
                  </p>
                  <h3 className="text-lg font-semibold tracking-tight">
                    {t("home.currentCapTable")}
                  </h3>
                </div>
                <button
                  onClick={() => setLocation("/cap-table")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  {t("home.fullView")} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {pieData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
                  {t("home.noSharesIssued")}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-0 pt-2">
                  {/* Pie chart — left half, vertically centered */}
                  <div className="flex items-center justify-center">
                    <div style={{ width: 180, height: 180 }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={46}
                            outerRadius={82}
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
                  </div>
                  {/* Legend — right half, vertically centered */}
                  <div className="flex items-center">
                    <div className="w-full space-y-3">
                      {pieData.slice(0, 5).map((entry, i) => (
                        <div key={entry.id} className="flex items-center gap-2.5 text-sm">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: ROUND_CHART_COLORS[i % ROUND_CHART_COLORS.length] }}
                          />
                          <span className="text-foreground truncate min-w-0">{entry.name}</span>
                          <span className="text-muted-foreground tabular-nums shrink-0 ml-auto font-medium">
                            {totalShares > 0 ? ((entry.value / totalShares) * 100).toFixed(1) + "%" : "—"}
                          </span>
                        </div>
                      ))}
                      {pieData.length > 5 && (
                        <p className="text-sm text-muted-foreground">{t("home.more", {count: pieData.length - 5})}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fundraising Summary — 4 metric cards */}
            <div className="lg:col-span-3 bg-card border border-border rounded-sm p-6 flex flex-col">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    {t("home.fundraisingSummary")}
                  </p>
                  <h3 className="text-lg font-semibold tracking-tight">
                    {t("home.fundraisingOverview")}
                  </h3>
                </div>
                <button
                  onClick={() => setLocation("/funding-rounds")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  {t("home.rounds")} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 flex-1">
                <div className="bg-muted/40 rounded-sm p-5 flex flex-col justify-center space-y-1">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    {t("home.totalRaised")}
                  </p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight">
                    {formatAmount(totalRaised)}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-sm p-5 flex flex-col justify-center space-y-1">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    {t("home.latestValuation")}
                  </p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight">
                    {latestValuation > 0 ? formatAmount(latestValuation) : "—"}
                  </p>
                  {latestClosedRound && (
                    <p className="text-[11px] text-muted-foreground">{latestClosedRound.name}</p>
                  )}
                </div>
                <div className="bg-muted/40 rounded-sm p-5 flex flex-col justify-center space-y-1">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    {t("home.roundsClosed")}
                  </p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight">
                    {closedRounds.length}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("home.roundsClosedOf", { total: sortedRounds.length })}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-sm p-5 flex flex-col justify-center space-y-1">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    {t("home.totalInvestors")}
                  </p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight">
                    {uniqueInvestorsAcrossRounds}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("home.acrossAllRounds")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Zone 3: Current Fundraising Goal ──────────────────── */}
          {goalRound && (
            <div className="bg-card border border-border rounded-sm p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Target className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                      {t("home.fundraisingGoal")}
                    </p>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {goalRound.name}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setLocation(`/funding-rounds/${goalRound.id}`)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  {t("home.viewRound")} <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-2xl font-bold tabular-nums tracking-tight">
                      {formatAmount(goalRaised)}
                    </span>
                    {goalTarget > 0 && (
                      <span className="text-sm text-muted-foreground ml-2">
                        / {formatAmount(goalTarget)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-primary">
                    {goalPct}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(goalPct, 100)}%` }}
                  />
                </div>
                {goalTarget > 0 && goalTarget - goalRaised > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("home.remaining", { amount: formatAmount(goalTarget - goalRaised) })}
                  </p>
                )}
              </div>

              {/* Milestone dots — allocation status counts */}
              <div className="flex flex-wrap gap-2">
                {(["issued", "signed", "committed", "planned"] as const).map(s => {
                  const count = goalFunnel[s] ?? 0;
                  if (count === 0) return null;
                  const dotColors: Record<string, string> = {
                    issued: "bg-emerald-100 text-emerald-700",
                    signed: "bg-indigo-100 text-indigo-700",
                    committed: "bg-blue-100 text-blue-700",
                    planned: "bg-slate-100 text-slate-700",
                  };
                  return (
                    <span
                      key={s}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${dotColors[s]}`}
                    >
                      {t(`home.${s}`)} {count}
                    </span>
                  );
                })}
              </div>

              {/* Bottom stats row */}
              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
                <div className="space-y-0.5">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    {t("home.totalInvestors")}
                  </p>
                  <p className="text-base font-semibold tabular-nums">
                    {goalAllocations.length}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    {t("home.sharesAllocated")}
                  </p>
                  <p className="text-base font-semibold tabular-nums">
                    {formatShares(goalSharesAllocated)}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                    {t("home.colPricePerShare")}
                  </p>
                  <p className="text-base font-semibold tabular-nums">
                    {goalRound.pricePerShareNtd ? formatPrice(goalRound.pricePerShareNtd) : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── Zone 3.5: Upcoming Deadlines ─────────────────────── */}
          {(deadlines.data ?? []).length > 0 && (
            <UpcomingDeadlinesCard
              items={deadlines.data ?? []}
              onNavigate={setLocation}
            />
          )}

          {/* ─── Zone 4: All Rounds table (simplified) ────────────── */}
          <div className="bg-card border border-border rounded-sm">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
                  {t("home.history")}
                </p>
                <h3 className="text-base font-semibold tracking-tight">{t("home.allRounds")}</h3>
              </div>
              <button
                onClick={() => setLocation("/funding-rounds")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                {t("home.viewAll")} <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {sortedRounds.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {t("home.noRounds")}{" "}
                <button
                  onClick={() => setLocation("/funding-rounds")}
                  className="text-primary hover:underline"
                >
                  {t("home.createFirstRound")}
                </button>
                .
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="cap-table w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th>{t("home.colRound")}</th>
                    <th>{t("home.colDate")}</th>
                    <th>{t("home.colStatus")}</th>
                    <th className="text-right">{t("home.colRaised")}</th>
                    <th className="text-right">{t("home.colPostMoney")}</th>
                    <th className="text-right">{t("home.colInvestors")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRounds.map(r => {
                    const roundInvestors = new Set(
                      (allocations.data ?? [])
                        .filter(a => a.fundingRoundId === r.id)
                        .map(a => a.investorId)
                    ).size;
                    return (
                      <tr
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => setLocation(`/funding-rounds/${r.id}`)}
                      >
                        <td className="font-medium">{r.name}</td>
                        <td className="text-muted-foreground">{formatDate(r.roundDate)}</td>
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
                        <td className="text-right tabular-nums">
                          {formatAmount(r.moneyRaisedNtd)}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatAmount(
                            String((r as any).postMoneyCalc ?? r.postMoneyValuationNtd ?? "")
                          )}
                        </td>
                        <td className="text-right tabular-nums">{roundInvestors}</td>
                      </tr>
                    );
                  })}
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
  const { t } = useTranslation("pages");

  const steps = useMemo(() => [
    { n: 1, icon: Building2,  action: t("home.step1.action"), href: "/settings/company", title: t("home.step1.title"), desc: t("home.step1.desc") },
    { n: 2, icon: Users,      action: t("home.step2.action"), href: "/investors",         title: t("home.step2.title"), desc: t("home.step2.desc") },
    { n: 3, icon: Rocket,     action: t("home.step3.action"), href: "/funding-rounds",    title: t("home.step3.title"), desc: t("home.step3.desc") },
    { n: 4, icon: Briefcase,  action: t("home.step4.action"), href: "/esop",              title: t("home.step4.title"), desc: t("home.step4.desc") },
    { n: 5, icon: PieIcon,    action: t("home.step5.action"), href: "/cap-table",         title: t("home.step5.title"), desc: t("home.step5.desc") },
  ], [t]);

  const featureCards = useMemo(() => [
    { icon: Rocket,     title: t("home.feature.fundingRounds"), desc: t("home.feature.fundingRoundsDesc"), href: "/funding-rounds" },
    { icon: Users,      title: t("home.feature.investors"),     desc: t("home.feature.investorsDesc"),     href: "/investors" },
    { icon: BookOpen,   title: t("home.feature.register"),      desc: t("home.feature.registerDesc"),      href: "/register" },
    { icon: PieIcon,    title: t("home.feature.capTable"),      desc: t("home.feature.capTableDesc"),      href: "/cap-table" },
    { icon: Briefcase,  title: t("home.feature.esop"),          desc: t("home.feature.esopDesc"),          href: "/esop" },
    { icon: Calculator, title: t("home.feature.valuation"),     desc: t("home.feature.valuationDesc"),     href: "/valuation" },
    { icon: TrendingUp, title: t("home.feature.projections"),   desc: t("home.feature.projectionsDesc"),   href: "/projections" },
    { icon: Shield,     title: t("home.feature.antiDilution"),  desc: t("home.feature.antiDilutionDesc"),  href: "/anti-dilution" },
    { icon: Camera,     title: t("home.feature.snapshots"),     desc: t("home.feature.snapshotsDesc"),     href: "/snapshots" },
  ], [t]);

  return (
    <>
      {/* ── Quick Start Guide ── */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{t("home.quickStart")}</h2>
          <p className="text-sm text-muted-foreground">{t("home.quickStartDesc")}</p>
        </div>

        <div className="divide-y divide-border">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === steps.length - 1;
            return (
              <button
                key={step.n}
                onClick={() => setLocation(step.href)}
                className="w-full flex items-start gap-4 px-6 py-4 text-left hover:bg-muted/40 transition-colors group"
              >
                {/* Step number + vertical connector */}
                <div className="flex flex-col items-center shrink-0 pt-0.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                    {step.n}
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />}
                </div>

                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{step.title}</span>
                    {step.n === 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">optional</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>

                {/* CTA */}
                <div className="shrink-0 flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                  {step.action} <ChevronRight className="h-3 w-3" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Tip bar */}
        <div className="px-6 py-3 bg-muted/30 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>{t("home.quickStartTip")}</span>
          <button
            onClick={() => setLocation("/import")}
            className="ml-1 text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            <Upload className="h-3 w-3" /> {t("home.importData")}
          </button>
        </div>
      </div>

      {/* ── Explore Features ── */}
      <div className="space-y-4">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold tracking-tight">{t("home.exploreFeatures")}</h2>
          <p className="text-sm text-muted-foreground">{t("home.exploreFeaturesDesc")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {featureCards.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                onClick={() => setLocation(item.href)}
                className="text-left border border-border rounded-sm p-4 bg-card hover:border-foreground/30 hover:shadow-sm transition-all flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h3 className="font-medium text-sm">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-snug">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
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

// ─── Upcoming Deadlines Card ────────────────────────────────────────────
type DeadlineRow = {
  id: string;
  type: string;
  titleEn: string;
  titleZh: string;
  descEn: string;
  descZh: string;
  dueDate: string;
  daysLeft: number;
  severity: "urgent" | "warning" | "info";
  path: string;
};

const TYPE_ICONS: Record<string, string> = {
  "409a": "409A", "83b": "83(b)", techShare: "RSA", angelTax: "Angel",
  esopExpiry: "ESOP", lockup: "Lock", maturity: "Note", rofr: "ROFR", esign: "Sign",
};

function UpcomingDeadlinesCard({
  items,
  onNavigate,
}: {
  items: DeadlineRow[];
  onNavigate: (path: string) => void;
}) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");

  const urgentCount = items.filter(i => i.severity === "urgent").length;
  const warningCount = items.filter(i => i.severity === "warning").length;

  const severityStyle: Record<string, string> = {
    urgent: "border-l-red-500 bg-red-50/40",
    warning: "border-l-amber-400 bg-amber-50/30",
    info: "border-l-blue-300 bg-blue-50/20",
  };
  const severityIcon: Record<string, React.ReactNode> = {
    urgent: <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />,
    warning: <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
    info: <Bell className="h-3.5 w-3.5 text-blue-400 shrink-0" />,
  };

  return (
    <div className={`bg-card border rounded-sm ${urgentCount > 0 ? "border-red-300" : "border-border"}`}>
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${urgentCount > 0 ? "bg-red-100" : "bg-amber-100"}`}>
            <AlertTriangle className={`h-4 w-4 ${urgentCount > 0 ? "text-red-600" : "text-amber-600"}`} />
          </div>
          <div>
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium">
              {isZh ? "即將到期" : "UPCOMING DEADLINES"}
            </p>
            <h3 className="text-base font-semibold tracking-tight">
              {isZh
                ? `${items.length} 個項目需要注意`
                : `${items.length} item${items.length > 1 ? "s" : ""} need attention`}
            </h3>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          {urgentCount > 0 && (
            <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">
              {urgentCount} {isZh ? "緊急" : "urgent"}
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
              {warningCount} {isZh ? "注意" : "warning"}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {items.slice(0, 8).map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.path)}
            className={`w-full flex items-center gap-4 px-6 py-3 text-left hover:bg-muted/40 transition-colors border-l-4 ${severityStyle[item.severity]}`}
          >
            {severityIcon[item.severity]}
            <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground w-12 shrink-0">
              {TYPE_ICONS[item.type] || item.type}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {isZh ? item.titleZh : item.titleEn}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {isZh ? item.descZh : item.descEn}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-semibold tabular-nums ${
                item.severity === "urgent" ? "text-red-600"
                  : item.severity === "warning" ? "text-amber-600"
                  : "text-muted-foreground"
              }`}>
                {item.daysLeft <= 0
                  ? (isZh ? "已到期" : "Overdue")
                  : `${item.daysLeft}${isZh ? " 天" : "d"}`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(item.dueDate).toLocaleDateString(isZh ? "zh-TW" : "en-US", {
                  month: "short", day: "numeric",
                })}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>

      {items.length > 8 && (
        <div className="px-6 py-3 border-t border-border text-center">
          <span className="text-xs text-muted-foreground">
            {isZh ? `還有 ${items.length - 8} 個項目` : `+${items.length - 8} more items`}
          </span>
        </div>
      )}
    </div>
  );
}
