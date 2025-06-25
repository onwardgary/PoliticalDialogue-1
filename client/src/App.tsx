import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { ReduxProvider } from "./providers/redux-provider";
import NotFound from "./pages/not-found";
import HomePage from "./pages/home-page";
import AuthPage from "./pages/auth-page";
import DebatePage from "./pages/debate-page-simplified-new";
import DebatePageTemp from "./pages/debate-page-temp"; // Using temp page to fix hooks issue
import DebatePageFixed from "./pages/debate-page-fixed"; // Fixed version with proper party handling
import DebatePageRedux from "./pages/debate-page-redux"; // New Redux implementation
import SummaryPage from "./pages/summary-page";
import ProfilePage from "./pages/profile-page";
import AdminKnowledgePage from "./pages/admin-knowledge-page-new";
import AdminUsersPage from "./pages/admin-users-page";
import InsightsPage from "./pages/insights-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  // Using the fixed implementation with proper party handling
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
      <ProtectedRoute path="/admin/users" component={AdminUsersPage} adminOnly />
      
      {/* Auth page */}
      <Route path="/auth" component={AuthPage} />
      
      {/* Insights route - protected */}
      <Route path="/insights">
        <ProtectedRoute>
          <InsightsPage />
        </ProtectedRoute>
      </Route>

      {/* For testing other debate page versions */}
      <Route path="/debate-redux/:id([0-9]+)" component={DebatePageRedux} />
      <Route path="/debate-redux/s/:secureId" component={DebatePageRedux} />
      <Route path="/debate-original/:id([0-9]+)" component={DebatePage} />
      <Route path="/debate-original/s/:secureId" component={DebatePage} />
      <Route path="/debate-fixed/:id([0-9]+)" component={DebatePageFixed} />
      <Route path="/debate-fixed/s/:secureId" component={DebatePageFixed} />
      
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
