import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import ChatInterface from "@/components/chat/chat-interface-new";
import ChatInput from "@/components/chat/chat-input";
import { useToast } from "@/hooks/use-toast";
import { Message, DebateSummary as DebateSummaryType } from "@shared/schema";
import DebateSummary from "@/components/debate-summary";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon, XIcon, CheckCircle2, Scale, MedalIcon, BrainCircuit } from "lucide-react";

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
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [summaryGenerationStep, setSummaryGenerationStep] = useState<number | null>(null);
  
  // Add a local cache of messages for immediate updates
  // This bypasses React Query's asynchronous cache updates
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  
  // Use a clear view state to control what's rendered
  // Using a string literal type to represent the different view states
  type ViewState = 'loading' | 'chat' | 'generating' | 'summary';
  const [viewState, setViewState] = useState<ViewState>('loading');
  
  // Track message sending state for UI feedback
  const [messageStatus, setMessageStatus] = useState({
    sending: false,
    polling: false,
    finalRoundReached: false
  });
  
  // Determine which API endpoint to use based on which parameter is available
  const apiEndpoint = secureId 
    ? `/api/debates/s/${secureId}` 
    : `/api/debates/${id}`;
  
  // Fetch debate data
  const { data: debate, isLoading: isLoadingDebate } = useQuery({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      console.log("Fetching debate data from:", apiEndpoint);
      const response = await fetch(apiEndpoint, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        priority: 'high'
      } as RequestInit);
      
      if (!response.ok) {
        throw new Error("Failed to fetch debate");
      }
      const data = await response.json();
      
      // Update local messages unless debate is completed
      if (data.messages) {
        if (!data.completed) {
          setLocalMessages(data.messages);
        } else {
          setLocalMessages([]);
        }
      }
      
      return data;
    },
    refetchOnWindowFocus: true,
    refetchInterval: (data: any) => {
      // If debate is completed, stop polling
      if (data?.completed) return false;
      
      const messages = data?.messages || [];
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      
      // More frequent polling when waiting for AI response
      if (lastMessage?.role === 'user') {
        return 1000;
      }
      
      // Regular polling for active conversations
      const lastMessageTime = lastMessage?.timestamp || 0;
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      if (timeSinceLastMessage < 60000) {
        return 3000;
      }
      
      // Less frequent polling for inactive conversations
      return 10000;
    },
    enabled: !!(id || secureId) && !messageStatus.sending,
  });
  
  // Fetch party data
  const { data: party, isLoading: isLoadingParty } = useQuery({
    queryKey: ["/api/parties", debate?.partyId],
    queryFn: async () => {
      if (!debate) return null;
      
      const response = await fetch("/api/parties", {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
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
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
  
  // Send message
  const messageEndpoint = secureId
    ? `/api/debates/s/${secureId}/messages`
    : `/api/debates/${id}/messages`;
    
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      setMessageStatus(prev => ({ ...prev, sending: true }));
      const res = await apiRequest("POST", messageEndpoint, { content });
      return await res.json();
    },
    onSuccess: (data) => {
      setMessageStatus(prev => ({ ...prev, sending: false, polling: true }));
      
      // Update local state with confirmed message
      setLocalMessages(prev => {
        const updatedMessages = prev.map((msg: Message) => {
          if (msg.id.startsWith('temp-')) {
            return data.userMessage;
          }
          return msg;
        });
        return updatedMessages;
      });
      
      // Update React Query cache
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
      
      // Add a temporary typing indicator message with a unique ID
      // Use a truly unique ID based on both timestamp and a random string
      const uniqueTypingId = `typing-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      const typingIndicatorMessage: Message = {
        id: uniqueTypingId,
        role: 'assistant',
        content: '...',
        timestamp: Date.now()
      };
      
      // Add it to the local messages
      setLocalMessages(prev => [...prev, typingIndicatorMessage]);
      
      // Explicitly set polling state to true when we start polling
      setMessageStatus(prev => ({ ...prev, polling: true }));
      
      // Start polling for AI response
      let pollCount = 0;
      let currentDelay = 1000;
      let hasReceivedResponse = false;
      
      const pollInterval = setInterval(() => {
        pollCount++;
        
        if (pollCount <= 30 && !hasReceivedResponse) {
          // Use direct fetch for polling
          fetch(apiEndpoint, {
            headers: { 'Cache-Control': 'no-cache' }
          })
          .then(response => response.json())
          .then(fetchedData => {
            const currentMessageCount = fetchedData?.messages?.length || 0;
            const currentLocalCount = localMessages.length;
            
            // Only compare with real messages
            const realLocalMessages = localMessages.filter(msg => !msg.id.startsWith('typing-')).length;
            
            if (currentMessageCount > realLocalMessages) {
              hasReceivedResponse = true;
              
              const latestAIMessage = fetchedData.messages[fetchedData.messages.length - 1];
              
              // First, remove typing indicator
              setLocalMessages(prev => {
                return prev.filter(msg => !msg.id.startsWith('typing-'));
              });
              
              // Wait longer before adding the real message to ensure React has processed all updates
              setTimeout(() => {
                // Add the real message
                setLocalMessages(prev => [...prev, latestAIMessage]);
                
                // Update the cache
                queryClient.setQueryData([apiEndpoint], fetchedData);
                
                // Check if this was the final round and set the flag only after adding the message
                const userMessagesCount = fetchedData.messages.filter((msg: Message) => msg.role === 'user').length;
                const maxRoundsNumber = debate?.maxRounds || 6;
                
                if (userMessagesCount >= maxRoundsNumber) {
                  // Set the final round flag AFTER the message has been displayed
                  setTimeout(() => {
                    setMessageStatus(prev => ({ 
                      ...prev, 
                      finalRoundReached: true,
                      polling: false 
                    }));
                  }, 150); // Delay the final round state change to ensure smooth UI transition
                } else {
                  // For non-final rounds, just update polling state
                  setMessageStatus(prev => ({ ...prev, polling: false }));
                }
              }, 200); // Increased timeout for smoother transitions
              
              clearInterval(pollInterval);
            }
          })
          .catch(error => {
            console.error("Error polling for response:", error);
            
            // If there's a polling error, make sure to update the state so the UI reflects that
            if (pollCount >= 5) {
              // After a few retries, let the user know something is wrong
              setMessageStatus(prev => ({ ...prev, polling: false }));
              
              // Remove typing indicator if it's still there
              setLocalMessages(prev => {
                return prev.filter(msg => !msg.id.startsWith('typing-'));
              });
              
              toast({
                title: "Connection issue",
                description: "Having trouble getting a response. Please wait or try again.",
                variant: "destructive",
              });
              
              clearInterval(pollInterval);
            }
          });
          
          if (pollCount > 5) {
            currentDelay = Math.min(currentDelay * 1.2, 3000);
          }
        } else {
          clearInterval(pollInterval);
          
          // Remove typing indicator if it's still there
          setLocalMessages(prev => {
            return prev.filter(msg => !msg.id.startsWith('typing-'));
          });
          
          // Always set polling to false when we clear the interval after reaching the maximum poll count
          // This ensures the visual indicator is removed if we fail to get a response
          setMessageStatus(prev => ({ ...prev, polling: false }));
        }
      }, currentDelay);
    },
    onError: (error) => {
      setMessageStatus(prev => ({ ...prev, sending: false, polling: false }));
      
      toast({
        title: "Message failed to send",
        description: "There was a problem sending your message. Please try again.",
        variant: "destructive",
      });
      
      // Mark failed messages in local state
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
      
      // Update React Query cache
      queryClient.setQueryData([apiEndpoint], (old: any) => {
        if (!old) return old;
        
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
  
  // End debate
  const endDebateEndpoint = secureId
    ? `/api/debates/s/${secureId}/end`
    : `/api/debates/${id}/end`;
    
  const endDebateMutation = useMutation({
    mutationFn: async () => {
      setViewState('generating');
      setSummaryGenerationStep(1);
      
      const response = await apiRequest("POST", endDebateEndpoint);
      return await response.json();
    },
    onSuccess: (data) => {
      // Simulate the steps of generating a summary
      const simulateSteps = () => {
        setTimeout(() => {
          setSummaryGenerationStep(2);
          setTimeout(() => {
            setSummaryGenerationStep(3);
            setTimeout(() => {
              setSummaryGenerationStep(4);
              setTimeout(() => {
                // Update React Query cache with completed state
                queryClient.setQueryData([apiEndpoint], data);
                
                // Show success toast
                toast({
                  title: "Debate summary generated",
                  description: "Your debate has been analyzed and summarized.",
                });
                
                // Redirect to the summary page
                const summaryPath = secureId 
                  ? `/summary/s/${secureId}` 
                  : `/summary/${debate?.id}`;
                setLocation(summaryPath);
              }, 1500);
            }, 1500);
          }, 1500);
        }, 1500);
      };
      
      simulateSteps();
    },
    onError: (error) => {
      setViewState('chat');
      setSummaryGenerationStep(null);
      
      toast({
        title: "Failed to generate summary",
        description: "There was a problem generating the debate summary. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Vote on debate outcome
  const voteEndpoint = secureId
    ? `/api/debates/s/${secureId}/vote`
    : `/api/debates/${id}/vote`;
    
  const voteMutation = useMutation({
    mutationFn: async (vote: { agree: boolean }) => {
      const response = await apiRequest("POST", voteEndpoint, vote);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Vote recorded",
        description: "Your vote on the debate outcome has been recorded. Thank you for your feedback!",
      });
      
      // Invalidate the debate query to refresh data
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
    },
    onError: (error) => {
      toast({
        title: "Vote failed",
        description: "There was a problem recording your vote. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Handle sending messages
  const handleSendMessage = (content: string) => {
    if (!content.trim()) return;
    
    // Create a temporary user message to show immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now()
    };
    
    // Add temp message to local state
    setLocalMessages(prev => [...prev, tempUserMessage]);
    
    // Store if this is the final round, but don't update state yet
    // We'll use this flag in the onSuccess callback
    const userMessagesCount = localMessages.filter(msg => msg.role === 'user').length + 1; // +1 for the new message
    const maxRoundsNumber = debate?.maxRounds || 6;
    const isFinalRound = userMessagesCount >= maxRoundsNumber;
    
    // Only update UI immediately to disable input, but don't affect other state yet
    if (isFinalRound) {
      // Set polling status to true to disable input immediately
      setMessageStatus(prev => ({ 
        ...prev, 
        polling: true 
      }));
    }
    
    // Actually send the message
    sendMessageMutation.mutate(content);
  };
  
  // Handle ending debate and generating summary
  const handleEndDebate = () => {
    endDebateMutation.mutate();
  };
  
  // Monitor debate state to set appropriate view and redirect to summary page if completed
  useEffect(() => {
    if (!debate) return;
    
    if (debate.completed && debate.summary) {
      // Redirect to the summary page
      const summaryPath = secureId 
        ? `/summary/s/${secureId}` 
        : `/summary/${debate.id}`;
      setLocation(summaryPath);
    } else {
      setViewState('chat');
    }
  }, [debate, secureId, setLocation]);
  
  // Combined loading state
  const isLoading = isLoadingDebate || isLoadingParty;
  
  if (isLoading && viewState === 'loading' as ViewState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Determine if user can still send messages
  const canSendMessages = debate && 
    !debate.completed && 
    !messageStatus.sending && 
    !messageStatus.polling && 
    debate.messages.filter((msg: Message) => msg.role === 'user').length < (debate.maxRounds || 6) && 
    (debate.messages.length === 0 || debate.messages[debate.messages.length - 1].role !== 'user');
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-screen">
        <MobileHeader />
        
        {/* Summary Generation View */}
        {viewState === ('generating' as ViewState) && (
          <div className="flex-1 overflow-auto bg-neutral-50">
            <SummaryGenerationLoader step={summaryGenerationStep || 1} />
          </div>
        )}
        
        {/* Chat View */}
        {viewState === ('chat' as ViewState) && (
          <>
            <ChatInterface 
              messages={localMessages.length > 0 ? localMessages : (debate?.messages || [])}
              isLoading={messageStatus.sending || messageStatus.polling}
              onSendMessage={handleSendMessage}
              onEndDebate={handleEndDebate}
              partyShortName={party?.shortName}
              userTyping={isUserTyping}
              maxRounds={debate?.maxRounds || 6}
              isGeneratingSummary={viewState === 'generating' as ViewState ? true : false}
            />
            <ChatInput 
              onSendMessage={handleSendMessage}
              isLoading={messageStatus.sending || messageStatus.polling || viewState === 'generating' as ViewState}
              onTypingStateChange={setIsUserTyping}
              disabled={
                // Disable input in these scenarios:
                
                // CASE 1: While waiting for AI response (disable immediately after sending)
                messageStatus.sending || messageStatus.polling ||
                
                // CASE 2: When at max rounds (any number) - permanent disabling
                messageStatus.finalRoundReached ||
                (debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 6)) ||
                
                // CASE 3: Always disable when the last message is from the user (waiting for bot)
                (debate?.messages && debate.messages.length > 0 && 
                debate.messages[debate.messages.length - 1].role === 'user') ||
                
                // CASE 4: When generating a summary
                viewState === ('generating' as ViewState)
              }
              disabledReason={
                // Determine the reason for disabling:
                
                // PRIORITY 1: When generating a summary
                viewState === 'generating' as ViewState
                  ? 'generating'
                
                // PRIORITY 2: When waiting for the bot to respond
                : (messageStatus.sending || messageStatus.polling ||
                   (debate?.messages && debate.messages.length > 0 && 
                    debate.messages[debate.messages.length - 1].role === 'user'))
                    ? 'waiting'
                
                // PRIORITY 3: When at maximum allowed rounds (either by server data or immediate local state)
                : (messageStatus.finalRoundReached || 
                  debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 6))
                    ? 'finalRound'
                
                // PRIORITY 4: Default state
                : 'maxRounds'
              }
            />
          </>
        )}
        
        <MobileNavigation />
      </main>
    </div>
  );
}