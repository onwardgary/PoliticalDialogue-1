import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, ChevronRight, BarChart, ArrowRight, Award, Lightbulb } from "lucide-react";
import { format } from "date-fns";

interface Party {
  id: number;
  name: string;
  shortName: string;
  color: string;
  description: string;
}

interface Recommendation {
  id: number;
  partyId: number;
  partyShortName: string;
  topic: string;
  recommendations: string[];
  outcome: string;
  updatedAt: Date;
}

interface TrendingDebate {
  id: number;
  partyId: number;
  partyShortName: string;
  topic: string;
  totalDebates: number;
  partyVotes: number;
  citizenVotes: number;
  updatedAt: Date;
}

// Simple trending debate card component
function TrendingDebateCard({ debate }: { debate: TrendingDebate }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold">{debate.topic || "General Discussion"}</h3>
            <p className="text-sm text-neutral-600 mt-1">
              <Badge variant="outline" className="mr-2">{debate.partyShortName}</Badge>
              <span className="text-xs">{debate.totalDebates} debates</span>
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex space-x-4 text-sm">
              <div className="flex items-center">
                <Badge variant="secondary" className="font-medium">{debate.partyVotes} party wins</Badge>
              </div>
              <div className="flex items-center">
                <Badge variant="outline" className="font-medium">{debate.citizenVotes} citizen wins</Badge>
              </div>
            </div>
            <span className="text-xs text-neutral-400 mt-1">
              {debate.updatedAt ? format(debate.updatedAt, 'MMM d, yyyy') : 'Recent'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TrendingPage() {
  const [periodFilter, setPeriodFilter] = useState("weekly");
  const [activeTab, setActiveTab] = useState("stats");
  const [selectedParty, setSelectedParty] = useState<number | null>(null);
  
  // Fetch political parties for reference
  const { data: parties = [] } = useQuery<Party[]>({
    queryKey: ["/api/parties"],
    refetchOnWindowFocus: false,
  });
  
  // Fetch trending topics
  const { data: trendingTopics = [], isLoading: isLoadingTrending } = useQuery({
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
  
  // Fetch completed debates to extract action recommendations
  const { data: completedDebates = [], isLoading: isLoadingDebates } = useQuery({
    queryKey: ["/api/debates/completed"],
    queryFn: async () => {
      const response = await fetch("/api/debates/completed?limit=30");
      if (!response.ok) {
        throw new Error("Failed to fetch completed debates");
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
  });
  
  // Process trending data for display
  const trendingDebates: TrendingDebate[] = trendingTopics.map((summary: any) => ({
    id: summary.id,
    partyId: summary.partyId,
    partyShortName: parties.find((p) => p.id === summary.partyId)?.shortName || "PAP",
    topic: summary.topic,
    totalDebates: summary.totalDebates,
    partyVotes: summary.partyVotes,
    citizenVotes: summary.citizenVotes,
    updatedAt: new Date(summary.date)
  }));
  
  // Extract recommendations from completed debates
  const recommendations: Recommendation[] = completedDebates
    .map((debate: any) => {
      // Only include debates with recommendations
      if (!debate.summary?.conclusion?.actionRecommendations) return null;
      
      return {
        id: debate.id,
        partyId: debate.partyId,
        partyShortName: parties.find((p) => p.id === debate.partyId)?.shortName || "Unknown",
        topic: debate.topic || "General Discussion",
        recommendations: debate.summary.conclusion.actionRecommendations || [],
        outcome: debate.summary.conclusion.outcome || "party",
        updatedAt: new Date(debate.updatedAt)
      };
    })
    .filter(Boolean) as Recommendation[];
  
  const handlePeriodChange = (period: string) => {
    setPeriodFilter(period);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-screen">
        <MobileHeader />
        
        <header className="bg-white border-b border-neutral-200 p-4">
          <h1 className="text-2xl font-bold">Trending</h1>
          <p className="text-neutral-600">View party statistics and debate recommendations</p>
        </header>
        
        {/* Tabs for switching between stats and recommendations */}
        <div className="p-6 pb-3">
          <Tabs 
            defaultValue={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="stats" className="flex items-center">
                <BarChart className="mr-2 h-4 w-4" />
                Party Statistics
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="flex items-center">
                <Lightbulb className="mr-2 h-4 w-4" />
                Recent Recommendations
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="stats">
              {/* Period Filter */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Party Statistics</h2>
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
              
              {/* Trending Debates */}
              <div className="mb-6">
                {isLoadingTrending ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : trendingDebates.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {trendingDebates.map((debate) => (
                      <TrendingDebateCard key={debate.id} debate={debate} />
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <Card>
                      <CardContent className="pt-6 pb-6">
                        <h3 className="font-medium text-lg mb-2">No trending debates yet</h3>
                        <p className="text-neutral-500 mb-4">There aren't any trending debates for this period yet.</p>
                        <Link href="/">
                          <Button>Start a Debate</Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
              
              {/* Party Statistics */}
              <div className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {parties.map((party) => {
                    // Calculate total debates and votes for this party
                    const partyDebates = trendingDebates.filter(d => d.partyId === party.id);
                    const totalDebates = partyDebates.reduce((sum, d) => sum + d.totalDebates, 0);
                    const partyVotes = partyDebates.reduce((sum, d) => sum + d.partyVotes, 0);
                    const citizenVotes = partyDebates.reduce((sum, d) => sum + d.citizenVotes, 0);
                    const totalVotes = partyVotes + citizenVotes;
                    const partyWinRate = totalVotes > 0 ? Math.round((partyVotes / totalVotes) * 100) : 0;
                    
                    // Get background and text color based on party shortName
                    const getBgColor = () => {
                      switch (party.shortName) {
                        case "PAP": return "bg-white";
                        case "WP": return "bg-blue-100";
                        case "PSP": return "bg-red-100";
                        default: return "bg-white";
                      }
                    };
                    
                    const getTextColor = () => {
                      switch (party.shortName) {
                        case "PAP": return "text-primary";
                        case "WP": return "text-blue-700";
                        case "PSP": return "text-red-700";
                        default: return "text-primary";
                      }
                    };
                    
                    return (
                      <Card key={party.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center mb-3">
                            <div className={`w-10 h-10 ${getBgColor()} rounded-full flex items-center justify-center mr-3 border border-neutral-200`}>
                              <span className={`${getTextColor()} font-bold text-sm`}>{party.shortName}</span>
                            </div>
                            <div>
                              <h3 className="font-semibold">{party.name}</h3>
                              <p className="text-xs text-neutral-500">{totalDebates} total debates</p>
                            </div>
                          </div>
                          
                          <div className="mt-2">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-neutral-600">Win rate:</span>
                              <span className="font-medium">{partyWinRate}%</span>
                            </div>
                            <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                              <div 
                                className="bg-primary h-full" 
                                style={{ width: `${partyWinRate}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                            <div className="bg-neutral-100 p-2 rounded-md">
                              <p className="text-xs text-neutral-500">Party Votes</p>
                              <p className="font-medium">{partyVotes}</p>
                            </div>
                            <div className="bg-neutral-100 p-2 rounded-md">
                              <p className="text-xs text-neutral-500">Citizen Votes</p>
                              <p className="font-medium">{citizenVotes}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="recommendations">
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-4">Recent Recommendations</h2>
                
                {isLoadingDebates ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : recommendations.length > 0 ? (
                  <div>
                    {/* Party filter buttons */}
                    <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-2">
                      <Button
                        variant={selectedParty === null ? "default" : "outline"}
                        size="sm"
                        className="rounded-full"
                        onClick={() => setSelectedParty(null)}
                      >
                        All Parties
                      </Button>
                      
                      {parties.map((party) => (
                        <Button
                          key={party.id}
                          variant={selectedParty === party.id ? "default" : "outline"}
                          size="sm"
                          className="rounded-full whitespace-nowrap"
                          onClick={() => setSelectedParty(party.id)}
                        >
                          {party.shortName}
                        </Button>
                      ))}
                    </div>
                    
                    {/* Recommendations list */}
                    <div className="space-y-4">
                      {recommendations
                        .filter(rec => selectedParty === null || rec.partyId === selectedParty)
                        .slice(0, 10) // Show only 10 most recent recommendations
                        .map((rec) => (
                          <Card key={`${rec.id}-${rec.recommendations.length}`} className="overflow-hidden">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <Badge className="mr-2">{rec.partyShortName}</Badge>
                                  <CardTitle className="text-base">{rec.topic}</CardTitle>
                                </div>
                                <Badge variant={rec.outcome === "party" ? "default" : "outline"}>
                                  {rec.outcome === "party" ? "Party Win" : "Citizen Win"}
                                </Badge>
                              </div>
                              <CardDescription className="text-xs flex items-center mt-1">
                                <Clock className="h-3 w-3 mr-1" />
                                {format(rec.updatedAt, 'MMM d, yyyy')}
                              </CardDescription>
                            </CardHeader>
                            
                            <CardContent className="pt-0">
                              <h4 className="text-sm font-medium mb-2 flex items-center">
                                <Lightbulb className="h-4 w-4 mr-1 text-amber-500" />
                                Recommendations
                              </h4>
                              <ul className="space-y-2">
                                {rec.recommendations.map((r, idx) => (
                                  <li key={idx} className="text-sm flex">
                                    <ArrowRight className="h-4 w-4 mr-2 text-neutral-400 flex-shrink-0 mt-0.5" />
                                    <span>{r}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                            
                            <CardFooter className="pt-0 pb-3">
                              <Link href={`/summary/${rec.id}`} className="text-xs text-primary hover:underline flex items-center">
                                View full debate summary
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </Link>
                            </CardFooter>
                          </Card>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <Card>
                      <CardContent className="pt-6 pb-6">
                        <h3 className="font-medium text-lg mb-2">No recommendations yet</h3>
                        <p className="text-neutral-500 mb-4">Complete debates to see recommendations appear here.</p>
                        <Link href="/">
                          <Button>Start a Debate</Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <MobileNavigation />
      </main>
    </div>
  );
}