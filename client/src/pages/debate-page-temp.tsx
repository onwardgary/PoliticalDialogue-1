import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import ChatInterface from "@/components/chat/chat-interface-new";
import ChatInput from "@/components/chat/chat-input";
import { useToast } from "@/hooks/use-toast";
import { Message } from "@shared/schema";
import { Loader2, CheckIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// A simplified version of the debate page to fix hooks ordering issues
export default function DebatePageSimplified() {
  // URL parameters
  const params = useParams();
  const id = params.id;
  const secureId = params.secureId;
  
  // Navigation
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Basic state
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const isMounted = useRef(true);
  const localMessagesRef = useRef<Message[]>([]);
  const pollingRef = useRef<number>();
  
  // Message status
  const [messageStatus, setMessageStatus] = useState({
    sending: false,
    polling: false,
    finalRoundReached: false
  });
  
  // UI state - always initialized to loading
  const [uiState, setUiState] = useState("loading");
  const [summaryUrl, setSummaryUrl] = useState("");
  
  // API endpoints
  const apiEndpoint = secureId 
    ? `/api/debates/s/${secureId}`
    : `/api/debates/${id}`;
    
  const messageEndpoint = secureId
    ? `/api/debates/s/${secureId}/messages`
    : `/api/debates/${id}/messages`;
    
  // Changed from 'complete' to 'end' - that's the endpoint that actually generates summaries
  const endDebateEndpoint = secureId
    ? `/api/debates/s/${secureId}/end`
    : `/api/debates/${id}/end`;
    
  // Cleanup on unmount with safety checks
  useEffect(() => {
    return () => {
      // Mark component as unmounted first
      isMounted.current = false;
      
      // Reset state as a safety measure
      setMessageStatus({
        sending: false,
        polling: false, 
        finalRoundReached: false
      });
      
      // Clear any active polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = undefined;
      }
      
      console.log("DEBATE PAGE UNMOUNTED: Cleaned up with safety measures");
    };
  }, []);
  
  // Keep ref in sync with state
  useEffect(() => {
    localMessagesRef.current = localMessages;
  }, [localMessages]);
  
  // Fetch debate data
  const { data: debate, isLoading: isLoadingDebate } = useQuery({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      console.log(`Fetching debate data from: ${apiEndpoint}`);
      const res = await fetch(apiEndpoint);
      const data = await res.json();
      
      // Save messages to local state
      if (data.messages) {
        setLocalMessages(data.messages);
      }
      
      // Change UI state to chat
      if (uiState === "loading") {
        setUiState("chat");
      }
      
      return data;
    },
    refetchInterval: 10000, // Every 10 seconds
  });
  
  // Fetch party data
  const partyEndpoint = debate?.partyId ? `/api/parties/${debate.partyId}` : null;
  const { data: party, isLoading: isLoadingParty } = useQuery({
    queryKey: [partyEndpoint],
    queryFn: async () => {
      if (!partyEndpoint) return null;
      const res = await fetch(partyEndpoint);
      return await res.json();
    },
    enabled: !!partyEndpoint,
  });
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      setMessageStatus(prev => ({ ...prev, sending: true }));
      try {
        const res = await apiRequest("POST", messageEndpoint, { content });
        return await res.json();
      } catch (error) {
        console.error("Error sending message:", error);
        setMessageStatus(prev => ({ ...prev, sending: false, polling: false }));
        toast({
          title: "Failed to send message",
          description: "Please try again in a moment",
          variant: "destructive"
        });
        throw error;
      }
    },
    onSuccess: (data) => {
      setMessageStatus(prev => ({ ...prev, sending: false, polling: true }));
      
      // Update local messages
      setLocalMessages(prev => {
        // Remove typing indicators
        const messagesWithoutTyping = prev.filter(msg => !msg.id.startsWith('typing-'));
        
        // Update user messages
        const messagesWithUpdatedUser = messagesWithoutTyping.map(msg => {
          if (msg.id.startsWith('user-temp-')) {
            return data.userMessage;
          }
          return msg;
        });
        
        // Add typing indicator
        const timestamp = Date.now();
        const typingIndicatorMessage: Message = {
          id: `typing-${timestamp}`,
          role: 'assistant',
          content: '...',
          timestamp: timestamp
        };
        
        return [...messagesWithUpdatedUser, typingIndicatorMessage];
      });
      
      // Start polling for response (enhanced with better error handling and timeout)
      let pollingAttempts = 0;
      const MAX_POLLING_ATTEMPTS = 30; // 30 seconds max polling time
      
      pollingRef.current = window.setInterval(() => {
        // Safety check: if component unmounted, don't continue
        if (!isMounted.current) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = undefined;
          }
          return;
        }
        
        // Count attempts and stop if too many
        pollingAttempts++;
        if (pollingAttempts > MAX_POLLING_ATTEMPTS) {
          console.log("Max polling attempts reached, stopping poll and resetting status");
          setMessageStatus(prev => ({ ...prev, polling: false, sending: false }));
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = undefined;
          }
          toast({
            title: "Message response timed out",
            description: "Please try refreshing the page if the interface is unresponsive",
          });
          return;
        }
        
        fetch(apiEndpoint)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Server responded with ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            // Check if we're still mounted
            if (!isMounted.current) return;
            
            // Improved comparison logic - instead of just comparing counts, we'll track message IDs
            const serverMessages = data?.messages || [];
            const currentMessages = localMessagesRef.current || [];
            
            // Get the actual messages without typing indicators
            const realLocalMessages = currentMessages.filter(msg => !msg.id.startsWith('typing-'));
            
            // Extract IDs for easy comparison
            const serverMessageIds = new Set(serverMessages.map(msg => msg.id));
            const localMessageIds = new Set(realLocalMessages.map(msg => msg.id));
            
            // Find any message IDs that exist on server but not locally
            let hasNewMessages = false;
            let latestAIMessage = null;
            
            // Check specifically for new AI messages (role=assistant)
            for (let i = serverMessages.length - 1; i >= 0; i--) {
              const msg = serverMessages[i];
              if (msg.role === 'assistant' && !localMessageIds.has(msg.id)) {
                hasNewMessages = true;
                latestAIMessage = msg;
                break;
              }
            }
            
            // Debug the message comparison
            console.log("Message comparison:", {
              serverMessageCount: serverMessages.length,
              localMessageCount: realLocalMessages.length,
              hasNewMessages,
              latestAIMessage: latestAIMessage?.id || null
            });
            
            if (hasNewMessages && latestAIMessage) {
              // We found a new assistant message
              console.log("Found new AI message with ID:", latestAIMessage.id);
              
              // Stop polling and update state (ensure state is fully reset)
              setMessageStatus(prev => ({ ...prev, polling: false, sending: false }));
              
              // Update messages
              setLocalMessages(prev => {
                const messagesWithoutTyping = prev.filter(msg => !msg.id.startsWith('typing-'));
                
                // Ensure we don't have duplicate messages
                const alreadyHasLatestMessage = messagesWithoutTyping.some(
                  msg => msg.id === latestAIMessage.id
                );
                
                if (!alreadyHasLatestMessage) {
                  return [...messagesWithoutTyping, latestAIMessage];
                } else {
                  return messagesWithoutTyping;
                }
              });
              
              // Check if final round
              const userMessagesCount = data.messages.filter((msg: Message) => msg.role === 'user').length;
              const maxRoundsNumber = data?.maxRounds || 3;
              
              if (userMessagesCount >= maxRoundsNumber) {
                setMessageStatus(prev => ({ ...prev, finalRoundReached: true }));
              }
              
              // Stop polling
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = undefined;
              }
              
              console.log("Message received, polling stopped, input should be enabled");
            }
          })
          .catch(error => {
            console.error("Error polling:", error);
            // On error, also make sure we reset status
            if (pollingAttempts > 5) { // Allow a few errors before giving up
              setMessageStatus(prev => ({ ...prev, polling: false, sending: false }));
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = undefined;
              }
            }
          });
      }, 1000);
    },
    onError: (error) => {
      setMessageStatus(prev => ({ ...prev, sending: false, polling: false }));
      toast({
        title: "Failed to send message",
        description: error.message || "An error occurred while sending your message",
        variant: "destructive",
      });
    },
  });
  
  // End debate mutation
  const endDebateMutation = useMutation({
    mutationFn: async () => {
      // Show animation
      setUiState("animating");
      
      try {
        console.log("Attempting to complete debate via API", endDebateEndpoint);
        
        // Make sure the request completes properly
        const response = await fetch(endDebateEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        let data;
        try {
          data = await response.json();
        } catch (e) {
          console.warn("Response was not JSON:", e);
          // Continue even if JSON parsing fails - the endpoint might return empty data
          data = {};
        }
        
        // Update cache
        queryClient.setQueryData([apiEndpoint], (oldData) => {
          return {
            ...(oldData || {}),
            ...(data || {}),
            completed: true, // Force completed flag
          };
        });
        
        // Prepare summary path
        const summaryPath = secureId 
          ? `/summary/s/${secureId}` 
          : `/summary/${debate?.id}`;
          
        setSummaryUrl(summaryPath);
        
        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return { success: true, path: summaryPath };
      } catch (error) {
        console.error("Error ending debate:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Summary generated successfully, ready to view at:", data.path);
      // Show summary ready dialog
      setUiState("summaryReady");
    },
    onError: (error) => {
      setUiState("chat");
      console.error("Summary generation failed:", error);
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Handle sending message with additional safety measures
  const handleSendMessage = (message: string) => {
    // First, remove any old typing indicators to prevent state issues
    setLocalMessages(prev => prev.filter(msg => !msg.id.startsWith('typing-')));
    
    // Add temporary user message
    const tempUserMessage: Message = {
      id: `user-temp-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now()
    };
    
    // Reset message status first to ensure clean starting state
    setMessageStatus(prev => ({ 
      ...prev, 
      sending: true, 
      polling: false // Explicitly turn polling off before starting new message flow
    }));
    
    // Update local messages
    setLocalMessages(prev => [...prev, tempUserMessage]);
    
    // Send to server
    sendMessageMutation.mutate(message);
    
    // Add additional state check in case mutation fails
    setTimeout(() => {
      if (isMounted.current) {
        setMessageStatus(prev => {
          // If we're still in 'sending' state after 15 seconds, something went wrong
          if (prev.sending && !prev.polling) {
            console.log("Message sending timed out, resetting state");
            return { ...prev, sending: false, polling: false };
          }
          return prev;
        });
      }
    }, 15000);
  };
  
  // Handle ending debate
  const handleEndDebate = () => {
    console.log("Ending debate");
    
    // If debate is already completed, just go to summary
    if (debate?.completed) {
      const summaryPath = secureId 
        ? `/summary/s/${secureId}` 
        : `/summary/${debate.id}`;
      setSummaryUrl(summaryPath);
      setUiState("summaryReady");
      return;
    }
    
    // Otherwise generate the summary
    endDebateMutation.mutate();
  };
  
  // Handle viewing summary
  const handleViewSummary = () => {
    // Reset UI state
    setUiState("chat");
    
    // Navigate to summary
    setLocation(summaryUrl);
  };
  
  // Combined loading state
  const isLoading = isLoadingDebate || isLoadingParty;
  
  // Show loading screen
  if (isLoading && uiState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Debug log function (not a hook)
  const logDebugInfo = () => {
    if (debate) {
      console.log("DEBUG INFO:", {
        messages: localMessages.length,
        debate: debate.messages.length,
        uiState,
        messageStatus
      });
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-screen">
        <MobileHeader />
        
        {/* Chat Interface */}
        <ChatInterface 
          messages={localMessages.length > 0 ? localMessages : (debate?.messages || [])}
          isLoading={messageStatus.sending || messageStatus.polling}
          onSendMessage={handleSendMessage}
          onEndDebate={handleEndDebate}
          partyShortName={party?.shortName}
          userTyping={isUserTyping}
          maxRounds={debate?.maxRounds || 3}
          isGeneratingSummary={uiState === "animating"}
        />
        
        {/* Chat Input */}
        <ChatInput 
          onSendMessage={handleSendMessage}
          isLoading={messageStatus.sending || messageStatus.polling || uiState === "animating"}
          onTypingStateChange={setIsUserTyping}
          disabled={
            // CASE 1: While sending or polling
            messageStatus.sending || messageStatus.polling ||
            
            // CASE 2: When at max rounds
            messageStatus.finalRoundReached ||
            (debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 3)) ||
            
            // CASE 3: When last message is from user
            (localMessages.length > 0 && localMessages[localMessages.length - 1].role === 'user') ||
            
            // CASE 4: When animating or summary ready
            uiState === "animating" || uiState === "summaryReady"
          }
          disabledReason={
            // Set reason based on priority
            uiState === "animating"
              ? 'generating'
            : uiState === "summaryReady"
              ? 'summaryReady'
            : (messageStatus.finalRoundReached || 
               debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 3))
                ? 'finalRound'
            : (messageStatus.sending || messageStatus.polling ||
               (localMessages.length > 0 && localMessages[localMessages.length - 1].role === 'user'))
                ? 'waiting'
            : 'maxRounds' // Changed from 'default' to 'maxRounds' to match expected type
          }
        />
        
        {/* Animation */}
        {uiState === "animating" && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 max-w-md w-full">
              <div className="flex flex-col items-center">
                <h2 className="text-2xl font-bold mb-6 text-center">
                  Generating Debate Summary...
                </h2>
                
                <div className="w-full space-y-6 mb-8">
                  <div className="flex items-start">
                    <div className="mr-4 flex-shrink-0">
                      <div className="h-6 w-6 rounded-full bg-amber-500 animate-pulse flex items-center justify-center text-white">
                        <CheckIcon className="h-3 w-3" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium text-amber-500 font-bold">
                        Analyzing your conversation
                      </h3>
                      <p className="text-sm text-gray-500">
                        Our AI is evaluating this debate through a 5-pillar assessment:
                        logical soundness, emotional reasoning, key point resolution,
                        tone clarity, and pragmatism. A winner will be declared with
                        specific action recommendations.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-center w-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                  <span>Please wait...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Summary Ready */}
        {uiState === "summaryReady" && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 max-w-md w-full">
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckIcon className="h-6 w-6 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-center">
                  Summary Ready!
                </h2>
                <p className="text-center text-muted-foreground mb-6">
                  Your debate has been analyzed! View the point-by-point comparison,
                  stakeholder impact assessment, and find out which side made the most 
                  compelling arguments.
                </p>
                <Button 
                  onClick={handleViewSummary}
                  className="w-full"
                >
                  View Summary <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <MobileNavigation />
      </main>
    </div>
  );
}