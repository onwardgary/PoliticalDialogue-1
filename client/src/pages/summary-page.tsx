import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import DebateSummaryTabbed from "@/components/debate-summary-tabbed";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Check, Copy, Loader2, RefreshCw, Share2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

export default function SummaryPage() {
  // Extract parameters from the URL - could be either regular ID or secure ID
  const params = useParams();
  const id = params.id;
  const secureId = params.secureId;
  
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // State for tracking the share button state
  const [isCopied, setIsCopied] = useState(false);
  
  // Handle regenerating a summary if it failed
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!secureId && !id) throw new Error("No debate ID available");
      
      const endpoint = secureId 
        ? `/api/debates/s/${secureId}/regenerate-summary`
        : `/api/debates/${id}/regenerate-summary`;
        
      // Determine mode based on topic if debate data is available
      let mode = "debate"; // Default mode
      
      if (debate?.topic) {
        // If topic contains "discussion" or "recommendations", use "discuss" mode
        if (debate.topic.toLowerCase().includes("discussion") || 
            debate.topic.toLowerCase().includes("recommendations")) {
          mode = "discuss";
        }
      }
      
      console.log(`Regenerating summary with mode: ${mode}`);
      
      // Pass the mode parameter to the regenerate endpoint
      const res = await apiRequest("POST", endpoint, { mode });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Summary regenerated",
        description: "A new summary has been generated for your debate.",
      });
      // Force refetch to show new summary
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Could not regenerate summary: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Determine which API endpoint to use based on which parameter is available
  const apiEndpoint = secureId 
    ? `/api/debates/s/${secureId}` 
    : `/api/debates/${id}`;
  
  // Fetch debate data with automatic polling if summary is not available
  const { 
    data: debate, 
    isLoading: isLoadingDebate, 
    refetch
  } = useQuery({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      console.log("Fetching debate summary from:", apiEndpoint);
      const response = await fetch(apiEndpoint, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error("Failed to fetch debate");
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchInterval: (data: any) => {
      // If we have a completed debate with a summary, stop polling
      // We're using an explicit 'any' type to handle the debate data structure
      if (data && data.summary) return false;
      // Otherwise, poll every 2 seconds
      return 2000;
    }
  });
  // Fetch party data
  const { data: party, isLoading: isLoadingParty } = useQuery({
    queryKey: ["/api/parties", debate?.partyId],
    queryFn: async () => {
      if (!debate) return null;
      const response = await fetch("/api/parties");
      if (!response.ok) {
        throw new Error("Failed to fetch parties");
      }
      const parties = await response.json();
      return parties.find((p: any) => p.id === debate.partyId);
    },
    enabled: !!debate,
    refetchOnWindowFocus: false,
  });
  
  // Trending API has been removed to simplify the application
  
  const isLoading = isLoadingDebate || isLoadingParty;
  
  // Function to copy the debate URL to clipboard
  const handleShare = () => {
    const url = window.location.href;
    
    navigator.clipboard.writeText(url)
      .then(() => {
        setIsCopied(true);
        toast({
          title: "Link copied!",
          description: "Share this link with others to show them your debate summary.",
        });
        
        // Reset the copied state after 2 seconds
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      })
      .catch((error) => {
        console.error("Failed to copy URL:", error);
        toast({
          title: "Copy failed",
          description: "Could not copy the link. Please try again.",
          variant: "destructive",
        });
      });
  };

  // Only redirect if debate doesn't exist
  useEffect(() => {
    if (!isLoading && !debate) {
      toast({
        title: "Debate not found",
        description: "The debate you are looking for does not exist.",
        variant: "destructive",
      });
      setLocation("/");
    }
    // No ownership check - we're allowing any user to view debates
  }, [isLoading, debate, setLocation, toast]);
  
  if (isLoading || !debate || !party) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Check if summary exists, if not show a loading message
  if (!debate.summary) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1">
          <MobileHeader />
          <div className="p-6">
            <div className="rounded-lg border bg-white shadow-sm">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Your Debate Summary</h3>
                <div className="flex items-center space-x-2 text-neutral-600 mb-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p>The summary is still being generated. Please wait a moment...</p>
                </div>
                <div className="text-center mt-6">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetch()}
                    className="text-sm hover:bg-neutral-100"
                  >
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2v6h-6"></path>
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                        <path d="M3 22v-6h6"></path>
                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                      </svg>
                      Check Again
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  const formattedDate = debate?.createdAt 
    ? format(new Date(debate.createdAt), "MMMM d, yyyy") 
    : "Unknown date";
  
  const topic = debate.topic || "Political Discussion";
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1">
        <MobileHeader />
        
        <header className="bg-white border-b border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="mr-2 text-neutral-500 hover:text-neutral-700"
                onClick={() => setLocation("/")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-xl font-semibold">Debate Summary</h2>
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="text-sm hover:bg-neutral-100"
                onClick={handleShare}
              >
                <span className="flex items-center">
                  {isCopied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3 w-3 mr-1" />
                      Share
                    </>
                  )}
                </span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="text-sm hover:bg-neutral-100"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
              >
                {regenerateMutation.isPending ? (
                  <span className="flex items-center">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Regenerating...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Regenerate
                  </span>
                )}
              </Button>
            </div>
          </div>
          <div className="flex items-center mt-2">
            <div className={`w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-2`}>
              <span className="text-white font-bold text-xs">{party.shortName}</span>
            </div>
            <p className="text-sm text-neutral-600">{topic} • {formattedDate}</p>
          </div>
        </header>
        
        <div className="p-6">
          <DebateSummaryTabbed 
            debateId={secureId || String(debate.id)}
            summary={debate.summary}
            partyName={party.name}
            partyShortName={party.shortName}
            topic={debate.topic}
          />
        </div>
        
        <MobileNavigation />
      </main>
    </div>
  );
}
