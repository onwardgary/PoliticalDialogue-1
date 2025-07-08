import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { ReduxProvider } from "./providers/redux-provider";
import NotFound from "./pages/not-found";
import HomePage from "./pages/home-page";
import AuthPage from "./pages/auth-page";
import DebatePageFixed from "./pages/debate-page-fixed"; // Main debate page
import SummaryPage from "./pages/summary-page";
import ProfilePage from "./pages/profile-page";
import AdminKnowledgePage from "./pages/admin-knowledge-page-new";
import AdminUsersPage from "./pages/admin-users-page";
import { ProtectedRoute } from "./lib/protected-route";
import InsightsPage from "./pages/insights-page";
import AdminInsightsPage from "./pages/admin-insights-page";

function Router() {
  const DebateComponent = DebatePageFixed;
  
  return (
    <Switch>
      {/* Regular routes accessible to all users */}
      <Route path="/" component={HomePage} />
      
      {/* Legacy numeric ID routes for backward compatibility */}
      <Route path="/debate/:id([0-9]+)" component={DebateComponent} />
      <Route path="/summary/:id([0-9]+)" component={SummaryPage} />
      
      {/* New secure ID routes (preferred) */}
      <Route path="/debate/s/:secureId" component={DebateComponent} />
      <Route path="/summary/s/:secureId" component={SummaryPage} />
      
      {/* User routes - require authentication - temporarily hidden
      <ProtectedRoute path="/profile" component={ProfilePage} />
      */}
      
      {/* Admin routes - protected for admins only */}
      <ProtectedRoute path="/admin/knowledge" component={AdminKnowledgePage} adminOnly />
      <ProtectedRoute path="/admin/insights" component={AdminInsightsPage} adminOnly />
      <ProtectedRoute path="/admin/users" component={AdminUsersPage} adminOnly />
      
      {/* Auth page */}
      <Route path="/auth" component={AuthPage} />
      
      {/* Insights route - protected */}
      <ProtectedRoute path="/insights" component={InsightsPage} />

      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ReduxProvider>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          {/* This is here to ensure the toaster UI is correctly rendered */}
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </ReduxProvider>
  );
}

export default App;
