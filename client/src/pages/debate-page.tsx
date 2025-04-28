import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import ChatInterface from "@/components/chat/chat-interface";
import ChatInput from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { InfoIcon, XIcon } from "lucide-react";
import { Message, DebateSummary as DebateSummaryType } from "@shared/schema";
import DebateSummary from "@/components/debate-summary";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

export default function DebatePage() {
  const { id } = useParams();
  const [_, setLocation] = useLocation();
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  
  // Fetch debate data
  const { data: debate, isLoading: isLoadingDebate } = useQuery({
    queryKey: [`/api/debates/${id}`],
    queryFn: async () => {
      console.log("Fetching debate data for ID:", id);
      const response = await fetch(`/api/debates/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch debate");
      }
      const data = await response.json();
      console.log("Fetched debate data:", data);
      console.log("Message count:", data.messages.length);
      return data;
    },
    refetchOnWindowFocus: true,
    refetchInterval: 3000, // Poll every 3 seconds to ensure we get the latest messages
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
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      console.log("Sending message to debate", id, ":", content);
      const res = await apiRequest("POST", `/api/debates/${id}/messages`, { content });
      const data = await res.json();
      console.log("Response received:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("Updating UI with new messages:", data);
      
      // Force refetch debate data
      queryClient.invalidateQueries({ queryKey: [`/api/debates/${id}`] });
      
      // Direct update of cache
      queryClient.setQueryData([`/api/debates/${id}`], (old: any) => {
        if (!old) {
          console.log("No existing debate data to update");
          return old;
        }
        console.log("Existing messages:", old.messages.length);
        return {
          ...old,
          messages: [...old.messages, data.userMessage, data.assistantMessage],
          updatedAt: new Date().toISOString(),
        };
      });
    },
    onError: (error) => {
      console.error("Error sending message:", error);
    }
  });
  
  // End debate mutation
  const endDebateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/debates/${id}/end`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/debates/${id}`], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          summary: data.summary,
          completed: true,
          updatedAt: new Date().toISOString(),
        };
      });
      setIsEndDialogOpen(false);
    },
  });
  
  const handleSendMessage = (content: string) => {
    if (debate?.completed) return;
    sendMessageMutation.mutate(content);
  };
  
  const handleEndDebate = () => {
    endDebateMutation.mutate();
  };
  
  const isLoading = isLoadingDebate || isLoadingParty;
  const isSendingMessage = sendMessageMutation.isPending;
  const isEndingDebate = endDebateMutation.isPending;
  
  // If there's no ongoing debate, redirect to home
  useEffect(() => {
    if (!isLoading && !debate) {
      setLocation("/");
    }
  }, [isLoading, debate, setLocation]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1 md:ml-64 flex flex-col h-screen">
        <MobileHeader />
        
        {/* Debate header */}
        <div className="bg-white border-b border-neutral-200 p-4 flex items-center">
          <div className={`w-10 h-10 bg-white rounded-full flex items-center justify-center mr-3 border border-neutral-200 ${party?.color ? `text-[${party.color}]` : 'text-primary'}`}>
            <span className="font-bold text-sm">{party?.shortName}</span>
          </div>
          <div>
            <h2 className="font-semibold">Debating with {party?.shortName} Bot</h2>
            <p className="text-xs text-neutral-500">{party?.name} positions on policies</p>
          </div>
          <div className="ml-auto flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-sm border border-neutral-200 rounded-lg hover:bg-neutral-100"
            >
              <InfoIcon className="h-4 w-4 mr-1" /> Help
            </Button>
            
            <AlertDialog open={isEndDialogOpen} onOpenChange={setIsEndDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-sm border border-neutral-200 rounded-lg hover:bg-neutral-100 text-red-500"
                  disabled={debate?.completed || isEndingDebate}
                >
                  <XIcon className="h-4 w-4 mr-1" /> End Debate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End this debate?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will generate a summary of your debate with {party?.name} Bot. 
                    You won't be able to continue this conversation, but you can start a new one.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleEndDebate}
                    disabled={isEndingDebate}
                  >
                    {isEndingDebate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    End Debate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        {debate?.completed ? (
          <div className="flex-1 overflow-auto p-6 bg-neutral-50">
            <DebateSummary 
              debateId={parseInt(id || "0")}
              summary={debate.summary as DebateSummaryType}
              partyName={party?.name || "Party"}
              partyShortName={party?.shortName || "BOT"}
            />
            
            <div className="text-center">
              <Button 
                onClick={() => setLocation("/")}
                variant="outline"
              >
                Start a New Debate
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ChatInterface 
              messages={debate?.messages || []}
              isLoading={isSendingMessage}
            />
            <ChatInput 
              onSendMessage={handleSendMessage}
              isLoading={isSendingMessage}
            />
          </>
        )}
        
        <MobileNavigation />
      </main>
    </div>
  );
}
