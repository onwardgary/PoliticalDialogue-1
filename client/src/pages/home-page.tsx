import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PartyCard from "@/components/party-card";
import TrendingDebateCard from "@/components/trending-debate-card";
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

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
      
      <main className="flex-1 md:ml-64">
        <MobileHeader />
        
        <header className="bg-white border-b border-neutral-200 p-4">
          <h1 className="text-2xl font-bold">Welcome to Suara.sg</h1>
          <p className="text-neutral-600">Debate political party positions with AI and vote on summaries</p>
        </header>
        
        {/* Party Selection Section */}
        <section className="p-6">
          <h2 className="text-xl font-semibold mb-4">Select a party to debate with</h2>
          
          {isLoadingParties ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {parties?.map((party: any) => (
                <PartyCard key={party.id} party={party} />
              ))}
            </div>
          )}
        </section>
        
        {/* Trending Debates Section */}
        <section className="p-6 bg-neutral-50">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Trending Debates</h2>
            <div className="flex space-x-2">
              <Button 
                variant={periodFilter === "daily" ? "default" : "outline"} 
                size="sm" 
                className="rounded-full"
                onClick={() => handlePeriodChange("daily")}
              >
                Daily
              </Button>
              <Button 
                variant={periodFilter === "weekly" ? "default" : "outline"} 
                size="sm" 
                className="rounded-full"
                onClick={() => handlePeriodChange("weekly")}
              >
                Weekly
              </Button>
              <Button 
                variant={periodFilter === "monthly" ? "default" : "outline"} 
                size="sm" 
                className="rounded-full"
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {trendingDebates.map((debate: any) => (
                <TrendingDebateCard key={debate.id} debate={debate} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-neutral-500">No trending debates available for this period.</p>
              <p className="text-sm text-neutral-400 mt-2">Start a debate to be the first!</p>
            </div>
          )}
          
          {trendingDebates.length > 0 && (
            <div className="mt-4 text-center">
              <Button variant="link" className="text-primary font-medium">
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
