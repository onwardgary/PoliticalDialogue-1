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
  
  // Monitor for assistant messages to reset polling state
  useEffect(() => {
    // If we have messages and the last one is from the assistant
    if (localMessages.length > 0 && localMessages[localMessages.length - 1].role === 'assistant') {
      console.log("RESETTING POLLING: Found assistant message, enabling input");
      // Reset polling state since we received the assistant's response
      setMessageStatus(prev => {
        const newState = { ...prev, polling: false };
        console.log("Message status updated:", newState);
        return newState;
      });
    }
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
        
        // If the last message is from assistant, reset polling state
        if (data.messages.length > 0 && data.messages[data.messages.length - 1].role === 'assistant') {
          console.log("FETCH RESET: Assistant response fetched, resetting polling state");
          setMessageStatus(prev => ({
            ...prev,
            polling: false
          }));
        }
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
      
      // Start polling for response
      setMessageStatus(prev => ({ ...prev, sending: false, polling: true }));
      
      // Force an immediate refetch to start getting the assistant response
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageStatus(prev => ({ ...prev, sending: false }));
    }
  };
  
  // Handle ending the debate
  const handleEndDebate = async () => {
    if (!debate) return;
    
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
      
      if (!res.ok) throw new Error("Failed to end debate");
      
      // Debate is ending and summary is being generated
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      
      // Poll for summary completion
      const pollInterval = setInterval(async () => {
        const checkRes = await fetch(`/api/debates/s/${secureId}`);
        const checkData = await checkRes.json();
        
        if (checkData.complete && checkData.summary) {
          clearInterval(pollInterval);
          
          // Set the summary URL for redirection
          const summaryRoute = `/debate/${secureId}/summary`;
          setSummaryUrl(summaryRoute);
          
          // Update UI state to show summary ready notification
          setUiState("summaryReady");
        }
      }, 3000);
      
      // Safety timeout after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        // If still in animating state, show error or go to summary anyway
        if (uiState === "animating") {
          setUiState("summaryReady");
        }
      }, 120000);
      
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
      // Fallback URL
      setLocation(`/debate/${secureId}/summary`);
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