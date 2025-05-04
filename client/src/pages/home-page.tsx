import { useQuery } from "@tanstack/react-query";
import PartyCard from "@/components/party-card";
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare } from "lucide-react";
import { Party } from "@/components/party-card";

export default function HomePage() {
  // Fetch political parties
  const { data: parties = [], isLoading: isLoadingParties } = useQuery<Party[]>({
    queryKey: ["/api/parties"],
    refetchOnWindowFocus: false,
  });

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-screen">
        <MobileHeader />
        
        <header className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-neutral-200 px-6 py-10 md:py-16">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 text-transparent bg-clip-text mb-2">Welcome to Suara.sg</h1>
          <p className="text-neutral-600 text-lg md:w-3/4 lg:w-2/3">
            Engage in meaningful debates with <strong>unofficial AI-powered fanbots</strong> that represent 
            different policy perspectives. These bots are not endorsed by or affiliated with any political parties.
          </p>
        </header>
        
        {/* Party Selection Section */}
        <section className="p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Select an Unofficial Fanbot to Debate With</h2>
            <p className="text-neutral-500">These are <span className="font-bold">unofficial fanbots</span> (not endorsed by actual parties) that present perspectives aligned with different political positions</p>
          </div>
          
          {isLoadingParties ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 mb-8">
              {parties
                .filter(party => party.shortName !== "PSP") // Filter out PSP
                .map((party) => (
                  <PartyCard key={party.id} party={party} />
                ))
              }
            </div>
          )}
        </section>
        
        {/* Trending Debates Section - temporarily hidden */}
        
        <MobileNavigation />
      </main>
    </div>
  );
}
