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
    
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = undefined;
      }
      console.log("DEBATE PAGE UNMOUNTED: Cleaned up");
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
      
      // Start polling for response (simplified)
      pollingRef.current = window.setInterval(() => {
        fetch(apiEndpoint)
          .then(response => response.json())
          .then(data => {
            const currentMessageCount = data?.messages?.length || 0;
            const currentMessages = localMessagesRef.current;
            const realLocalMessages = currentMessages.filter(msg => !msg.id.startsWith('typing-')).length;
            
            if (currentMessageCount > realLocalMessages) {
              // We got a new message
              const latestAIMessage = data.messages[data.messages.length - 1];
              
              // Stop polling and update state
              setMessageStatus(prev => ({ ...prev, polling: false }));
              
              // Update messages
              setLocalMessages(prev => {
                const messagesWithoutTyping = prev.filter(msg => !msg.id.startsWith('typing-'));
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
            }
          })
          .catch(error => {
            console.error("Error polling:", error);
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
  
  // Handle sending message
  const handleSendMessage = (message: string) => {
    // Add temporary user message
    const tempUserMessage: Message = {
      id: `user-temp-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now()
    };
    
    // Update local messages
    setLocalMessages(prev => [...prev, tempUserMessage]);
    
    // Send to server
    sendMessageMutation.mutate(message);
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
                        Our AI is reviewing the debate, comparing arguments, 
                        and preparing a comprehensive summary with key points
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
                  Your debate summary has been created and is ready to view.
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