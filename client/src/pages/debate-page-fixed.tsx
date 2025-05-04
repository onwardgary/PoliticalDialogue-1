import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { nanoid } from 'nanoid';
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import ChatInterface from "@/components/chat/chat-interface-new";
import ChatInput from "@/components/chat/chat-input";
import { Message } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check as CheckIcon, Loader2 } from "lucide-react";

// Type definitions
type MessageStatus = {
  sending: boolean;
  polling: boolean;
  finalRoundReached: boolean;
};

type UIState = "loading" | "chat" | "animating" | "summaryReady";

export default function DebatePageFixed() {
  // Get secureId from URL params
  const params = useParams();
  const secureId = params?.secureId;
  const apiEndpoint = `/api/debates/s/${secureId}`;
  const [, setLocation] = useLocation();
  
  // State management
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [messageStatus, setMessageStatus] = useState<MessageStatus>({
    sending: false,
    polling: false,
    finalRoundReached: false
  });
  const [uiState, setUiState] = useState<UIState>("loading");
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [summaryUrl, setSummaryUrl] = useState<string | null>(null);
  
  // Create persistent refs for intervals and timeouts
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Safety timer for API operations - auto-recover from stuck states
  useEffect(() => {
    let safetyTimer: number | undefined;
    
    if (messageStatus.sending || messageStatus.polling) {
      safetyTimer = window.setTimeout(() => {
        console.log("SAFETY TIMER: Resetting potentially stuck message status after timeout");
        setMessageStatus(prev => ({ ...prev, sending: false, polling: false }));
      }, 20000); // 20 second safety timeout
    }
    
    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [localMessages, messageStatus.sending, messageStatus.polling]);
  
  // Monitor for assistant messages to reset polling state (removed to avoid race conditions)
  
  // Clean up polling and timers when component unmounts
  useEffect(() => {
    return () => {
      console.log("CLEANUP: User navigated away, stopping all polling activities");
      // Clear any intervals and timeouts
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      // Reset state to avoid any lingering effects if the component is remounted
      setMessageStatus({ sending: false, polling: false, finalRoundReached: false });
    };
  }, []);
  
  // Fetch debate data
  const { data: debate, isLoading: isLoadingDebate } = useQuery({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      console.log(`Fetching debate data from: ${apiEndpoint}`);
      const res = await fetch(apiEndpoint);
      const data = await res.json();
      
      // Save messages to local state
      if (data.messages) {
        const previousMessageCount = localMessages.length;
        const newMessageCount = data.messages.length;
        
        // Only update if the messages array has changed
        if (newMessageCount !== previousMessageCount) {
          setLocalMessages(data.messages);
          
          // If the last message is from assistant, reset polling state
          // But only if we're currently in polling state to avoid unnecessary updates
          if (data.messages.length > 0 && 
              data.messages[data.messages.length - 1].role === 'assistant' && 
              messageStatus.polling) {
            console.log("FETCH RESET: Assistant response detected, resetting polling state");
            setMessageStatus(prev => ({
              ...prev,
              polling: false
            }));
          }
        } else {
          // Just compare the last message to see if it's changed
          const lastOldMessage = previousMessageCount > 0 ? localMessages[previousMessageCount - 1] : null;
          const lastNewMessage = data.messages[newMessageCount - 1];
          
          if (lastOldMessage && lastNewMessage && 
              (lastOldMessage.id !== lastNewMessage.id || 
               lastOldMessage.content !== lastNewMessage.content)) {
            
            setLocalMessages(data.messages);
            
            // If new last message is from assistant and we're polling, reset polling state
            if (lastNewMessage.role === 'assistant' && messageStatus.polling) {
              console.log("FETCH RESET: Assistant response updated, resetting polling state");
              setMessageStatus(prev => ({
                ...prev,
                polling: false
              }));
            }
          }
        }
      }
      
      // Change UI state to chat
      if (uiState === "loading") {
        setUiState("chat");
      }
      
      return data;
    },
    // Only poll when needed (when messageStatus.polling is true)
    refetchInterval: messageStatus.polling ? 5000 : false, // Only poll when waiting for response
  });
  
  // Fetch party data
  const partyEndpoint = debate?.partyId ? `/api/parties/${debate.partyId}` : null;
  const { data: party, isLoading: isLoadingParty } = useQuery({
    queryKey: [partyEndpoint],
    queryFn: async () => {
      if (!partyEndpoint) return null;
      const res = await fetch(partyEndpoint);
      const partyData = await res.json();
      console.log("Party data fetched:", partyData);
      return partyData;
    },
    enabled: !!partyEndpoint,
  });
  
  // Handle sending messages
  const handleSendMessage = async (content: string) => {
    if (messageStatus.sending || messageStatus.polling) return;
    
    // Create a new user message
    const newMessage: Message = {
      id: nanoid(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    
    // Update local state with the user message
    setLocalMessages(prev => [...prev, newMessage]);
    
    // Update message status
    setMessageStatus(prev => ({ ...prev, sending: true }));
    
    try {
      // Check if we should use secureId or regular id
      const endpoint = secureId 
        ? `/api/debates/s/${secureId}/messages` 
        : `/api/debates/${debate?.id}/messages`;
        
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: content }),
      });
      
      if (!res.ok) throw new Error("Failed to send message");
      
      // Start polling for response after a short delay to ensure we don't
      // have a race condition with the response coming back too quickly
      setTimeout(() => {
        setMessageStatus(prev => {
          // Only set polling to true if we're still in sending state
          // This prevents race conditions when responses are very fast
          if (prev.sending) {
            console.log("TIMEOUT: Setting polling state after sending completed");
            return { ...prev, sending: false, polling: true };
          } else {
            // Message was already received, don't enable polling
            console.log("TIMEOUT: Message already received, not enabling polling");
            return prev;
          }
        });
        
        // Force an immediate refetch to start getting the assistant response
        queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      }, 100); // Short delay to prevent race conditions
      
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageStatus(prev => ({ ...prev, sending: false }));
    }
  };
  
  // Handle ending the debate
  const handleEndDebate = async () => {
    if (!debate) return;
    
    // If debate is already complete, just show the summary UI
    // It could be complete with or without a summary
    if (debate.complete) {
      console.log("Debate already complete, showing summary UI", debate);
      // Always set to summaryReady state
      setUiState("summaryReady");
      const summaryRoute = secureId ? `/summary/s/${secureId}` : `/summary/${debate.id}`;
      setSummaryUrl(summaryRoute);
      return;
    }
    
    try {
      // Update UI state to show animation
      setUiState("animating");
      
      // Check if we should use secureId or regular id
      const endpoint = secureId 
        ? `/api/debates/s/${secureId}/end` 
        : `/api/debates/${debate.id}/end`;
        
      const res = await fetch(endpoint, {
        method: 'POST',
      });
      
      // Check for various error responses
      if (!res.ok) {
        // Try to parse the error response
        const errorData = await res.json().catch(() => null);
        const errorMessage = errorData?.message || res.statusText;
        
        // Check if the debate is already completed
        if (errorMessage.includes("already been completed") || 
            errorMessage.includes("already completed") || 
            errorMessage.includes("already ended")) {
          
          console.log("Debate was already completed, skipping to summary view");
          // Go directly to summary page since it already exists
          const summaryRoute = secureId ? `/summary/s/${secureId}` : `/summary/${debate.id}`;
          setSummaryUrl(summaryRoute);
          setUiState("summaryReady");
          return; // Exit the function early since we're redirecting
        } else {
          // For other errors, throw normally
          throw new Error(`Failed to end debate: ${errorMessage}`);
        }
      }
      
      // Debate is ending and summary is being generated
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      
      // Clear any existing timers first
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      // Poll for summary completion 
      pollIntervalRef.current = setInterval(async () => {
        try {
          console.log("Polling for summary completion...");
          const checkRes = await fetch(`/api/debates/s/${secureId}`);
          
          if (!checkRes.ok) {
            console.error("Error checking debate status:", checkRes.status, checkRes.statusText);
            return;
          }
          
          const checkData = await checkRes.json();
          console.log("Poll result:", { 
            complete: checkData.complete, 
            hasSummary: Boolean(checkData.summary),
            currentUIState: uiState
          });
          
          if (checkData.complete && checkData.summary) {
            console.log("Summary detected! Transitioning to ready state");
            
            // Clear the interval
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
              console.log("Cleared poll interval");
            }
            
            // Clear the safety timeout
            if (safetyTimeoutRef.current) {
              clearTimeout(safetyTimeoutRef.current);
              safetyTimeoutRef.current = null;
              console.log("Cleared safety timeout");
            }
            
            // Set the summary URL for redirection
            const summaryRoute = secureId ? `/summary/s/${secureId}` : `/summary/${debate?.id}`;
            setSummaryUrl(summaryRoute);
            
            // Force UI state update to show summary ready notification
            setUiState("summaryReady");
          } else if (checkData.complete && !checkData.summary) {
            console.log("Debate is marked complete but no summary yet");
          }
        } catch (error) {
          console.error("Error checking summary status:", error);
        }
      }, 3000);
      
      // Safety timeout after 2 minutes
      safetyTimeoutRef.current = setTimeout(() => {
        // Clear the interval
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        // If still in animating state, show error or go to summary anyway
        if (uiState === "animating") {
          setUiState("summaryReady");
        }
      }, 120000);
      
      // Add cleanup to the component unmount effect
      return () => {
        // Clear interval if component unmounts during summary generation
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        // Clear timeout if component unmounts during summary generation
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
      };
      
    } catch (error) {
      console.error("Error ending debate:", error);
      setUiState("chat");
    }
  };
  
  // Handle viewing the summary
  const handleViewSummary = () => {
    if (summaryUrl) {
      setLocation(summaryUrl);
    } else {
      // Fallback URL - use the correct route format based on App.tsx routes
      setLocation(secureId ? `/summary/s/${secureId}` : `/summary/${debate?.id}`);
    }
  };
  
  // Add a debug output for party data right before rendering
  // Fetch the party data directly from the debugging data
  const fetchedPartyShortName = party?.shortName;
  
  // Log both raw and processed data
  console.log("PARTY DATA FROM API:", {
    rawParty: party,
    fetchedShortName: fetchedPartyShortName,
    partyId: debate?.partyId,
    isLoadingParty
  });
  
  // Use this helper to guarantee we have a valid party name
  const getPartyShortName = () => {
    // If we have valid party data from API, use it
    if (fetchedPartyShortName) {
      return fetchedPartyShortName;
    }
    
    // Manual mapping based on party ID if party object is missing the shortName
    if (debate?.partyId) {
      const partyMap = {
        1: "PAP",
        2: "WP",
        3: "PSP"
      };
      return partyMap[debate.partyId as 1 | 2 | 3] || "BOT";
    }
    
    // Ultimate fallback
    return "BOT";
  };
  
  const safePartyShortName = getPartyShortName();
  
  console.log("FINAL PARTY SHORT NAME:", safePartyShortName);
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-screen">
        <MobileHeader />
        
        {/* Only render the chat interface when party data is loaded */}
        {isLoadingParty ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ChatInterface 
            messages={localMessages.length > 0 ? localMessages : (debate?.messages || [])}
            isLoading={messageStatus.sending || messageStatus.polling}
            onSendMessage={handleSendMessage}
            onEndDebate={handleEndDebate}
            partyShortName={safePartyShortName}
            userTyping={isUserTyping}
            maxRounds={debate?.maxRounds || 3}
            isGeneratingSummary={uiState === "animating"}
          />
        )}
        
        {/* Chat Input - only show when not loading party data */}
        {!isLoadingParty && (
          <ChatInput 
            onSendMessage={handleSendMessage}
            isLoading={messageStatus.sending || messageStatus.polling || uiState === "animating"}
            onTypingStateChange={setIsUserTyping}
            disabled={
              messageStatus.sending || 
              messageStatus.polling ||
              messageStatus.finalRoundReached ||
              (debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 3)) ||
              (localMessages.length > 0 && localMessages[localMessages.length - 1].role === 'user') ||
              uiState === "animating" || 
              uiState === "summaryReady"
            }
            disabledReason={
              uiState === "animating" ? 'generating' :
              uiState === "summaryReady" ? 'summaryReady' :
              (messageStatus.finalRoundReached || 
               debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 3)) ? 'finalRound' :
              (messageStatus.sending || 
               messageStatus.polling ||
              (localMessages.length > 0 && localMessages[localMessages.length - 1].role === 'user')) ? 'waiting' :
              'maxRounds'
            }
          />
        )}
        
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
                
                <div className="flex flex-col items-center justify-center w-full gap-4">
                  <div className="flex items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                    <span>Please wait...</span>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Force transition to summary ready state
                      console.log("Manual escape from loading state");
                      if (pollIntervalRef.current) {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                      }
                      if (safetyTimeoutRef.current) {
                        clearTimeout(safetyTimeoutRef.current);
                        safetyTimeoutRef.current = null;
                      }
                      
                      const summaryRoute = secureId ? `/summary/s/${secureId}` : `/summary/${debate?.id}`;
                      setSummaryUrl(summaryRoute);
                      setUiState("summaryReady");
                    }}
                  >
                    Skip Animation
                  </Button>
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