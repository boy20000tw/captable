/**
 * VestingTimeline — visual breakdown of a grant's vesting schedule.
 *
 * Shows:
 *   1. Monthly vesting area chart (cliff → linear → fully vested)
 *   2. Progress bar (vested / exercised / unvested)
 *   3. Key milestones (cliff date, full vest date, expiry)
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from "recharts";
import { CalendarDays, Clock, CheckCircle2, Play } from "lucide-react";

type VestingGrant = {
  sharesGranted: number;
  sharesVested: number;
  sharesExercised: number;
  sharesCancelled: number;
  vestingStartDate: string | null;
  vestingCliffMonths: number | null;
  vestingTotalMonths: number | null;
  grantDate: string | null;
  expiryDate: string | null;
  status: string;
};

export function VestingTimeline({ grant }: { grant: VestingGrant }) {
  const { t } = useTranslation("common");
  const { chartData, milestones, progress } = useMemo(() => computeVestingData(grant), [grant]);

  if (!grant.vestingStartDate || !grant.vestingTotalMonths || grant.vestingTotalMonths <= 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        {t("vesting.noSchedule")}
      </div>
    );
  }

  const netGranted = grant.sharesGranted - grant.sharesCancelled;

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("vesting.progress")}</span>
          <span>{t("vesting.vestedPct", { pct: progress.vestedPct.toFixed(1) })}</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden flex">
          {progress.exercisedPct > 0 && (
            <div
              className="bg-purple-500 transition-all"
              style={{ width: `${progress.exercisedPct}%` }}
              title={`Exercised: ${progress.exercisedPct.toFixed(1)}%`}
            />
          )}
          {progress.vestedNotExercisedPct > 0 && (
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${progress.vestedNotExercisedPct}%` }}
              title={`Vested (not exercised): ${progress.vestedNotExercisedPct.toFixed(1)}%`}
            />
          )}
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> {t("vesting.exercised")} ({grant.sharesExercised.toLocaleString()})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {t("vesting.vested")} ({(grant.sharesVested - grant.sharesExercised).toLocaleString()})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted inline-block" /> {t("vesting.unvested")} ({(netGranted - grant.sharesVested).toLocaleString()})</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              tickCount={6}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              width={45}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--background)",
              }}
              formatter={(value: number) => [value.toLocaleString(), t("vesting.vested")]}
            />
            <Area
              type="stepAfter"
              dataKey="vested"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            {milestones.cliffMonth !== undefined && (
              <ReferenceLine
                x={chartData[milestones.cliffMonth]?.label}
                stroke="#f59e0b"
                strokeDasharray="4 3"
                label={{ value: t("vesting.cliff"), fontSize: 10, fill: "#f59e0b", position: "top" }}
              />
            )}
            {milestones.todayMonth !== undefined && milestones.todayMonth < chartData.length && (
              <ReferenceLine
                x={chartData[milestones.todayMonth]?.label}
                stroke="#3b82f6"
                strokeWidth={2}
                label={{ value: t("vesting.today"), fontSize: 10, fill: "#3b82f6", position: "top" }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Milestones */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MilestoneCard
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          label={t("vesting.vestingStart")}
          value={formatShortDate(grant.vestingStartDate)}
        />
        <MilestoneCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label={t("vesting.cliffEnd")}
          value={milestones.cliffDate ? formatShortDate(milestones.cliffDate) : "—"}
          highlight={milestones.cliffPassed ? "passed" : "pending"}
        />
        <MilestoneCard
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label={t("vesting.fullyVested")}
          value={milestones.fullVestDate ? formatShortDate(milestones.fullVestDate) : "—"}
          highlight={milestones.fullyVested ? "passed" : "pending"}
        />
        <MilestoneCard
          icon={<Play className="h-3.5 w-3.5" />}
          label={t("vesting.expiry")}
          value={grant.expiryDate ? formatShortDate(grant.expiryDate) : t("vesting.noExpiry")}
        />
      </div>
    </div>
  );
}

function MilestoneCard({ icon, label, value, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: "passed" | "pending";
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xs font-medium ${highlight === "passed" ? "text-green-600" : ""}`}>
        {value}
        {highlight === "passed" && " ✓"}
      </p>
    </div>
  );
}

// ─── Computation ────────────────────────────────────────────────────────────

function computeVestingData(grant: VestingGrant) {
  const netGranted = grant.sharesGranted - grant.sharesCancelled;
  const start = grant.vestingStartDate ? new Date(grant.vestingStartDate + "T00:00:00") : null;
  const today = new Date();
  const cliff = grant.vestingCliffMonths ?? 0;
  const total = grant.vestingTotalMonths ?? 0;

  // Chart data: one point per month from start to end
  const chartData: { month: number; label: string; vested: number }[] = [];

  if (start && total > 0) {
    for (let m = 0; m <= total; m++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + m);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const vested = m < cliff ? 0 : Math.min(Math.floor((m / total) * netGranted), netGranted);
      chartData.push({ month: m, label, vested });
    }
  }

  // Milestones
  let cliffDate: string | null = null;
  let fullVestDate: string | null = null;
  let cliffPassed = false;
  let fullyVested = false;
  let todayMonth: number | undefined;

  if (start && total > 0) {
    const cliffD = new Date(start);
    cliffD.setMonth(cliffD.getMonth() + cliff);
    cliffDate = cliffD.toISOString().slice(0, 10);
    cliffPassed = today >= cliffD;

    const fullD = new Date(start);
    fullD.setMonth(fullD.getMonth() + total);
    fullVestDate = fullD.toISOString().slice(0, 10);
    fullyVested = today >= fullD;

    // Today's position on chart
    const monthsSinceStart =
      (today.getFullYear() - start.getFullYear()) * 12 +
      (today.getMonth() - start.getMonth());
    todayMonth = Math.max(0, Math.min(monthsSinceStart, total));
  }

  // Progress
  const vestedPct = netGranted > 0 ? (grant.sharesVested / netGranted) * 100 : 0;
  const exercisedPct = netGranted > 0 ? (grant.sharesExercised / netGranted) * 100 : 0;
  const vestedNotExercisedPct = vestedPct - exercisedPct;

  return {
    chartData,
    milestones: {
      cliffDate,
      cliffPassed,
      fullVestDate,
      fullyVested,
      cliffMonth: cliff > 0 ? cliff : undefined,
      todayMonth,
    },
    progress: {
      vestedPct,
      exercisedPct,
      vestedNotExercisedPct: Math.max(0, vestedNotExercisedPct),
    },
  };
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
