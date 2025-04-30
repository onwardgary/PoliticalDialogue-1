import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import ChatInterface from "@/components/chat/chat-interface";
import ChatInput from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
import { InfoIcon, XIcon, CheckCircle2, Scale, MedalIcon, BrainCircuit } from "lucide-react";
import { Message, DebateSummary as DebateSummaryType } from "@shared/schema";
import DebateSummary from "@/components/debate-summary";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

// Component to display summary generation progress
function SummaryGenerationLoader({ step }: { step: number }) {
  const steps = [
    { id: 1, name: "Analyzing Arguments", icon: BrainCircuit, description: "Identifying key points from both sides" },
    { id: 2, name: "Evaluating Logic", icon: Scale, description: "Assessing the strength of each argument" },
    { id: 3, name: "Determining Outcome", icon: MedalIcon, description: "Deciding on the debate winner" },
    { id: 4, name: "Creating Summary", icon: CheckCircle2, description: "Finalizing the debate summary and recommendations" },
  ];
  
  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold">Generating Debate Summary</h3>
              <p className="text-muted-foreground text-sm">Please wait while we analyze your debate</p>
            </div>
            
            <Progress value={(step / steps.length) * 100} className="h-2 mb-8" />
            
            <div className="space-y-4">
              {steps.map((s) => {
                const Icon = s.icon;
                const isActive = s.id === step;
                const isCompleted = s.id < step;
                
                return (
                  <div 
                    key={s.id} 
                    className={`flex items-center p-3 rounded-lg transition-all ${
                      isActive 
                        ? "bg-primary/10 border border-primary/20" 
                        : isCompleted 
                          ? "bg-green-50 border border-green-100"
                          : "bg-neutral-50 border border-neutral-100"
                    }`}
                  >
                    <div 
                      className={`rounded-full p-2 mr-3 ${
                        isActive 
                          ? "bg-primary/20 text-primary" 
                          : isCompleted 
                            ? "bg-green-100 text-green-700"
                            : "bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={`font-medium ${
                        isActive 
                          ? "text-primary" 
                          : isCompleted 
                            ? "text-green-700"
                            : "text-neutral-500"
                      }`}>
                        {s.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                    {isActive && (
                      <div className="ml-auto">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    )}
                    {isCompleted && (
                      <div className="ml-auto">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DebatePage() {
  const { id } = useParams();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [summaryGenerationStep, setSummaryGenerationStep] = useState<number | null>(null);
  
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
      console.log("Message sent successfully:", data);
      
      // The server now responds with just the userMessage (no assistantMessage yet)
      // The assistantMessage will be fetched when the server finishes processing
      
      // Replace the temporary message with the official user message from the server
      queryClient.setQueryData([`/api/debates/${id}`], (old: any) => {
        if (!old) {
          console.log("No existing debate data to update");
          return old;
        }
        
        // Filter out the temporary message we added and use the confirmed message from server
        const filteredMessages = old.messages.filter((msg: Message) => !msg.id.startsWith('temp-'));
        
        // Only add the userMessage - the AI response will come later through polling
        const updatedMessages = [...filteredMessages, data.userMessage];
        console.log("Confirmed user message in place, waiting for AI response...");
        
        return {
          ...old,
          messages: updatedMessages,
          updatedAt: new Date().toISOString(),
        };
      });
      
      // Start polling more frequently for a short time to get the AI response quickly
      let pollCount = 0;
      const pollInterval = setInterval(() => {
        pollCount++;
        if (pollCount <= 30) { // Poll for 30 seconds max
          console.log("Polling for AI response...");
          queryClient.invalidateQueries({ queryKey: [`/api/debates/${id}`] });
        } else {
          clearInterval(pollInterval);
        }
      }, 1000);
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      
      // Show error toast to the user
      toast({
        title: "Message failed to send",
        description: "There was a problem sending your message. Please try again.",
        variant: "destructive",
      });
      
      // Remove the temporary message from the UI
      queryClient.setQueryData([`/api/debates/${id}`], (old: any) => {
        if (!old) return old;
        
        // Filter out any temporary messages
        const filteredMessages = old.messages.filter((msg: Message) => !msg.id.startsWith('temp-'));
        
        return {
          ...old,
          messages: filteredMessages,
        };
      });
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
      // Reset the summary generation step when summary is complete
      setSummaryGenerationStep(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to generate summary",
        description: "There was a problem generating the debate summary. Please try again.",
        variant: "destructive",
      });
      setSummaryGenerationStep(null);
    },
  });
  
  const handleSendMessage = (content: string) => {
    if (debate?.completed) return;
    
    // Generate a consistent ID for the temporary message
    const tempId = `temp-${Date.now()}`;
    
    // Create temporary user message and add it to the UI immediately
    const tempUserMessage: Message = {
      id: tempId,
      role: "user",
      content: content,
      timestamp: Date.now()
    };
    
    console.log("Adding temporary message to UI:", tempUserMessage);
    
    // Update local state to show the message right away
    // This ensures the message appears in the UI before any network request
    queryClient.setQueryData([`/api/debates/${id}`], (old: any) => {
      if (!old) return old;
      
      const updatedMessages = [...old.messages, tempUserMessage];
      console.log("Updated messages count:", updatedMessages.length);
      
      return {
        ...old,
        messages: updatedMessages,
      };
    });
    
    // Immediate UI update, no delay needed
    // The React Query cache is already updated and should reflect in the UI
    
    // Then send to the API
    sendMessageMutation.mutate(content);
  };
  
  const handleEndDebate = () => {
    // Start the progress animation
    setSummaryGenerationStep(1);
    
    // Simulate progress steps (the actual generation will take several seconds)
    const totalSteps = 4;
    const stepInterval = 1000; // 1 second between steps
    
    for (let step = 2; step <= totalSteps; step++) {
      setTimeout(() => {
        setSummaryGenerationStep(step);
      }, stepInterval * (step - 1));
    }
    
    // Start the actual summary generation
    endDebateMutation.mutate();
  };
  
  const isLoading = isLoadingDebate || isLoadingParty;
  const isSendingMessage = sendMessageMutation.isPending;
  const isEndingDebate = endDebateMutation.isPending;
  
  // Get current user
  const { user } = useAuth();
  
  // Redirect if debate doesn't exist or user doesn't own it
  useEffect(() => {
    if (!isLoading && (!debate || (debate && user && debate.userId !== user.id))) {
      toast({
        title: "Access denied",
        description: "You can only view your own debates.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [isLoading, debate, user, setLocation, toast]);
  
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
      
      <main className="flex-1 flex flex-col h-screen pb-[60px] md:pb-0">
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
        ) : summaryGenerationStep ? (
          // Show the summary generation loading UI when generating summary
          <div className="flex-1 overflow-auto bg-neutral-50">
            <SummaryGenerationLoader step={summaryGenerationStep} />
          </div>
        ) : (
          <>
            <ChatInterface 
              messages={debate?.messages || []}
              isLoading={isSendingMessage}
              onSendMessage={handleSendMessage}
              partyShortName={party?.shortName}
              userTyping={isUserTyping}
            />
            <ChatInput 
              onSendMessage={handleSendMessage}
              isLoading={isSendingMessage}
              onTypingStateChange={setIsUserTyping}
            />
          </>
        )}
        
        <MobileNavigation />
      </main>
    </div>
  );
}
