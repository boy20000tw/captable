/**
 * Investor Portal — read-only view for investors to see their holdings,
 * vesting progress, documents, and download certificates.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, FileText, Award, Briefcase, Download, CheckCircle2, Clock, Eye } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { getActiveCompanyId } from "@/lib/activeCompany";
import { formatDate, formatNumber } from "@/lib/utils";
import { VestingTimeline } from "@/components/v1/VestingTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";

export default function InvestorPortalPage() {
  return (
    <DashboardLayout>
      <InvestorPortalContent />
    </DashboardLayout>
  );
}

function InvestorPortalContent() {
  const { t } = useTranslation("pages");
  const { data: profile, isLoading: profileLoading } = trpc.investorPortal.myProfile.useQuery();
  const { data: holdingsData, isLoading: holdingsLoading } = trpc.investorPortal.myHoldings.useQuery();
  const { data: grants, isLoading: grantsLoading } = trpc.investorPortal.myGrants.useQuery();
  const { data: documents, isLoading: docsLoading } = trpc.investorPortal.myDocuments.useQuery();
  const { data: registerEntries } = trpc.investorPortal.myRegisterEntries.useQuery();

  const isLoading = profileLoading || holdingsLoading;

  // Signing status for documents
  const signingStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
      case "pending": case "viewed": return <Clock className="h-3.5 w-3.5 text-amber-500" />;
      default: return <Eye className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  // Issuance entries for certificate download
  const issuanceEntries = useMemo(() => {
    if (!registerEntries) return [];
    return registerEntries.filter((e: any) =>
      (e.eventType === "issuance" || e.eventType === "esop_exercise") && Number(e.shares) > 0
    );
  }, [registerEntries]);

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="text-center py-20">
          <PieChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-2">Investor Portal</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your account email is not linked to an investor record in this company.
            Please contact the company administrator to set up your access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <PieChart className="h-6 w-6 text-primary" />
          {t("investorPortal.welcome", { name: profile.name })}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("investorPortal.desc")}
        </p>
      </div>

      {/* Holdings Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Holdings</CardTitle>
          <CardDescription>Current shares by class</CardDescription>
        </CardHeader>
        <CardContent>
          {holdingsLoading ? (
            <div className="h-16 bg-muted rounded animate-pulse" />
          ) : !holdingsData || holdingsData.holdings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No shares held yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Shares</p>
                  <p className="text-2xl font-bold mt-1">{formatNumber(holdingsData.totalShares)}</p>
                </div>
                {holdingsData.holdings.map((h: any) => (
                  <div key={h.shareClass} className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      {h.shareClass.replace(/_/g, " ")}
                    </p>
                    <p className="text-xl font-semibold mt-1">{formatNumber(h.shares)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ESOP Grants */}
      {grants && grants.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              ESOP Grants
            </CardTitle>
            <CardDescription>Your stock option grants and vesting progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {grants.map((g: any) => (
              <div key={g.id} className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">
                      {formatNumber(g.sharesGranted)} shares granted
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      on {g.grantDate ? formatDate(g.grantDate) : "—"}
                    </span>
                  </div>
                  <Badge className={
                    g.status === "active" ? "bg-blue-100 text-blue-700 border-transparent" :
                    g.status === "fully_vested" ? "bg-green-100 text-green-700 border-transparent" :
                    g.status === "exercised" ? "bg-purple-100 text-purple-700 border-transparent" :
                    "bg-red-100 text-red-700 border-transparent"
                  }>
                    {g.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                {g.exercisePrice && (
                  <p className="text-xs text-muted-foreground">
                    Exercise price: {g.currency ?? "NTD"} {g.exercisePrice} / share
                  </p>
                )}
                <VestingTimeline grant={g} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Share Certificates */}
      {issuanceEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4" />
              Share Certificates
            </CardTitle>
            <CardDescription>Download certificates for your issued shares</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {issuanceEntries.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">
                      {formatNumber(Math.abs(Number(e.shares)))} shares — {String(e.shareClass).replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.eventType === "esop_exercise" ? "ESOP Exercise" : "Issuance"} on {formatDate(e.effectiveDate)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      const params = new URLSearchParams({
                        companyId: String(getActiveCompanyId()),
                        investorId: String(e.investorId),
                        shareClass: String(e.shareClass),
                        shares: String(Math.abs(Number(e.shares))),
                        effectiveDate: e.effectiveDate,
                        registerEntryId: String(e.id),
                        ...(e.pricePerShare ? { pricePerShare: e.pricePerShare } : {}),
                        ...(e.currency ? { currency: e.currency } : {}),
                      });
                      window.open(`/api/export/certificate.pdf?${params}`, "_blank");
                    }}
                  >
                    <Download className="h-3 w-3" /> Certificate
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {documents && documents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </CardTitle>
            <CardDescription>Signing requests and agreements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    {signingStatusIcon(d.status)}
                    <div>
                      <p className="text-sm font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.docType?.replace(/_/g, " ")} — {d.status}
                      </p>
                    </div>
                  </div>
                  {d.signedDocumentUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => window.open(d.signedDocumentUrl, "_blank")}
                    >
                      <Download className="h-3 w-3" /> Download
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
