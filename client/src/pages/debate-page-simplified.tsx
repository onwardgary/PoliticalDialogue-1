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
    <div className="flex flex-col items-center justify-center h-full p-6 bg-black">
      <Card className="w-full max-w-lg border-2 border-white bg-black text-white">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-2">Generating Debate Summary</h3>
              <p className="text-gray-300 text-sm">Please wait while we analyze your debate</p>
            </div>
            
            <Progress value={(step / steps.length) * 100} className="h-3 mb-8 bg-gray-800" />
            
            <div className="space-y-4">
              {steps.map((s) => {
                const Icon = s.icon;
                const isActive = s.id === step;
                const isCompleted = s.id < step;
                
                return (
                  <div 
                    key={s.id} 
                    className={`flex items-center p-4 rounded-lg transition-all ${
                      isActive 
                        ? "bg-white/10 border-2 border-white" 
                        : isCompleted 
                          ? "bg-gray-800 border border-gray-700"
                          : "bg-gray-900 border border-gray-800"
                    }`}
                  >
                    <div 
                      className={`rounded-full p-2 mr-4 ${
                        isActive 
                          ? "bg-white text-black animate-pulse" 
                          : isCompleted 
                            ? "bg-gray-200 text-black"
                            : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-base ${
                        isActive 
                          ? "text-white" 
                          : isCompleted 
                            ? "text-gray-200"
                            : "text-gray-400"
                      }`}>
                        {s.name}
                      </p>
                      <p className={`text-sm ${
                        isActive 
                          ? "text-gray-300" 
                          : isCompleted 
                            ? "text-gray-400"
                            : "text-gray-500"
                      }`}>
                        {s.description}
                      </p>
                    </div>
                    {isActive && (
                      <div className="ml-auto">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                    {isCompleted && (
                      <div className="ml-auto">
                        <CheckCircle2 className="h-5 w-5 text-white" />
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
  
  // Custom setter for viewState that includes logging
  const setViewStateWithLogging = (newState: ViewState) => {
    console.log(`Changing view state from ${viewState} to ${newState}`);
    setViewState(newState);
  };
  
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
      
      // First, remove any existing typing indicators to prevent duplicates
      setLocalMessages(prev => prev.filter(msg => !msg.id.startsWith('typing-')));
      
      // Add a temporary typing indicator message with a unique ID
      // Use a UUID-like approach combining timestamp, random string, and counter for absolute uniqueness
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substring(2, 10);
      const uniqueTypingId = `typing-${timestamp}-${randomPart}-${Math.floor(Math.random() * 1000000)}`;
      
      const typingIndicatorMessage: Message = {
        id: uniqueTypingId,
        role: 'assistant',
        content: '...',
        timestamp: timestamp
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
                const maxRoundsNumber = debate?.maxRounds || 3;
                
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
          // Handle temp- messages with the new format (timestamp-randomstring-random number)
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
          // Check for any temp- prefixed message ID, regardless of the exact format
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
      // Set the view state and summary step before making the API request
      // This ensures animation is visible immediately when button is clicked
      setViewStateWithLogging('generating');
      setSummaryGenerationStep(1);
      
      console.log("Button clicked: Changing to generating view and setting step 1");
      
      // Add a small delay to ensure UI updates before API call
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const response = await apiRequest("POST", endDebateEndpoint);
      return await response.json();
    },
    onSuccess: (data) => {
      // Simulate the steps of generating a summary (with longer, more visible transitions)
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
                
                // Ensure we've shown all steps of the animation first
                setTimeout(() => {
                  // Final check to make sure we're still in generating state before redirecting
                  if (viewState === 'generating') {
                    console.log("All animation steps completed, now redirecting to summary page");
                    
                    // Redirect to the summary page
                    const summaryPath = secureId 
                      ? `/summary/s/${secureId}` 
                      : `/summary/${debate?.id}`;
                    setLocation(summaryPath);
                  } else {
                    console.log("Warning: View state changed during animation, not redirecting");
                  }
                }, 500); // Small additional delay to ensure all animations are visible
              }, 1500); // Changed back to 1500ms for more visible animation
            }, 1500); // Changed back to 1500ms for more visible animation
          }, 1500); // Changed back to 1500ms for more visible animation
        }, 1500); // Changed back to 1500ms for more visible animation
      };
      
      simulateSteps();
    },
    onError: (error) => {
      console.log("Error generating summary, resetting to chat view");
      setViewStateWithLogging('chat');
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
    
    // Create a temporary user message to show immediately with guaranteed unique ID
    // Same UUID-like approach as typing indicators for consistency and uniqueness
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 10);
    const uniqueId = `temp-${timestamp}-${randomPart}-${Math.floor(Math.random() * 1000000)}`;
    
    const tempUserMessage: Message = {
      id: uniqueId,
      role: 'user',
      content,
      timestamp: timestamp
    };
    
    // Add temp message to local state
    setLocalMessages(prev => [...prev, tempUserMessage]);
    
    // Store if this is the final round, but don't update state yet
    // We'll use this flag in the onSuccess callback
    const userMessagesCount = localMessages.filter(msg => msg.role === 'user').length + 1; // +1 for the new message
    const maxRoundsNumber = debate?.maxRounds || 3;
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
    console.log("Ending debate and generating summary");
    
    // Check current state before mutating
    console.log("Current state before ending debate:", { 
      viewState,
      currentStep: summaryGenerationStep,
      isGenerating: endDebateMutation.isPending
    });
    
    endDebateMutation.mutate();
  };
  
  // Monitor debate state to set appropriate view and redirect to summary page if completed
  useEffect(() => {
    if (!debate) return;
    
    if (debate.completed && debate.summary) {
      // Only redirect if we're not already in the summary generation view
      // This prevents the race condition where this effect might redirect before animation finishes
      if (viewState !== 'generating') {
        // Redirect to the summary page
        const summaryPath = secureId 
          ? `/summary/s/${secureId}` 
          : `/summary/${debate.id}`;
        
        console.log(`Completed debate detected: Redirecting from ${viewState} to summary page ${summaryPath}`);
        setLocation(summaryPath);
      } else {
        console.log("Completed debate detected BUT not redirecting because viewState is already 'generating'");
      }
    } else if (viewState !== 'generating') {
      // ONLY change to chat view if we're not currently generating a summary
      // This prevents the race condition where this effect resets the view during summary generation
      console.log("Debate not completed and viewState is not 'generating', setting to 'chat'");
      setViewStateWithLogging('chat');
    } else {
      console.log("Debate not completed BUT not changing view because viewState is 'generating'");
    }
  }, [debate, secureId, setLocation, viewState]);
  
  // Global cleanup effect to ensure polling state is reset if component unmounts
  // or if there's any other unexpected issue
  useEffect(() => {
    // Reset polling state on mount to ensure clean state
    setMessageStatus(prev => ({ ...prev, polling: false }));
    
    // Clear any typing indicators that might be lingering from previous sessions
    setLocalMessages(prev => prev.filter(msg => !msg.id.startsWith('typing-')));
    
    // Return cleanup function to ensure everything is reset when unmounting
    return () => {
      // Reset message status when component unmounts
      setMessageStatus(prev => ({ ...prev, sending: false, polling: false }));
    };
  }, []);
  
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
    debate.messages.filter((msg: Message) => msg.role === 'user').length < (debate.maxRounds || 3) && 
    (debate.messages.length === 0 || debate.messages[debate.messages.length - 1].role !== 'user');
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-screen">
        <MobileHeader />
        
        {/* Summary Generation View */}
        {viewState === ('generating' as ViewState) && (
          <div className="flex-1 overflow-auto bg-black w-full h-full">
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
              maxRounds={debate?.maxRounds || 3}
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
                (debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 3)) ||
                
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
                
                // PRIORITY 2: When at maximum allowed rounds (moved up in priority)
                // This ensures "Maximum rounds reached" shows immediately when user hits the limit
                : (messageStatus.finalRoundReached || 
                  debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 3))
                    ? 'finalRound'
                
                // PRIORITY 3: When waiting for the bot to respond (moved down in priority)
                // Now this only shows if we're not at max rounds
                : (messageStatus.sending || messageStatus.polling ||
                   (debate?.messages && debate.messages.length > 0 && 
                    debate.messages[debate.messages.length - 1].role === 'user'))
                    ? 'waiting'
                
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