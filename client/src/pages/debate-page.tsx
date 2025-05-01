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
  // Extract parameters from the URL - could be either regular ID or secure ID
  const params = useParams();
  const id = params.id;
  const secureId = params.secureId;
  
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [summaryGenerationStep, setSummaryGenerationStep] = useState<number | null>(null);
  
  // Add a local cache of messages for immediate updates
  // This bypasses React Query's asynchronous cache updates
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  
  // NEW: Add a simple view state to control what's rendered
  // This creates a clear state machine that prevents race conditions
  const [viewState, setViewState] = useState<'loading' | 'chat' | 'generating' | 'summary'>('loading');
  
  // Track message sending state and other UI states
  const [messageStatus, setMessageStatus] = useState({
    sending: false,
    polling: false
  });
  
  // NOTE: We've removed round extension functionality
  // No more isExtendingRounds or showInlineExtensionOptions state variables
  
  // We've removed the ability to extend rounds after initial selection
  
  // Determine which API endpoint to use based on which parameter is available
  const apiEndpoint = secureId 
    ? `/api/debates/s/${secureId}` 
    : `/api/debates/${id}`;
  
  // Fetch debate data with adaptive polling for improved responsiveness
  const { data: debate, isLoading: isLoadingDebate } = useQuery({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      console.log("Fetching debate data from:", apiEndpoint);
      const response = await fetch(apiEndpoint, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        // Add priority hints for faster performance
        priority: 'high'
      } as RequestInit);
      
      if (!response.ok) {
        throw new Error("Failed to fetch debate");
      }
      const data = await response.json();
      console.log("Fetched debate data:", data);
      console.log("Message count:", data.messages.length);
      
      // Update local messages whenever we get new data from server
      // IMPORTANT FIX: Don't set local messages if the debate is already completed
      // This prevents temporarily showing messages when transitioning to summary view
      if (data.messages) {
        if (!data.completed) {
          // Only update local messages for active debates
          setLocalMessages(data.messages);
        } else {
          // For completed debates, clear local messages to avoid showing
          // chat history temporarily before displaying the summary
          setLocalMessages([]);
        }
      }
      
      return data;
    },
    refetchOnWindowFocus: true,
    // Adaptive polling strategy based on conversation state
    refetchInterval: (data: any) => {
      // If debate is completed, stop polling entirely
      if (data?.completed) return false;
      
      const messages = data?.messages || [];
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      
      // If last message is from user (waiting for AI response), poll more frequently
      if (lastMessage?.role === 'user') {
        return 1000; // Poll every 1 second while waiting for AI response
      }
      
      // If conversation is active (within last minute), poll regularly
      const lastMessageTime = lastMessage?.timestamp || 0;
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage < 60000) { // Less than a minute
        return 3000; // Poll every 3 seconds for active conversations
      }
      
      // Otherwise, reduce polling frequency to save resources
      return 10000; // Poll every 10 seconds for inactive conversations
    },
    enabled: !!(id || secureId) && !messageStatus.sending, // Don't poll while sending a message
  });
  
  // Fetch party data with optimized caching
  const { data: party, isLoading: isLoadingParty } = useQuery({
    queryKey: ["/api/parties", debate?.partyId],
    queryFn: async () => {
      if (!debate) return null;
      
      // Use cache-optimized fetch
      const response = await fetch("/api/parties", {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        // Add priority hints but lower than debate data
        priority: 'auto'
      } as RequestInit);
      
      if (!response.ok) {
        throw new Error("Failed to fetch parties");
      }
      
      const parties = await response.json();
      return parties.find((p: any) => p.id === debate.partyId);
    },
    enabled: !!debate,
    refetchOnWindowFocus: false,
    staleTime: 24 * 60 * 60 * 1000, // Party data is static, cache for 24 hours
    gcTime: 24 * 60 * 60 * 1000,  // Keep in cache for 24 hours (renamed from cacheTime in v5)
  });
  
  // Determine the message endpoint based on which parameter is available
  const messageEndpoint = secureId
    ? `/api/debates/s/${secureId}/messages`
    : `/api/debates/${id}/messages`;
    
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      // Update message status to sending
      setMessageStatus(prev => ({ ...prev, sending: true }));
      const targetId = secureId || id;
      console.log("Sending message to debate", targetId, ":", content);
      const res = await apiRequest("POST", messageEndpoint, { content });
      const data = await res.json();
      console.log("Response received:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("Message sent successfully:", data);
      
      // Update message status
      setMessageStatus(prev => ({ ...prev, sending: false, polling: true }));
      
      // Update local state directly - replace temp message with confirmed one
      setLocalMessages(prev => {
        const updatedMessages = prev.map((msg: Message) => {
          // If it's a temporary message, replace it with the confirmed one from server
          if (msg.id.startsWith('temp-')) {
            return data.userMessage;
          }
          return msg;
        });
        return updatedMessages;
      });
      
      // Also update the React Query cache for consistency
      queryClient.setQueryData([apiEndpoint], (old: any) => {
        if (!old) return old;
        
        const updatedMessages = old.messages.map((msg: Message) => {
          if (msg.id.startsWith('temp-')) {
            return data.userMessage;
          }
          return msg;
        });
        
        return {
          ...old,
          messages: updatedMessages,
          updatedAt: new Date().toISOString(),
        };
      });
      
      console.log("Confirmed user message in place, waiting for AI response...");
      
      // Start adaptive polling for AI response
      let pollCount = 0;
      let currentDelay = 1000; // Start with 1s polling delay
      let hasReceivedResponse = false;
      
      const pollInterval = setInterval(() => {
        pollCount++;
        
        if (pollCount <= 30 && !hasReceivedResponse) {
          console.log("Polling for AI response...");
          
          // Use direct fetch instead of React Query for more control
          fetch(apiEndpoint, {
            headers: { 'Cache-Control': 'no-cache' }
          })
          .then(response => response.json())
          .then(fetchedData => {
            // Count messages to see if new ones arrived
            const currentMessageCount = fetchedData?.messages?.length || 0;
            const currentLocalCount = localMessages.length;
            
            // If we have new messages, update UI
            if (currentMessageCount > currentLocalCount) {
              console.log("AI response received, updating UI directly");
              hasReceivedResponse = true;
              
              // Get the latest AI message
              const latestAIMessage = fetchedData.messages[fetchedData.messages.length - 1];
              
              // Update local state directly - replace typing indicator with AI response
              setLocalMessages(prev => {
                // Remove any typing indicators
                const messagesWithoutTyping = prev.filter(msg => !msg.id.startsWith('typing-'));
                // Add the new AI message
                return [...messagesWithoutTyping, latestAIMessage];
              });
              
              // Clear polling since we got our response
              clearInterval(pollInterval);
              setMessageStatus(prev => ({ ...prev, polling: false }));
              
              // Also update React Query cache
              queryClient.setQueryData([apiEndpoint], fetchedData);
            }
          })
          .catch(error => {
            console.error("Error polling for response:", error);
          });
          
          // Gradually increase polling delay after the first few attempts
          if (pollCount > 5) {
            currentDelay = Math.min(currentDelay * 1.2, 3000); // Increase delay up to 3s max
          }
        } else {
          clearInterval(pollInterval);
          setMessageStatus(prev => ({ ...prev, polling: false }));
        }
      }, currentDelay);
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      
      // Reset message status on error
      setMessageStatus(prev => ({ ...prev, sending: false, polling: false }));
      
      // Show error toast to the user
      toast({
        title: "Message failed to send",
        description: "There was a problem sending your message. Please try again.",
        variant: "destructive",
      });
      
      // Mark failed messages directly in local state
      setLocalMessages(prev => {
        return prev.map(msg => {
          if (msg.id.startsWith('temp-') && !msg.content.includes('(Failed to send)')) {
            return {
              ...msg,
              content: `${msg.content} (Failed to send)`,
            };
          }
          return msg;
        });
      });
      
      // Also update React Query cache for consistency
      queryClient.setQueryData([apiEndpoint], (old: any) => {
        if (!old) return old;
        
        // Mark temporary messages as failed by appending "(Failed to send)" to content
        const updatedMessages = old.messages.map((msg: Message) => {
          if (msg.id.startsWith('temp-') && !msg.content.includes('(Failed to send)')) {
            return {
              ...msg,
              content: `${msg.content} (Failed to send)`,
            };
          }
          return msg;
        });
        
        return {
          ...old,
          messages: updatedMessages,
        };
      });
    }
  });
  
  // Determine the end debate endpoint based on which parameter is available
  const endDebateEndpoint = secureId
    ? `/api/debates/s/${secureId}/end`
    : `/api/debates/${id}/end`;
    
  // Debate round extension endpoint
  const extendRoundsEndpoint = secureId
    ? `/api/debates/s/${secureId}/extend`
    : `/api/debates/${id}/extend`;
    
  // Extend debate rounds mutation
  const extendRoundsMutation = useMutation({
    mutationFn: async (maxRounds: number) => {
      setIsExtendingRounds(true);
      console.log(`Extending debate to ${maxRounds} rounds`);
      const res = await apiRequest("PATCH", extendRoundsEndpoint, { maxRounds });
      return res.json();
    },
    onSuccess: (data) => {
      console.log("Debate rounds extended successfully:", data);
      
      // IMMEDIATELY reset extending state to hide dialog
      setIsExtendingRounds(false);
      setShowInlineExtensionOptions(false);
      
      // Update React Query cache with the new maxRounds value
      queryClient.setQueryData([apiEndpoint], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          maxRounds: data.maxRounds,
          updatedAt: new Date().toISOString(),
        };
      });
      
      // Log that we're forcing dialog close
      console.log("🛑 FORCING HIDE of inline extension options after extension");
      
      // Show success toast
      toast({
        title: "Debate extended",
        description: `You now have ${data.maxRounds} rounds for this debate.`,
      });
      
      // Force refetch debate data to ensure UI is updated correctly
      queryClient.invalidateQueries({queryKey: [apiEndpoint]});
      
      // Clear extension state
      setIsExtendingRounds(false);
    },
    onError: (error: any) => {
      console.error("Error extending debate rounds:", error);
      
      // Get API error message if available
      let errorMessage = "There was a problem extending the debate.";
      try {
        if (error.response && error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (typeof error.message === 'string') {
          errorMessage = error.message;
        }
      } catch (e) {
        console.error("Error processing API error:", e);
      }
      
      // Show detailed error toast
      toast({
        title: "Failed to extend debate",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Clear extension state
      setIsExtendingRounds(false);
    }
  });
  
  // End debate mutation
  const endDebateMutation = useMutation({
    mutationFn: async () => {
      // Determine the mode based on the debate topic
      let mode = "debate"; // Default mode
      
      if (debate?.topic) {
        // If topic contains "discussion" or "recommendations", use "discuss" mode
        if (debate.topic.toLowerCase().includes("discussion") || 
            debate.topic.toLowerCase().includes("recommendations")) {
          mode = "discuss";
        }
      }
      
      console.log(`Ending debate with mode: ${mode}`);
      
      // Pass the mode parameter to the end debate endpoint
      const res = await apiRequest("POST", endDebateEndpoint, { mode });
      return res.json();
    },
    onSuccess: (data) => {
      // Close the dialog
      setIsEndDialogOpen(false);
      
      // Update React Query cache
      queryClient.setQueryData([apiEndpoint], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          summary: data.summary,
          completed: true,
          updatedAt: new Date().toISOString(),
        };
      });
      
      // Directly navigate to summary page as soon as the summary is generated
      // This is the most direct path to showing the summary
      console.log("Summary generated! Navigating directly to summary page");
      // Use secure ID for navigation if available
      if (secureId) {
        setLocation(`/summary/s/${secureId}`);
      } else {
        setLocation(`/summary/${id}`);
      }
      
      // Reset the animation steps
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
  
  // Custom solution for absolutely no delay in message display
  const handleSendMessage = (content: string) => {
    if (debate?.completed) return;
    
    // Generate a consistent ID for the temporary message
    const tempId = `temp-${Date.now()}`;
    
    // STEP 1: Create temporary user message
    const tempUserMessage: Message = {
      id: tempId,
      role: "user",
      content: content,
      timestamp: Date.now()
    };
    
    console.log("ULTRA-FAST: Adding message to UI:", tempUserMessage);
    
    // DIRECT STATE UPDATE: Update local messages state synchronously
    // No waiting for React Query at all - this forces an instant render
    if (debate?.messages) {
      setLocalMessages([...debate.messages, tempUserMessage]);
    } else {
      setLocalMessages([tempUserMessage]);
    }
    
    // Also update React Query cache (but this is secondary, UI already updated)
    queryClient.setQueryData([apiEndpoint], (old: any) => {
      if (!old) return { 
        id: parseInt(id || "0"),
        secureId: secureId || "",
        messages: [tempUserMessage],
        userId: 1,
        partyId: 1
      };
      
      return {
        ...old,
        messages: [...old.messages, tempUserMessage],
      };
    });
    
    // STEP 2: Start sending the API request in the background
    sendMessageMutation.mutate(content);
    
    // STEP 3: Show typing indicator after a short delay
    setTimeout(() => {
      const typingIndicatorId = `typing-${Date.now()}`;
      const typingIndicatorMessage: Message = {
        id: typingIndicatorId,
        role: "assistant",
        content: "...",
        timestamp: Date.now()
      };
      
      // Add typing indicator DIRECTLY to local state 
      // This ensures it appears instantly
      setLocalMessages(prevMessages => [...prevMessages, typingIndicatorMessage]);
      
    }, 800); // Small thinking delay before typing indicator (800ms)
  };
  
  const handleEndDebate = () => {
    // Immediately change view state to generating
    // This guarantees messages are hidden before any other changes occur
    setViewState('generating');
    
    // Clear local messages as an extra safeguard
    setLocalMessages([]);
    
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
  const isEndingDebate = endDebateMutation.isPending;
  
  // Get current user
  const { user } = useAuth();
  
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
  
  // NEW SOLUTION: Redirect to dedicated summary page when debate is completed
  // This completely avoids any state transition issues
  useEffect(() => {
    if (!isLoadingDebate && debate?.completed) {
      console.log("Debate completion detected - REDIRECTING TO SUMMARY PAGE");
      // Use secure ID for navigation if available
      if (secureId) {
        setLocation(`/summary/s/${secureId}`);
      } else {
        setLocation(`/summary/${id}`);
      }
    } else if (isLoadingDebate) {
      setViewState('loading');
    } else if (summaryGenerationStep !== null) {
      setViewState('generating');
    } else {
      setViewState('chat');
    }
  }, [isLoadingDebate, debate?.completed, summaryGenerationStep, setLocation, id, secureId]);
  
  // Effect to manage inline extension options
  useEffect(() => {
    if (!debate) return;
    
    // Calculate current round based on user messages
    const userMessages = debate.messages.filter((msg: Message) => msg.role === 'user');
    const currentRound = userMessages.length;
    const maxRounds = debate.maxRounds || 6;
    
    // Check if last message is from user
    const lastMessage = debate.messages.length > 0 ? debate.messages[debate.messages.length - 1] : null;
    const isLastMessageFromUser = lastMessage && lastMessage.role === 'user';
    
    // Detailed debug logging of all conditions
    console.log(`
      🔍 Extension conditions check:
      - currentRound: ${currentRound}
      - maxRounds: ${maxRounds} 
      - isExtendingRounds: ${isExtendingRounds}
      - isLastMessageFromUser: ${isLastMessageFromUser}
      - messageStatus.sending: ${messageStatus.sending}
      - userMessages.length: ${userMessages.length}
      - showInlineExtensionOptions: ${showInlineExtensionOptions}
    `);
    
    // Only show extension options when user has sent their last message AND bot has responded
    if (
      currentRound === maxRounds && 
      maxRounds < 8 && 
      !isExtendingRounds && 
      !isLastMessageFromUser && // Only show after bot has responded to last user message
      !messageStatus.sending && // Make sure bot isn't still generating a response
      // Prevent showing extension options immediately after extension
      // by ensuring we have at least max rounds of user messages
      userMessages.length >= maxRounds
    ) {
      console.log(`Showing inline extension options: currentRound=${currentRound}, maxRounds=${maxRounds}`);
      setShowInlineExtensionOptions(true);
    } else if (
      // Hide extension options when:
      // - Extension is in progress
      // - or we're at max rounds already (8)
      // - or a new message was added after showing options
      (isExtendingRounds || maxRounds >= 8 || (debate.messages.length > 0 && showInlineExtensionOptions && lastMessage?.role === 'user')) && 
      showInlineExtensionOptions
    ) {
      console.log(`Hiding inline extension options: isExtendingRounds=${isExtendingRounds}, maxRounds=${maxRounds}`);
      setShowInlineExtensionOptions(false);
    }
  }, [debate, isExtendingRounds, messageStatus.sending, showInlineExtensionOptions]);
  
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
        
        {/* ELEGANT SOLUTION: Only show the relevant view based on state */}
        
        {/* Loading View */}
        {viewState === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {/* Summary Generation View */}
        {viewState === 'generating' && (
          <div className="flex-1 overflow-auto bg-neutral-50">
            <SummaryGenerationLoader step={summaryGenerationStep || 1} />
          </div>
        )}
        
        {/* Chat View */}
        {viewState === 'chat' && (
          <>
            <ChatInterface 
              messages={localMessages.length > 0 ? localMessages : (debate?.messages || [])}
              isLoading={messageStatus.sending}
              onSendMessage={handleSendMessage}
              onEndDebate={handleEndDebate}
              partyShortName={party?.shortName}
              userTyping={isUserTyping}
              maxRounds={debate?.maxRounds || 6}
              isGeneratingSummary={viewState === 'generating'}
            />
            <ChatInput 
              onSendMessage={handleSendMessage}
              isLoading={messageStatus.sending || viewState === 'generating'}
              onTypingStateChange={setIsUserTyping}
              disabled={
                // Disable input in these scenarios:
                
                // CASE 1: While waiting for AI response (disable immediately after sending)
                messageStatus.sending || messageStatus.polling ||
                
                // CASE 2: When at max rounds (any number) - permanent disabling
                (debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 6)) ||
                
                // CASE 3: Always disable when the last message is from the user (waiting for bot)
                (debate?.messages && debate.messages.length > 0 && 
                debate.messages[debate.messages.length - 1].role === 'user') ||
                
                // CASE 4: When generating a summary
                viewState === 'generating'
              }
              disabledReason={
                // Determine the reason for disabling:
                
                // PRIORITY 1: When generating a summary
                viewState === 'generating'
                  ? 'generating'
                
                // PRIORITY 2: When waiting for the bot to respond
                : (messageStatus.sending || messageStatus.polling ||
                   (debate?.messages && debate.messages.length > 0 && 
                    debate.messages[debate.messages.length - 1].role === 'user'))
                    ? 'waiting'
                
                // PRIORITY 3: When at maximum allowed rounds
                : (debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 6))
                    ? 'finalRound'
                
                // PRIORITY 4: Default state
                : ''
              }
            />
          </>
        )}
        
        <MobileNavigation />
      </main>
    </div>
  );
}
