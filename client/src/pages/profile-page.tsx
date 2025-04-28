import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Debate } from "@shared/schema";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MessageSquare, ChevronRight, User, LogOut } from "lucide-react";
import Sidebar from "@/components/sidebar";
import { MobileNavigation } from "@/components/mobile-nav";

type UserDebate = {
  id: number;
  partyId: number;
  topic: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function ProfilePage() {
  const [_, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const isMobile = useIsMobile();

  // Redirect to auth page if user is not logged in
  useEffect(() => {
    if (!user) {
      setLocation("/auth");
    }
  }, [user, setLocation]);

  // Fetch user's debates
  const { 
    data: userDebates, 
    isLoading, 
    error 
  } = useQuery<UserDebate[]>({
    queryKey: ["/api/user/debates"],
    queryFn: async () => {
      const response = await fetch("/api/user/debates");
      if (!response.ok) {
        throw new Error("Failed to fetch debates");
      }
      return response.json();
    },
    enabled: !!user, // Only run query if user is logged in
  });

  // Filter debates based on completion status
  const completedDebates = userDebates?.filter(debate => debate.completed) || [];
  const ongoingDebates = userDebates?.filter(debate => !debate.completed) || [];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Return early if user is not logged in (will redirect via useEffect)
  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Sidebar for desktop */}
      {!isMobile && <Sidebar />}

      {/* Mobile navigation */}
      {isMobile && <MobileNavigation />}

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
              <p className="text-muted-foreground mt-1">
                Welcome back, {user.username}
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex space-x-2">
              <Button 
                variant="outline" 
                className="flex items-center"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </Button>
            </div>
          </div>

          <div className="grid gap-8">
            {/* User information card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Username</p>
                    <p>{user.username}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p>{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Account created</p>
                    <p>{format(new Date(user.createdAt), "PPP")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Debates tabs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  My Debates
                </CardTitle>
                <CardDescription>
                  View your debate history with different political parties
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="all">All Debates</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                    <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
                  </TabsList>
                  
                  {isLoading ? (
                    <div className="space-y-4 mt-6">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : error ? (
                    <div className="text-center p-6 text-red-500">
                      Error loading debates. Please try again.
                    </div>
                  ) : (
                    <>
                      <TabsContent value="all">
                        <DebateTable debates={userDebates || []} />
                      </TabsContent>
                      <TabsContent value="completed">
                        <DebateTable debates={completedDebates} />
                      </TabsContent>
                      <TabsContent value="ongoing">
                        <DebateTable debates={ongoingDebates} />
                      </TabsContent>
                    </>
                  )}
                </Tabs>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href="/">Start a New Debate</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function DebateTable({ debates }: { debates: UserDebate[] }) {
  // Map of party IDs to names and colors
  const partyInfo: Record<number, { name: string; color: string }> = {
    1: { name: "PAP", color: "bg-white border-2 border-[#E91E63] text-[#E91E63]" },
    2: { name: "WP", color: "bg-[#0D47A1] text-white" },
    3: { name: "PSP", color: "bg-[#B71C1C] text-white" },
  };

  return (
    <div className="mt-6 overflow-x-auto">
      {debates.length === 0 ? (
        <div className="text-center p-8">
          <p className="text-muted-foreground">No debates found</p>
        </div>
      ) : (
        <Table>
          <TableCaption>A list of your debates</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debates.map((debate) => (
              <TableRow key={debate.id}>
                <TableCell>{format(new Date(debate.createdAt), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={partyInfo[debate.partyId]?.color || "bg-gray-200"}>
                    {partyInfo[debate.partyId]?.name || `Party ${debate.partyId}`}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {debate.topic || "General Discussion"}
                </TableCell>
                <TableCell>
                  {debate.completed ? (
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                      Completed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                      Ongoing
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={debate.completed ? `/summary/${debate.id}` : `/debate/${debate.id}`}>
                      <span className="flex items-center">
                        {debate.completed ? "View Summary" : "Continue"} <ChevronRight className="ml-1 h-4 w-4" />
                      </span>
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}