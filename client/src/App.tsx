import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import NotFound from "./pages/not-found";
import HomePage from "./pages/home-page";
import AuthPage from "./pages/auth-page";
import DebatePage from "./pages/debate-page";
import SummaryPage from "./pages/summary-page";
import ProfilePage from "./pages/profile-page";
import AdminKnowledgePage from "./pages/admin-knowledge-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      {/* Regular routes accessible to all users */}
      <Route path="/" component={HomePage} />
      
      {/* Legacy numeric ID routes for backward compatibility */}
      <Route path="/debate/:id([0-9]+)" component={DebatePage} />
      <Route path="/summary/:id([0-9]+)" component={SummaryPage} />
      
      {/* New secure ID routes (preferred) */}
      <Route path="/debate/s/:secureId" component={DebatePage} />
      <Route path="/summary/s/:secureId" component={SummaryPage} />
      
      {/* User routes - require authentication - temporarily hidden
      <ProtectedRoute path="/profile" component={ProfilePage} />
      */}
      
      {/* Admin routes - temporarily not protected for simplicity */}
      <Route path="/admin/knowledge" component={AdminKnowledgePage} />
      
      {/* Auth page - temporarily hidden
      <Route path="/auth" component={AuthPage} />
      */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Router />
        {/* This is here to ensure the toaster UI is correctly rendered */}
        <Toaster />
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;
