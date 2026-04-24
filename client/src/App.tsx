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
import ShareClassesPage from "./pages/v1/ShareClasses";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/cap-table" component={V1CapTablePage} />
      <Route path="/share-classes" component={ShareClassesPage} />
      <Route path="/register" component={V1ShareRegisterPage} />
      <Route path="/esop" component={EsopV1Page} />
      <Route path="/funding-rounds" component={V1RoundsPage} />
      <Route path="/funding-rounds/:id" component={V1RoundDetailPage} />
      <Route path="/investors" component={V1InvestorsPage} />
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
