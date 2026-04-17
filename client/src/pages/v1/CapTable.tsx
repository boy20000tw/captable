import { useState } from "react";
import { useLocation } from "wouter";
import { PieChart, ArrowRight } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
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
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.v1.capTable.current.useQuery();
  const [includeEsop, setIncludeEsop] = useState(false);

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <PieChart className="h-7 w-7 text-primary" />
            Cap Table
          </h1>
          <p className="text-muted-foreground mt-1">
            Derived from share register. Not editable.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="esop-toggle" className="text-sm text-muted-foreground whitespace-nowrap">
              Include ESOP
            </label>
            <Switch id="esop-toggle" checked={includeEsop} onCheckedChange={setIncludeEsop} />
          </div>
          {data?.generatedAt && (
            <p className="text-xs text-muted-foreground">
              As of {new Date(data.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* KPI metrics */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Metric
              label={includeEsop ? "Total Shares (Fully Diluted)" : "Issued Shares (Excl. ESOP)"}
              value={data ? fmtNum(displayTotal) : "—"}
            />
            <Metric
              label="Issued Shares"
              value={data ? fmtNum(data.totalIssuedShares) : "—"}
            />
            <Metric
              label="ESOP Pool Allocated"
              value={data ? fmtNum(data.esopPoolAllocated) : "—"}
            />
            <Metric
              label="ESOP Pool Unallocated"
              value={data ? fmtNum(data.esopPoolUnallocated) : "—"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings by Investor</CardTitle>
          <CardDescription>
            Sum of register entries, grouped by investor and share class.
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
                No shares issued yet.
              </p>
              <Button onClick={() => setLocation("/funding-rounds")}>
                Go to Funding Rounds <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Create an allocation under a round, then advance it through the
                lifecycle — reaching <strong>Issued</strong> writes a register
                entry and your cap table will populate automatically.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investor</TableHead>
                  <TableHead>Entity Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Shares</TableHead>
                  <TableHead className="text-right">Ownership %</TableHead>
                  <TableHead>By Share Class</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.holdings.map((h) => (
                  <TableRow key={h.investorId} className="hover:bg-secondary/30">
                    <TableCell className="font-medium">
                      {h.investorName}
                    </TableCell>
                    <TableCell className="capitalize text-xs">
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
                    <TableCell className="text-xs text-muted-foreground">
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
                      ESOP Pool (Unallocated)
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
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
                    <TableCell className="text-xs text-muted-foreground">
                      esop pool
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">
                    {includeEsop ? "Total (Fully Diluted)" : "Total (Excl. ESOP)"}
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
