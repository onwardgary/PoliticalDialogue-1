import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { MessageSquare, Loader2 } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Form validation schema
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginData = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading, login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form management for login
  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  
  // Handle login form submission
  const onLoginSubmit = async (data: LoginData) => {
    try {
      setIsSubmitting(true);
      await login(data.email, data.password);
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row items-center justify-center p-4">
      <div className="w-full max-w-5xl flex flex-col md:flex-row rounded-lg overflow-hidden">
        {/* Left column - Auth forms */}
        <div className="w-full md:w-1/2 bg-white p-6">
          <div className="flex justify-center mb-8 md:justify-start">
            <h1 className="text-2xl font-bold text-primary flex items-center">
              <MessageSquare className="mr-2 h-6 w-6" /> Suara.sg
            </h1>
          </div>
          
          <div className="w-full">
            <h2 className="text-2xl font-bold mb-4 text-center">Login to Your Account</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Access is by invitation only. Please use your provided credentials.
            </p>
            
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="your@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your password" type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </div>
        </div>
        
        {/* Right column - Image/branding */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-8 flex flex-col justify-center text-white">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-4">Welcome to Suara.sg</h2>
            <p className="text-lg opacity-90 mb-6">
              Engage in meaningful political debates with AI-powered representatives of Singapore's major political parties.
            </p>
            <ul className="space-y-3 text-sm opacity-80">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                Real-time debate experiences
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                AI-powered party representatives
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                Comprehensive debate summaries
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                Invitation-only community
              </li>
            </ul>
          </div>
          
          <div className="border-t border-white/20 pt-6">
            <p className="text-xs opacity-60">
              A Platform for Civic Engagement
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}