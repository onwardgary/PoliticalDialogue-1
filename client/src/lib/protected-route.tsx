import { Loader2 } from "lucide-react";
import { Route } from "wouter";

// Temporarily modified to not require authentication
export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  // Instead of using auth, we'll temporarily allow all access
  // const { user, isLoading } = useAuth();
  
  return (
    <Route path={path}>
      {() => <Component />}
    </Route>
  );
}
