import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CapTablePage from "./pages/CapTable";
import FundingRoundsPage from "./pages/FundingRounds";
import InvestorsPage from "./pages/Investors";
import EsopPage from "./pages/Esop";
import RegisterPage from "./pages/Register";
import ProjectionsPage from "./pages/Projections";
import EstimatedValuationPage from "./pages/EstimatedValuation";
import ImportPage from "./pages/Import";
import SnapshotsPage from "./pages/Snapshots";
import AntiDilutionPage from "./pages/AntiDilution";
import WaterfallPage from "./pages/Waterfall";
import TeamPage from "./pages/Team";
import AuditLogPage from "./pages/AuditLog";
import JoinPage from "./pages/Join";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/cap-table" component={CapTablePage} />
      <Route path="/funding-rounds" component={FundingRoundsPage} />
      <Route path="/investors" component={InvestorsPage} />
      <Route path="/esop" component={EsopPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/projections" component={ProjectionsPage} />
      <Route path="/estimated-valuation" component={EstimatedValuationPage} />
      <Route path="/import" component={ImportPage} />
      <Route path="/snapshots" component={SnapshotsPage} />
      <Route path="/anti-dilution" component={AntiDilutionPage} />
      <Route path="/waterfall" component={WaterfallPage} />
      <Route path="/team" component={TeamPage} />
      <Route path="/audit-log" component={AuditLogPage} />
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
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
