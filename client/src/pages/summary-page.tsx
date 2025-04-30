import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import DebateSummary from "@/components/debate-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function SummaryPage() {
  const { id } = useParams();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Fetch debate data
  const { data: debate, isLoading: isLoadingDebate } = useQuery({
    queryKey: [`/api/debates/${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/debates/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch debate");
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
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
  
  // Fetch public aggregate summary
  const { data: aggregateSummary, isLoading: isLoadingAggregate } = useQuery({
    queryKey: ["/api/trending/weekly", debate?.topic],
    queryFn: async () => {
      const response = await fetch("/api/trending/weekly");
      if (!response.ok) {
        throw new Error("Failed to fetch trending topics");
      }
      const summaries = await response.json();
      return summaries.find((s: any) => s.topic === debate?.topic && s.partyId === debate?.partyId);
    },
    enabled: !!debate && !!debate.topic,
    refetchOnWindowFocus: false,
  });
  
  const isLoading = isLoadingDebate || isLoadingParty || isLoadingAggregate;
  
  // Redirect if debate doesn't exist or user doesn't own it
  useEffect(() => {
    if (!isLoading && (!debate || (debate && user && debate.userId !== user.id))) {
      toast({
        title: "Access denied",
        description: "You can only view your own debate summaries.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [isLoading, debate, user, setLocation, toast]);
  
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
                <div className="flex items-center space-x-2 text-neutral-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p>The summary is still being generated. Please wait a moment...</p>
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
          <div className="flex items-center mt-2">
            <div className={`w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-2`}>
              <span className="text-white font-bold text-xs">{party.shortName}</span>
            </div>
            <p className="text-sm text-neutral-600">{topic} • {formattedDate}</p>
          </div>
        </header>
        
        <div className="p-6">
          <DebateSummary 
            debateId={parseInt(id || "0")}
            summary={debate.summary}
            partyName={party.name}
            partyShortName={party.shortName}
          />
          
          {aggregateSummary && (
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Public Aggregate Summary</h3>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="px-3 py-1 rounded-full text-xs hover:bg-neutral-100">Daily</Button>
                  <Button variant="default" size="sm" className="px-3 py-1 rounded-full text-xs">Weekly</Button>
                  <Button variant="outline" size="sm" className="px-3 py-1 rounded-full text-xs hover:bg-neutral-100">Monthly</Button>
                </div>
              </div>
              
              <p className="text-sm text-neutral-600 mb-4">Based on {aggregateSummary.totalDebates} citizen debates on {topic.toLowerCase()} with {party.shortName} Bot this week</p>
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-2">
                    <span className="text-white font-bold text-xs">P</span>
                  </div>
                  <span className="font-medium">{Math.round((aggregateSummary.partyVotes / (aggregateSummary.partyVotes + aggregateSummary.citizenVotes)) * 100)}%</span>
                </div>
                
                <div className="flex-1 mx-4">
                  <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full" 
                      style={{ 
                        width: `${Math.round((aggregateSummary.partyVotes / (aggregateSummary.partyVotes + aggregateSummary.citizenVotes)) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <span className="font-medium">{Math.round((aggregateSummary.citizenVotes / (aggregateSummary.partyVotes + aggregateSummary.citizenVotes)) * 100)}%</span>
                  <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center ml-2">
                    <span className="text-white font-bold text-xs">C</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-md font-medium text-primary mb-3">Top {party.shortName} Arguments</h4>
                  <ol className="space-y-3 list-decimal pl-5">
                    {aggregateSummary.partyArguments.map((argument: string, index: number) => (
                      <li key={index} className="text-sm text-neutral-700">{argument}</li>
                    ))}
                  </ol>
                </div>
                
                <div>
                  <h4 className="text-md font-medium text-secondary mb-3">Top Citizen Arguments</h4>
                  <ol className="space-y-3 list-decimal pl-5">
                    {aggregateSummary.citizenArguments.map((argument: string, index: number) => (
                      <li key={index} className="text-sm text-neutral-700">{argument}</li>
                    ))}
                  </ol>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <Button variant="outline" className="px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                  <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                    <polyline points="16 6 12 2 8 6"></polyline>
                    <line x1="12" y1="2" x2="12" y2="15"></line>
                  </svg>
                  Share this summary
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <MobileNavigation />
      </main>
    </div>
  );
}
