import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PartyCard from "@/components/party-card";
import TrendingDebateCard from "@/components/trending-debate-card";
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageSquare, ArrowUp, ChevronRight } from "lucide-react";

export default function HomePage() {
  const [periodFilter, setPeriodFilter] = useState("weekly");
  
  // Fetch political parties
  const { data: parties, isLoading: isLoadingParties } = useQuery({
    queryKey: ["/api/parties"],
    refetchOnWindowFocus: false,
  });
  
  // Fetch trending topics
  const { data: trendingTopics, isLoading: isLoadingTrending } = useQuery({
    queryKey: ["/api/trending", periodFilter],
    queryFn: async ({ queryKey }) => {
      const response = await fetch(`/api/trending/${queryKey[1]}`);
      if (!response.ok) {
        throw new Error("Failed to fetch trending topics");
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
  });
  
  // Process trending data for display
  const trendingDebates = trendingTopics?.map((summary: any) => ({
    id: summary.id,
    partyId: summary.partyId,
    partyShortName: parties?.find((p: any) => p.id === summary.partyId)?.shortName || "PAP",
    topic: summary.topic,
    totalDebates: summary.totalDebates,
    partyVotes: summary.partyVotes,
    citizenVotes: summary.citizenVotes,
    updatedAt: new Date(summary.date)
  })) || [];
  
  const handlePeriodChange = (period: string) => {
    setPeriodFilter(period);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1">
        <MobileHeader />
        
        <header className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-neutral-200 px-6 py-10 md:py-16">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 text-transparent bg-clip-text mb-2">Welcome to Suara.sg</h1>
          <p className="text-neutral-600 text-lg md:w-3/4 lg:w-2/3">
            Engage in meaningful debates with AI-powered political party representatives, 
            understand different policy positions, and contribute to Singapore's democratic discourse.
          </p>
        </header>
        
        {/* Party Selection Section */}
        <section className="p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Select a Political Party to Debate With</h2>
            <p className="text-neutral-500">Choose a party to discuss policies, understand positions, and engage in democratic dialogue</p>
          </div>
          
          {isLoadingParties ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {parties?.map((party: any) => (
                <PartyCard key={party.id} party={party} />
              ))}
            </div>
          )}
        </section>
        
        {/* Trending Debates Section */}
        <section className="p-6 md:p-8 bg-gradient-to-b from-white to-neutral-50 border-t border-neutral-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div className="mb-4 md:mb-0">
              <h2 className="text-xl font-semibold mb-1">Trending Political Debates</h2>
              <p className="text-neutral-500">See what topics are being discussed by the community</p>
            </div>
            <div className="flex space-x-2 bg-white p-1 rounded-full border border-neutral-200 shadow-sm">
              <Button 
                variant={periodFilter === "daily" ? "default" : "ghost"} 
                size="sm" 
                className="rounded-full text-sm"
                onClick={() => handlePeriodChange("daily")}
              >
                Daily
              </Button>
              <Button 
                variant={periodFilter === "weekly" ? "default" : "ghost"} 
                size="sm" 
                className="rounded-full text-sm"
                onClick={() => handlePeriodChange("weekly")}
              >
                Weekly
              </Button>
              <Button 
                variant={periodFilter === "monthly" ? "default" : "ghost"} 
                size="sm" 
                className="rounded-full text-sm"
                onClick={() => handlePeriodChange("monthly")}
              >
                Monthly
              </Button>
            </div>
          </div>
          
          {isLoadingTrending ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : trendingDebates.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {trendingDebates.map((debate: any) => (
                <TrendingDebateCard key={debate.id} debate={debate} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-white rounded-lg border border-dashed border-neutral-200">
              <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-neutral-400" />
              </div>
              <h3 className="text-lg font-medium text-neutral-700 mb-2">No trending debates yet</h3>
              <p className="text-neutral-500 max-w-md mx-auto mb-6">
                Be the first to start a political debate with one of the party bots above!
                Your conversations will appear here for others to see and vote on.
              </p>
              <Button 
                onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
                className="gap-2"
              >
                <ArrowUp className="h-4 w-4" />
                Select a party to debate with
              </Button>
            </div>
          )}
          
          {trendingDebates.length > 0 && (
            <div className="mt-6 text-center">
              <Button variant="outline" className="gap-2">
                <ChevronRight className="h-4 w-4" />
                View all trending debates
              </Button>
            </div>
          )}
        </section>
        
        <MobileNavigation />
      </main>
    </div>
  );
}
