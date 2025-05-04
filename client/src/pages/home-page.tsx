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
        
        <header className="bg-white border-b border-black px-6 py-10 md:py-16">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="md:w-3/4">
              <h1 className="text-3xl md:text-4xl font-bold text-black mb-2">Welcome to Suara.sg</h1>
              <p className="text-black text-lg">
                Step into a new era of civic dialogue. Here, you can challenge ideas, test your reasoning, and engage in meaningful debates with AI-powered fanbots that reflect diverse political perspectives. These bots aren't affiliated with any party—they're here to help you sharpen your views and find your voice.
              </p>
            </div>
            <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-md md:w-1/4 min-w-[220px]">
              <h3 className="text-lg font-semibold italic mb-1">Suara <span className="text-sm font-normal">(noun)</span></h3>
              <p className="text-sm text-neutral-600 mb-1"><span className="font-mono">/ˈsu.a.ra/</span> — Malay</p>
              <ol className="list-decimal pl-5 text-sm space-y-1 text-neutral-700">
                <li>Voice. A means of expression.</li>
                <li>Sound. The audible presence of thought.</li>
                <li>Vote. A choice that shapes the future.</li>
              </ol>
            </div>
          </div>
        </header>
        
        {/* Party Selection Section */}
        <section className="p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Select an Unofficial Fanbot to Debate With</h2>
            <p className="text-black">We're starting with PAP and WP fanbots (not endorsed by actual parties) as they represent the two largest parties in Parliament.</p>
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
        
        {/* Future Features Teaser Section */}
        <section className="bg-neutral-50 border-t border-neutral-200 p-6 md:p-8 mt-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl font-semibold mb-3">The Future of Civic Engagement</h2>
            <p className="text-black mb-4">
              This is just the beginning. We're building a true civic hub that will empower Singaporeans 
              with tools to engage meaningfully in the democratic process. Our mission is to lead 
              Singapore into a future where informed dialogue continues to make our nation exceptional.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="bg-white p-4 rounded-md border border-neutral-200 shadow-sm relative">
                <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-medium">Coming Soon</div>
                <h3 className="font-medium mb-2">Community Forums</h3>
                <p className="text-sm text-neutral-700">Connect with fellow citizens to discuss important national issues</p>
              </div>
              <div className="bg-white p-4 rounded-md border border-neutral-200 shadow-sm relative">
                <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-medium">Coming Soon</div>
                <h3 className="font-medium mb-2">Policy Insights</h3>
                <p className="text-sm text-neutral-700">Deeper analysis of policy impacts across different stakeholder groups</p>
              </div>
              <div className="bg-white p-4 rounded-md border border-neutral-200 shadow-sm relative">
                <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-medium">Coming Soon</div>
                <h3 className="font-medium mb-2">Live Events</h3>
                <p className="text-sm text-neutral-700">Virtual town halls and dialogue sessions with community leaders</p>
              </div>
            </div>
          </div>
        </section>
        
        <MobileNavigation />
      </main>
    </div>
  );
}
