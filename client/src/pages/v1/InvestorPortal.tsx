/**
 * Investor Portal — read-only view for investors to see their holdings,
 * vesting progress, documents, and download certificates.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, FileText, Award, Briefcase, Download, CheckCircle2, Clock, Eye, Mail, Users, XCircle, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { FeatureGate } from "@/components/FeatureGate";
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
  const { companyRole } = useAuth();
  // Company-side roles get the MANAGEMENT view (who can access the portal);
  // only the `investor` role gets the investor-facing holdings view.
  // Before this split, an owner opening this page was told "your email is not
  // linked to an investor record" — technically true, practically confusing.
  const isInvestor = companyRole === "investor";
  return (
    <DashboardLayout>
      <FeatureGate feature="investorPortal">
        {isInvestor ? <InvestorPortalContent /> : <InvestorPortalAdminView />}
      </FeatureGate>
    </DashboardLayout>
  );
}

/** Management view for owner / admin / cfo / lawyer / viewer. */
function InvestorPortalAdminView() {
  const { t } = useTranslation("pages");
  const [, setLocation] = useLocation();
  const overview = trpc.investorPortal.accessOverview.useQuery();

  if (overview.isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }
  if (overview.isError || !overview.data) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-destructive">{t("investorPortal.loadError", { defaultValue: "Failed to load data. Please try again." })}</p>
      </div>
    );
  }

  const { investors, summary } = overview.data;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {t("investorPortal.admin.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("investorPortal.admin.desc")}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setLocation("/team")}>
          <UserPlus className="h-3.5 w-3.5" />
          {t("investorPortal.admin.invite")}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>{t("investorPortal.admin.statTotal")}</CardDescription><CardTitle className="text-2xl">{summary.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>{t("investorPortal.admin.statWithEmail")}</CardDescription><CardTitle className="text-2xl">{summary.withEmail}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>{t("investorPortal.admin.statLinked")}</CardDescription><CardTitle className="text-2xl">{summary.linked}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("investorPortal.admin.tableTitle")}</CardTitle>
          <CardDescription>{t("investorPortal.admin.tableDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {investors.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("investorPortal.admin.empty")}</p>
          ) : (
            <div className="divide-y">
              {investors.map(inv => {
                const state = inv.canAccessPortal ? "linked" : !inv.hasEmail ? "noEmail" : !inv.hasAccount ? "noAccount" : "noMembership";
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{inv.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{inv.email ?? t("investorPortal.admin.noEmailValue")}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {state === "linked" ? (
                        <Badge variant="secondary" className="gap-1 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300">
                          <CheckCircle2 className="h-3 w-3" /> {t("investorPortal.admin.stateLinked")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <XCircle className="h-3 w-3" /> {t(`investorPortal.admin.state_${state}`)}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t("investorPortal.admin.howItWorks")}</p>
    </div>
  );
}

function InvestorPortalContent() {
  const { t } = useTranslation("pages");
  const { data: profile, isLoading: profileLoading, isError: profileError } = trpc.investorPortal.myProfile.useQuery();
  const { data: holdingsData, isLoading: holdingsLoading, isError: holdingsError } = trpc.investorPortal.myHoldings.useQuery();
  const { data: grants, isLoading: grantsLoading } = trpc.investorPortal.myGrants.useQuery();
  const { data: documents, isLoading: docsLoading } = trpc.investorPortal.myDocuments.useQuery();
  const { data: registerEntries } = trpc.investorPortal.myRegisterEntries.useQuery();
  const { data: contact } = trpc.investorPortal.companyContact.useQuery();

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

  const isError = profileError || holdingsError;

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-destructive">{t("investorPortal.loadError", { defaultValue: "Failed to load data. Please try again." })}</p>
      </div>
    );
  }

  if (!profile) {
    const contactEmail = contact?.email ?? null;
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="text-center py-20">
          <PieChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-2">{t("investorPortal.noAccess")}</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            {t("investorPortal.noAccessDesc")}
          </p>
          {contactEmail ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(t("investorPortal.contactSubject"))}`}
            >
              <Mail className="h-3.5 w-3.5" />
              {t("investorPortal.contactCompany", { name: contact?.companyName ?? "" })}
            </Button>
          ) : null}
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
          <CardTitle className="text-base">{t("investorPortal.holdingsTitle")}</CardTitle>
          <CardDescription>{t("investorPortal.holdingsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {holdingsLoading ? (
            <div className="h-16 bg-muted rounded animate-pulse" />
          ) : !holdingsData || holdingsData.holdings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("investorPortal.noShares")}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("investorPortal.totalShares")}</p>
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
              {t("investorPortal.grantsTitle")}
            </CardTitle>
            <CardDescription>{t("investorPortal.grantsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {grants.map((g: any) => (
              <div key={g.id} className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">
                      {t("investorPortal.sharesGranted", { count: formatNumber(g.sharesGranted) })}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {g.grantDate ? t("investorPortal.grantedOn", { date: formatDate(g.grantDate) }) : "—"}
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
                    {t("investorPortal.exercisePrice", { currency: g.currency ?? "NTD", price: g.exercisePrice })}
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
              {t("investorPortal.certsTitle")}
            </CardTitle>
            <CardDescription>{t("investorPortal.certsDesc")}</CardDescription>
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
                      {e.eventType === "esop_exercise" ? t("investorPortal.esopExercise") : t("investorPortal.issuance")} — {formatDate(e.effectiveDate)}
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
                    <Download className="h-3 w-3" /> {t("investorPortal.certificate")}
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
              {t("investorPortal.docsTitle")}
            </CardTitle>
            <CardDescription>{t("investorPortal.docsDesc")}</CardDescription>
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
                      <Download className="h-3 w-3" /> {t("investorPortal.download")}
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
