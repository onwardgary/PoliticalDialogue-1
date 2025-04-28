import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, RegisterData>;
};

type LoginData = {
  email: string;
  password: string;
};

const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterData = z.infer<typeof registerSchema>;

// Create a default context value to avoid null checks everywhere
const defaultAuthContext: AuthContextType = {
  user: null,
  isLoading: false,
  error: null,
  loginMutation: {
    mutate: () => {},
    isPending: false,
  } as any,
  logoutMutation: {
    mutate: () => {},
    isPending: false,
  } as any,
  registerMutation: {
    mutate: () => {},
    isPending: false,
  } as any,
};

export const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 0, // Always fetch the latest user info
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        console.log("Login mutation executing with credentials:", credentials);
        const res = await apiRequest("POST", "/api/login", credentials);
        const userData = await res.json();
        console.log("Login successful, received user data:", userData);
        return userData;
      } catch (error) {
        console.error("Login mutation error:", error);
        throw error;
      }
    },
    onSuccess: (user: SelectUser) => {
      console.log("Login mutation success, updating user in query cache:", user);
      // Set the user in the query cache
      queryClient.setQueryData(["/api/user"], user);
      
      // Force a refetch to ensure we have the latest user data
      setTimeout(() => {
        refetch();
      }, 100);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      console.error("Login mutation onError handler:", error);
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      try {
        console.log("Register mutation executing with data:", {...data, password: "***REDACTED***"});
        // Omit confirmPassword before sending to server
        const { confirmPassword, ...credentials } = data;
        const res = await apiRequest("POST", "/api/register", credentials);
        const userData = await res.json();
        console.log("Registration successful, received user data:", userData);
        return userData;
      } catch (error) {
        console.error("Registration mutation error:", error);
        throw error;
      }
    },
    onSuccess: (user: SelectUser) => {
      console.log("Registration mutation success, updating user in query cache:", user);
      // Set the user in the query cache
      queryClient.setQueryData(["/api/user"], user);
      
      // Force a refetch to ensure we have the latest user data
      setTimeout(() => {
        refetch();
      }, 100);
      
      toast({
        title: "Registration successful",
        description: `Welcome to Suara.sg, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      console.error("Registration mutation onError handler:", error);
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        console.log("Logout mutation executing");
        await apiRequest("POST", "/api/logout");
        console.log("Logout API call successful");
      } catch (error) {
        console.error("Logout mutation error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log("Logout mutation success, clearing user from query cache");
      // Clear the user from query cache
      queryClient.setQueryData(["/api/user"], null);
      
      // Force a refetch to ensure we have the latest state
      setTimeout(() => {
        refetch();
      }, 100);
      
      toast({
        title: "Logout successful",
        description: "You've been logged out successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Logout mutation onError handler:", error);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context; // Will always return at least the default context
}
