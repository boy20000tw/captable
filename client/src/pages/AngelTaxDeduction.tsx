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

const REASON_KEYS: Record<string, string> = {
  founder:        "angelTax.reasonFounder",
  entity:         "angelTax.reasonEntity",
  foreign:        "angelTax.reasonForeign",
  holding_period: "angelTax.reasonHoldingPeriod",
  other:          "angelTax.reasonOther",
};

export default function AngelTaxDeductionPage() {
  const { t } = useTranslation("compliance");
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

  const STATUS_LABEL_KEYS: Record<string, string> = {
    pending: "angelTax.statusPending",
    eligible: "angelTax.statusEligible",
    filed: "angelTax.statusFiled",
    expired: "angelTax.statusExpired",
    not_applicable: "angelTax.statusNA",
  };

  const getStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return (
      <Badge className={`gap-1 ${cfg.color}`}>
        <Icon className="h-3 w-3" />
        {t(STATUS_LABEL_KEYS[status] || "angelTax.statusPending")}
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
              {t("angelTax.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("angelTax.subtitle")}
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{t("angelTax.totalRecords")}</p>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.eligible} {t("angelTax.eligible")} / {stats.notApplicable} {t("angelTax.na")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-muted-foreground">{t("angelTax.maxTotalDeduction")}</p>
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
                  <p className="text-xs text-muted-foreground">{t("angelTax.filed")}</p>
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
                  <p className="text-xs text-muted-foreground">{t("angelTax.upcoming180d")}</p>
                </div>
                <p className="text-2xl font-bold mt-1 text-amber-700">{stats.upcomingCount}</p>
                <p className="text-xs text-muted-foreground">
                  {t("angelTax.remindInvestors")}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Rules Info */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {t("angelTax.rulesTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>{t("angelTax.rule1")}</p>
              <p>{t("angelTax.rule2")}</p>
              <p>{t("angelTax.rule3")}</p>
              <p>{t("angelTax.rule4")}</p>
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
                {f === "all" && t("angelTax.filterAll")}
                {f === "eligible" && t("angelTax.filterEligible")}
                {f === "not_applicable" && t("angelTax.filterNotEligible")}
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
                      <TableHead>{t("angelTax.colInvestor")}</TableHead>
                      <TableHead>{t("angelTax.colRound")}</TableHead>
                      <TableHead className="text-right">{t("angelTax.colAmount")}</TableHead>
                      <TableHead className="text-right">{t("angelTax.colShares")}</TableHead>
                      <TableHead>{t("angelTax.colEligible")}</TableHead>
                      <TableHead>{t("angelTax.colLockupEnd")}</TableHead>
                      <TableHead>{t("angelTax.colTaxYear")}</TableHead>
                      <TableHead className="text-right">{t("angelTax.colDeduction")}</TableHead>
                      <TableHead>{t("angelTax.colStatus")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {t("angelTax.loading")}
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {t("angelTax.noRecords")}
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
                                  {t("angelTax.eligibleYes")}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  {t(REASON_KEYS[row.ineligibleReason] || "angelTax.reasonDefault")}
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
                                          {t("angelTax.daysLeft", { days })}
                                        </span>
                                      ) : (
                                        <span>{t("angelTax.daysRemaining", { days })}</span>
                                      )}
                                    </p>
                                  )}
                                  {days !== null && days <= 0 && row.isEligible && row.status === "pending" && (
                                    <p className="text-xs text-green-600 font-medium">
                                      {t("angelTax.eligibleNow")}
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
