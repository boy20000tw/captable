import "./i18n"; // i18n must initialize before any component renders
import { Suspense, lazy } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import PageLoader from "./components/PageLoader";
import RoleGuard from "./components/RoleGuard";

// --- Home (keep static — first paint) ---
import Home from "./pages/Home";

// --- Lazy-loaded pages ---
// Core cap table
const V1CapTablePage = lazy(() => import("./pages/v1/CapTable"));
const V1ShareRegisterPage = lazy(() => import("./pages/v1/ShareRegister"));
const EsopV1Page = lazy(() => import("./pages/v1/Esop"));
const V1RoundsPage = lazy(() => import("./pages/v1/Rounds"));
const V1RoundDetailPage = lazy(() => import("./pages/v1/RoundDetail"));
const V1InvestorsPage = lazy(() => import("./pages/v1/Investors"));
const CompanySettingsPage = lazy(() => import("./pages/v1/CompanySettings"));
const InvestorPortalPage = lazy(() => import("./pages/v1/InvestorPortal"));

// Analysis & tools
const AntiDilutionPage = lazy(() => import("./pages/AntiDilution"));
const InstrumentsPage = lazy(() => import("./pages/Instruments"));
const ESignPage = lazy(() => import("./pages/ESign"));
const ValuationPage = lazy(() => import("./pages/Valuation"));
const ProjectionsPage = lazy(() => import("./pages/Projections"));
const WaterfallPage = lazy(() => import("./pages/Waterfall"));
const CompsAnalysisPage = lazy(() => import("./pages/CompsAnalysis"));
const SnapshotsPage = lazy(() => import("./pages/Snapshots"));
const AuditLogPage = lazy(() => import("./pages/AuditLog"));
const ImportPage = lazy(() => import("./pages/Import"));
const TeamPage = lazy(() => import("./pages/Team"));
const JoinPage = lazy(() => import("./pages/Join"));
const Valuation409APage = lazy(() => import("./pages/Valuation409A"));
const Election83bPage = lazy(() => import("./pages/Election83b"));
const ShareTransfersPage = lazy(() => import("./pages/ShareTransfers"));

// Taiwan compliance
const TechShareTaxPage = lazy(() => import("./pages/TechShareTax"));
const ClosedCompanyPage = lazy(() => import("./pages/ClosedCompany"));
const AngelTaxDeductionPage = lazy(() => import("./pages/AngelTaxDeduction"));

// Admin panel
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverview"));
const AdminCompaniesPage = lazy(() => import("./pages/admin/AdminCompanies"));
const AdminActivityPage = lazy(() => import("./pages/admin/AdminActivity"));
const AdminTicketsPage = lazy(() => import("./pages/admin/AdminTickets"));
const AdminNotificationsPage = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminVersionsPage = lazy(() => import("./pages/admin/AdminVersions"));
const AdminSecurityPage = lazy(() => import("./pages/admin/AdminSecurity"));
const AdminPaymentPage = lazy(() => import("./pages/admin/AdminPayment"));
const AdminTeamPage = lazy(() => import("./pages/admin/AdminTeam"));
const AdminTemplatesPage = lazy(() => import("./pages/admin/AdminTemplates"));
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLogin"));

// Subscription & legal
const SubscriptionPage = lazy(() => import("./pages/Subscription"));
const PricingPage = lazy(() => import("./pages/Pricing"));
const ComparePlansPage = lazy(() => import("./pages/ComparePlans"));
const HelpSupportPage = lazy(() => import("./pages/HelpSupport"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfService"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/cap-table" component={V1CapTablePage} />
        <Route path="/register" component={V1ShareRegisterPage} />
        <Route path="/esop" component={EsopV1Page} />
        <Route path="/funding-rounds" component={V1RoundsPage} />
        <Route path="/funding-rounds/:id" component={V1RoundDetailPage} />
        <Route path="/investors" component={V1InvestorsPage} />
        <Route path="/investor-portal" component={InvestorPortalPage} />
        <Route path="/anti-dilution" component={AntiDilutionPage} />
        <Route path="/instruments" component={InstrumentsPage} />
        <Route path="/esign" component={ESignPage} />
        <Route path="/valuation" component={ValuationPage} />
        <Route path="/projections" component={ProjectionsPage} />
        <Route path="/waterfall" component={WaterfallPage} />
        <Route path="/comps" component={CompsAnalysisPage} />
        <Route path="/snapshots" component={SnapshotsPage} />
        <Route path="/audit-log" component={AuditLogPage} />
        <Route path="/import" component={ImportPage} />
        <Route path="/team" component={TeamPage} />
        <Route path="/settings" component={CompanySettingsPage} />
        <Route path="/join" component={JoinPage} />
        <Route path="/409a" component={Valuation409APage} />
        <Route path="/83b" component={Election83bPage} />
        <Route path="/transfers" component={ShareTransfersPage} />
        <Route path="/tech-share-tax" component={TechShareTaxPage} />
        <Route path="/closed-company" component={ClosedCompanyPage} />
        <Route path="/angel-tax" component={AngelTaxDeductionPage} />

        {/* Subscription */}
        <Route path="/subscription" component={SubscriptionPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/compare-plans" component={ComparePlansPage} />
        <Route path="/help" component={HelpSupportPage} />

        {/* Legal */}
        <Route path="/privacy" component={PrivacyPolicyPage} />
        <Route path="/terms" component={TermsOfServicePage} />

        {/* Admin panel routes */}
        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin" component={AdminOverviewPage} />
        <Route path="/admin/companies" component={AdminCompaniesPage} />
        <Route path="/admin/templates" component={AdminTemplatesPage} />
        <Route path="/admin/activity" component={AdminActivityPage} />
        <Route path="/admin/tickets" component={AdminTicketsPage} />
        <Route path="/admin/notifications" component={AdminNotificationsPage} />
        <Route path="/admin/versions" component={AdminVersionsPage} />
        <Route path="/admin/security" component={AdminSecurityPage} />
        <Route path="/admin/payment" component={AdminPaymentPage} />
        <Route path="/admin/team" component={AdminTeamPage} />

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <CurrencyProvider>
          <TooltipProvider>
            <Toaster />
            <SpeedInsights />
            <RoleGuard>
              <Router />
            </RoleGuard>
          </TooltipProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
