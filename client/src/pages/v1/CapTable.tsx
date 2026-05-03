import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { PieChart, ArrowRight, Download, FileSpreadsheet, FileText } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorState from "@/components/ErrorState";
import { trpc } from "@/lib/trpc";
import { getActiveCompanyId } from "@/lib/activeCompany";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function V1CapTablePage() {
  return (
    <DashboardLayout>
      <V1CapTableContent />
    </DashboardLayout>
  );
}

type InvestorStatus = "prospect" | "meeting" | "term_sheet" | "invested" | "passed" | "unknown";

function pipelineBadge(status: string) {
  const map: Record<string, string> = {
    prospect: "bg-gray-100 text-gray-700 border-transparent",
    meeting: "bg-blue-100 text-blue-700 border-transparent",
    term_sheet: "bg-yellow-100 text-yellow-700 border-transparent",
    invested: "bg-green-100 text-green-700 border-transparent",
    passed: "bg-red-100 text-red-700 border-transparent",
    unknown: "bg-slate-100 text-slate-500 border-transparent",
  };
  const cls = map[status] ?? map.unknown;
  return <Badge className={cls}>{status}</Badge>;
}

function fmtNum(n: number) {
  return n.toLocaleString();
}

function V1CapTableContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("equity");
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, refetch } = trpc.v1.capTable.current.useQuery();
  const [includeEsop, setIncludeEsop] = useState(false);

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const isEmpty =
    !isLoading && (!data || (data.holdings?.length ?? 0) === 0);

  // Denominator for ownership calculation
  const displayTotal = data
    ? includeEsop
      ? data.totalShares
      : data.totalIssuedShares
    : 0;

  const esopUnallocatedPct =
    data && displayTotal > 0
      ? ((data.esopPoolUnallocated / displayTotal) * 100).toFixed(4)
      : "0";

  // Recalculate ownership % based on toggle
  const calcOwnership = (shares: number) =>
    displayTotal > 0 ? ((shares / displayTotal) * 100).toFixed(4) : "0";

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <PieChart className="h-7 w-7 text-primary" />
            {tPages("capTable.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tPages("capTable.desc")}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="esop-toggle" className="text-sm text-muted-foreground whitespace-nowrap">
              {t("capTable.includeEsop")}
            </label>
            <Switch id="esop-toggle" checked={includeEsop} onCheckedChange={setIncludeEsop} />
          </div>
          {data && data.holdings.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline" size="sm"
                onClick={() => window.open(`/api/export/cap-table.pdf?companyId=${getActiveCompanyId()}`, "_blank")}
                className="gap-1.5 text-xs"
              >
                <FileText className="h-3.5 w-3.5" /> {t("capTable.pdf")}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => window.open(`/api/export/cap-table.xlsx?companyId=${getActiveCompanyId()}`, "_blank")}
                className="gap-1.5 text-xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> {t("capTable.excel")}
              </Button>
            </div>
          )}
          {data?.generatedAt && (
            <p className="text-xs text-muted-foreground">
              {t("capTable.asOf")} {new Date(data.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* KPI metrics */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Metric
              label={includeEsop ? t("capTable.issuedShares") : t("capTable.issuedShares")}
              value={data ? fmtNum(displayTotal) : "—"}
            />
            <Metric
              label={t("capTable.issuedShares")}
              value={data ? fmtNum(data.totalIssuedShares) : "—"}
            />
            <Metric
              label={t("capTable.esopAllocated")}
              value={data ? fmtNum(data.esopPoolAllocated) : "—"}
            />
            <Metric
              label={t("capTable.esopUnallocated")}
              value={data ? fmtNum(data.esopPoolUnallocated) : "—"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("capTable.holdingsTitle")}</CardTitle>
          <CardDescription>
            {t("capTable.holdingsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Loading cap table...
            </div>
          ) : isEmpty ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-muted-foreground text-sm">
                {t("capTable.emptyState")}
              </p>
              <Button onClick={() => setLocation("/funding-rounds")}>
                {t("capTable.goToRounds")} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {t("capTable.emptyHint")}
              </p>
            </div>
          ) : (
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("register.investor")}</TableHead>
                  <TableHead>{t("capTable.entity")}</TableHead>
                  <TableHead>{t("register.status")}</TableHead>
                  <TableHead className="text-right">{t("capTable.shares")}</TableHead>
                  <TableHead className="text-right">{t("capTable.pctCapTable")}</TableHead>
                  <TableHead>{t("register.shareClass")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.holdings.map((h) => (
                  <TableRow key={h.investorId} className="hover:bg-secondary/30">
                    <TableCell className="font-medium">
                      {h.investorName}
                    </TableCell>
                    <TableCell className="capitalize ">
                      {h.entityKind}
                    </TableCell>
                    <TableCell>
                      {pipelineBadge(
                        (h.investorStatus as InvestorStatus) ?? "unknown"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {fmtNum(h.totalShares)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {calcOwnership(h.totalShares)}%
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {Object.entries(h.byShareClass)
                        .filter(([, v]) => v > 0)
                        .map(
                          ([cls, v]) =>
                            `${cls.replace(/_/g, " ")}: ${fmtNum(v)}`
                        )
                        .join(" / ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                {includeEsop && data!.esopPoolUnallocated > 0 && (
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">
                      {t("capTable.esopUnallocated")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      —
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[11px] uppercase"
                      >
                        Reserved
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {fmtNum(data!.esopPoolUnallocated)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {esopUnallocatedPct}%
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t("capTable.esopPool")}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">
                    {includeEsop ? t("capTable.totalFullyDiluted") : t("capTable.totalExclEsop")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {fmtNum(displayTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    100.0000%
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
