import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  // Use a try-catch to handle cases where auth is not available
  let user = null;
  let isLoading = false;
  
  try {
    const auth = useAuth();
    user = auth.user;
    isLoading = auth.isLoading;
  } catch (error) {
    console.log("Auth context not available in protected route");
  }
  
  return (
    <Route path={path}>
      {() => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }
        
        if (!user) {
          return <Redirect to="/auth" />;
        }
        
        return <Component />;
      }}
    </Route>
  );
}
