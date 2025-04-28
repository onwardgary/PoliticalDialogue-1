import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import DebatePage from "@/pages/debate-page";
import SummaryPage from "@/pages/summary-page";
import TrendingPage from "@/pages/trending-page";
import AdminKnowledgePage from "@/pages/admin-knowledge-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      {/* Regular routes accessible to all users */}
      <Route path="/" component={HomePage} />
      <Route path="/debate/:id" component={DebatePage} />
      <Route path="/summary/:id" component={SummaryPage} />
      <Route path="/trending" component={TrendingPage} />
      
      {/* Admin routes are protected */}
      <ProtectedRoute path="/admin/knowledge" component={AdminKnowledgePage} />
      
      {/* Auth page */}
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <Router />
    </TooltipProvider>
  );
}

export default App;
