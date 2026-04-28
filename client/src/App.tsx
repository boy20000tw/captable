import "./i18n"; // i18n must initialize before any component renders
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import Home from "./pages/Home";
import V1CapTablePage from "./pages/v1/CapTable";
import V1ShareRegisterPage from "./pages/v1/ShareRegister";
import EsopV1Page from "./pages/v1/Esop";
import V1RoundsPage from "./pages/v1/Rounds";
import V1RoundDetailPage from "./pages/v1/RoundDetail";
import V1InvestorsPage from "./pages/v1/Investors";
import CompanySettingsPage from "./pages/v1/CompanySettings";
import InvestorPortalPage from "./pages/v1/InvestorPortal";
import AntiDilutionPage from "./pages/AntiDilution";
import InstrumentsPage from "./pages/Instruments";
import ESignPage from "./pages/ESign";
import ValuationPage from "./pages/Valuation";
import ProjectionsPage from "./pages/Projections";
import WaterfallPage from "./pages/Waterfall";
import SnapshotsPage from "./pages/Snapshots";
import AuditLogPage from "./pages/AuditLog";
import ImportPage from "./pages/Import";
import TeamPage from "./pages/Team";
import JoinPage from "./pages/Join";
import Valuation409APage from "./pages/Valuation409A";
import Election83bPage from "./pages/Election83b";
import ShareTransfersPage from "./pages/ShareTransfers";
import TechShareTaxPage from "./pages/TechShareTax";
import ClosedCompanyPage from "./pages/ClosedCompany";
import AdminOverviewPage from "./pages/admin/AdminOverview";
import AdminCompaniesPage from "./pages/admin/AdminCompanies";
import AdminActivityPage from "./pages/admin/AdminActivity";
import AdminTicketsPage from "./pages/admin/AdminTickets";
import SubscriptionPage from "./pages/Subscription";
import PricingPage from "./pages/Pricing";
import ComparePlansPage from "./pages/ComparePlans";
import HelpSupportPage from "./pages/HelpSupport";

function Router() {
  return (
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

      {/* Subscription */}
      <Route path="/subscription" component={SubscriptionPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/compare-plans" component={ComparePlansPage} />
      <Route path="/help" component={HelpSupportPage} />

      {/* Admin panel routes */}
      <Route path="/admin" component={AdminOverviewPage} />
      <Route path="/admin/companies" component={AdminCompaniesPage} />
      <Route path="/admin/activity" component={AdminActivityPage} />
      <Route path="/admin/tickets" component={AdminTicketsPage} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <CurrencyProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
