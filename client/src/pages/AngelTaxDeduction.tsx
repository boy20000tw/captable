/**
 * Angel Investor Tax Deduction Tracker
 * 天使投資人租稅優惠 — 產創條例 §23-2
 *
 * Tracks investment eligibility, lock-up periods, and tax filing deadlines
 * so founders can remind investors when they become eligible for deductions.
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { trpc } from "@/lib/trpc";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  Receipt, Plus, AlertTriangle, CheckCircle2, Clock, XCircle, Ban,
  CalendarClock, TrendingUp, Users, Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type StatusConfig = { icon: typeof CheckCircle2; color: string };

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending:        { icon: Clock,          color: "bg-amber-100 text-amber-700 border-transparent" },
  eligible:       { icon: CalendarClock,  color: "bg-blue-100 text-blue-700 border-transparent" },
  filed:          { icon: CheckCircle2,   color: "bg-green-100 text-green-700 border-transparent" },
  expired:        { icon: XCircle,        color: "bg-gray-100 text-gray-600 border-transparent" },
  not_applicable: { icon: Ban,            color: "bg-red-100 text-red-600 border-transparent" },
};

const REASON_LABELS: Record<string, { en: string; zh: string }> = {
  founder:        { en: "Founder",           zh: "創辦人" },
  entity:         { en: "Corporate entity",  zh: "法人" },
  foreign:        { en: "Foreign national",  zh: "外國人" },
  holding_period: { en: "Holding period",    zh: "持有期間不足" },
  other:          { en: "Other",             zh: "其他" },
};

export default function AngelTaxDeductionPage() {
  const { t, i18n } = useTranslation("compliance");
  const isZh = i18n.language.startsWith("zh");
  const [filter, setFilter] = useState<"all" | "eligible" | "not_applicable">("all");

  const { data: records = [], isLoading } = trpc.angelTax.list.useQuery();
  const { data: upcoming = [] } = trpc.angelTax.upcoming.useQuery({ withinDays: 180 });

  // Summary stats
  const stats = useMemo(() => {
    const eligible = records.filter((r: any) => r.isEligible);
    const notApplicable = records.filter((r: any) => !r.isEligible);
    const totalDeduction = eligible.reduce((sum: number, r: any) =>
      sum + (parseFloat(r.maxDeductionNtd || "0")), 0);
    const filed = eligible.filter((r: any) => r.status === "filed");
    const filedAmount = filed.reduce((sum: number, r: any) =>
      sum + (parseFloat(r.maxDeductionNtd || "0")), 0);

    return {
      total: records.length,
      eligible: eligible.length,
      notApplicable: notApplicable.length,
      totalDeduction,
      filedCount: filed.length,
      filedAmount,
      pendingCount: eligible.filter((r: any) => r.status === "pending").length,
      upcomingCount: upcoming.length,
    };
  }, [records, upcoming]);

  const filtered = useMemo(() => {
    if (filter === "eligible") return records.filter((r: any) => r.isEligible);
    if (filter === "not_applicable") return records.filter((r: any) => !r.isEligible);
    return records;
  }, [records, filter]);

  const getStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    const label = isZh
      ? { pending: "等待中", eligible: "可退稅", filed: "已申報", expired: "已過期", not_applicable: "不適用" }[status]
      : { pending: "Pending", eligible: "Eligible", filed: "Filed", expired: "Expired", not_applicable: "N/A" }[status];
    return (
      <Badge className={`gap-1 ${cfg.color}`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const daysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <DashboardLayout>
      <FeatureGate feature="compliance.techShareTax">
        <div className="p-8 max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isZh ? "天使投資人租稅優惠" : "Angel Investor Tax Deduction"}
            </h1>
            <p className="text-muted-foreground">
              {isZh
                ? "產創條例 §23-2 — 追蹤投資人閉鎖期、退稅資格與申報狀態"
                : "Innovation Act §23-2 — Track lock-up periods, eligibility & filing status"}
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{isZh ? "總投資筆數" : "Total Records"}</p>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.eligible} {isZh ? "適用" : "eligible"} / {stats.notApplicable} {isZh ? "不適用" : "N/A"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-muted-foreground">{isZh ? "最高可退稅總額" : "Max Total Deduction"}</p>
                </div>
                <p className="text-2xl font-bold mt-1 text-green-700">
                  {formatCurrency(stats.totalDeduction, "NTD", 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <p className="text-xs text-muted-foreground">{isZh ? "已申報" : "Filed"}</p>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {stats.filedCount} / {stats.eligible}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats.filedAmount, "NTD", 0)}
                </p>
              </CardContent>
            </Card>

            <Card className={stats.upcomingCount > 0 ? "border-amber-300 bg-amber-50/30" : ""}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-600" />
                  <p className="text-xs text-muted-foreground">{isZh ? "即將到期 (180天內)" : "Upcoming (180d)"}</p>
                </div>
                <p className="text-2xl font-bold mt-1 text-amber-700">{stats.upcomingCount}</p>
                <p className="text-xs text-muted-foreground">
                  {isZh ? "提醒投資人準備退稅" : "Remind investors to file"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Rules Info */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {isZh ? "產創條例 §23-2 退稅規則" : "Innovation Act §23-2 Rules"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>{isZh
                ? "1. 個人投資人（非法人）投入高風險新創事業，持有股份滿閉鎖期後，可申請所得稅扣抵。"
                : "1. Individual investors (not entities) in high-risk startups can claim tax deduction after the lock-up period."}</p>
              <p>{isZh
                ? "2. 2025 年前投資：閉鎖期 2 年。2025 年後投資：閉鎖期 3 年。"
                : "2. Pre-2025 investments: 2-year lock-up. Post-2025: 3-year lock-up."}</p>
              <p>{isZh
                ? "3. 閉鎖期滿次年的報稅季可申報，最高扣抵投資金額的 50%。"
                : "3. File in the tax year after lock-up ends. Max deduction: 50% of investment amount."}</p>
              <p>{isZh
                ? "4. 法人（公司）、外國籍投資人不適用。"
                : "4. Corporate entities and foreign nationals are not eligible."}</p>
            </CardContent>
          </Card>

          {/* Filter */}
          <div className="flex gap-2">
            {(["all", "eligible", "not_applicable"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f === "all" && (isZh ? "全部" : "All")}
                {f === "eligible" && (isZh ? "適用" : "Eligible")}
                {f === "not_applicable" && (isZh ? "不適用" : "Not Eligible")}
                <span className="ml-1 text-xs opacity-70">
                  ({f === "all" ? stats.total : f === "eligible" ? stats.eligible : stats.notApplicable})
                </span>
              </Button>
            ))}
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isZh ? "投資人" : "Investor"}</TableHead>
                      <TableHead>{isZh ? "輪次" : "Round"}</TableHead>
                      <TableHead className="text-right">{isZh ? "投資額" : "Amount"}</TableHead>
                      <TableHead className="text-right">{isZh ? "股數" : "Shares"}</TableHead>
                      <TableHead>{isZh ? "適用" : "Eligible"}</TableHead>
                      <TableHead>{isZh ? "閉鎖到期" : "Lock-up End"}</TableHead>
                      <TableHead>{isZh ? "退稅年度" : "Tax Year"}</TableHead>
                      <TableHead className="text-right">{isZh ? "退稅額 (50%)" : "Deduction"}</TableHead>
                      <TableHead>{isZh ? "狀態" : "Status"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {isZh ? "載入中..." : "Loading..."}
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {isZh ? "尚無記錄" : "No records yet"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((row: any) => {
                        const days = daysUntil(row.lockupEndDate);
                        const isUpcoming = days !== null && days > 0 && days <= 180 && row.isEligible;
                        return (
                          <TableRow key={row.id} className={isUpcoming ? "bg-amber-50/50" : ""}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1.5">
                                {row.investorName}
                                {!row.isEligible && row.ineligibleReason === "entity" && (
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{row.roundName}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(parseFloat(row.investmentAmountNtd || "0"), "NTD", 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {row.sharesAcquired?.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {row.isEligible ? (
                                <Badge className="bg-green-100 text-green-700 border-transparent text-xs">
                                  {isZh ? "適用" : "Yes"}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  {isZh
                                    ? REASON_LABELS[row.ineligibleReason]?.zh || "不適用"
                                    : REASON_LABELS[row.ineligibleReason]?.en || "N/A"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.lockupEndDate ? (
                                <div>
                                  <span className="text-sm">{formatDate(row.lockupEndDate)}</span>
                                  {days !== null && days > 0 && row.isEligible && row.status === "pending" && (
                                    <p className="text-xs text-muted-foreground">
                                      {days <= 180 ? (
                                        <span className="text-amber-600 font-medium">
                                          {isZh ? `${days} 天後到期` : `${days}d left`}
                                        </span>
                                      ) : (
                                        <span>{isZh ? `剩 ${days} 天` : `${days}d`}</span>
                                      )}
                                    </p>
                                  )}
                                  {days !== null && days <= 0 && row.isEligible && row.status === "pending" && (
                                    <p className="text-xs text-green-600 font-medium">
                                      {isZh ? "已到期，可退稅" : "Eligible now"}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.taxFilingYear || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {row.isEligible && row.maxDeductionNtd ? (
                                <span className="text-green-700">
                                  {formatCurrency(parseFloat(row.maxDeductionNtd), "NTD", 0)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(row.status)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
