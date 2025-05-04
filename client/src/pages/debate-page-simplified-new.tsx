import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import SummaryAnimationOverlay, { SummaryReadyNotification } from "@/components/animation/summary-animation-overlay";
import Sidebar from "@/components/sidebar";
import { MobileHeader, MobileNavigation } from "@/components/mobile-nav";
import ChatInterface from "@/components/chat/chat-interface-new";
import ChatInput from "@/components/chat/chat-input";
import { useToast } from "@/hooks/use-toast";
import { Message } from "@shared/schema";
import { Loader2, CheckIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Declare window property for animation tracking
declare global {
  interface Window {
    currentAnimationId?: string;
  }
}

export default function DebatePage() {
  // Extract parameters from the URL - could be either regular ID or secure ID
  const params = useParams();
  const id = params.id;
  const secureId = params.secureId;
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isUserTyping, setIsUserTyping] = useState(false);
  
  // Animation states
  const [isAnimationOpen, setIsAnimationOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  
  // Track component mounting status
  const isMounted = useRef(true);
  
  // Add a local cache of messages for immediate updates
  // This bypasses React Query's asynchronous cache updates
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  
  // Use a clear view state to control what's rendered
  // Using a string literal type to represent the different view states
  type ViewState = 'loading' | 'chat' | 'generating' | 'summary-ready' | 'summary';
  const [viewState, setViewState] = useState<ViewState>('loading');
  
  // State to store the summary URL for delayed navigation
  const [summaryUrl, setSummaryUrl] = useState<string | null>(null);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Custom setter for viewState that includes logging
  const setViewStateWithLogging = (newState: ViewState) => {
    console.log(`Changing view state from ${viewState} to ${newState}`);
    if (isMounted.current) {
      setViewState(newState);
    }
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

  // Also define the end debate endpoint
  const endDebateEndpoint = secureId 
    ? `/api/debates/s/${secureId}/end` 
    : `/api/debates/${id}/end`;
  
  // Add state to track polling behavior
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const MAX_POLLING_ATTEMPTS = 30; // About 60 seconds of polling at varying intervals
  
  // Fetch debate data
  const { data: debate, isLoading: isLoadingDebate } = useQuery({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      console.log(`Fetching debate data from: ${apiEndpoint} (attempt ${pollingAttempts + 1})`);
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
      
      // More focused logging to avoid console spam
      console.log(
        `Fetch success: Debate ID ${data.id}, secureId ${data.secureId}, ` +
        `completed: ${data.completed}, messages: ${data.messages?.length || 0}`
      );
      
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
      // DO NOT increment polling attempts counter inside the refetchInterval callback!
      // This causes an infinite React render cycle
      
      // If we've reached max attempts, stop polling
      if (pollingAttempts >= MAX_POLLING_ATTEMPTS) {
        console.log(`Maximum polling attempts (${MAX_POLLING_ATTEMPTS}) reached, stopping automatic polling`);
        return false;
      }
      
      // If debate is completed, stop polling
      if (data?.completed) {
        console.log("Debate is completed, stopping polling");
        return false;
      }
      
      const messages = data?.messages || [];
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      
      // More frequent polling when waiting for AI response
      if (lastMessage?.role === 'user') {
        console.log("Waiting for bot response, polling every 1 second");
        return 1000;
      }
      
      // Adaptive polling based on conversation activity
      const lastMessageTime = lastMessage?.timestamp || 0;
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      
      // Regular polling for active conversations (within the last minute)
      if (timeSinceLastMessage < 60000) {
        console.log("Active conversation, polling every 3 seconds");
        return 3000;
      }
      
      // Gradually reduce polling frequency for inactive conversations
      // Use exponential backoff: 10s, 15s, 22.5s, etc. up to 60s
      const backoffTime = Math.min(10000 * Math.pow(1.5, Math.floor(pollingAttempts / 5)), 60000);
      console.log(`Inactive conversation, polling with backoff: ${backoffTime}ms`);
      return backoffTime;
    },
    enabled: !!(id || secureId) && !messageStatus.sending,
    // Add stale time to prevent unnecessary refetches
    staleTime: 5000,
    // Add garbage collection time
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Use effect to safely increment polling counter
  useEffect(() => {
    // Only increment when debate exists and not completed
    if (debate && !debate.completed) {
      // Use a timer to control polling attempts increments
      const timer = setTimeout(() => {
        setPollingAttempts(prev => Math.min(prev + 1, MAX_POLLING_ATTEMPTS));
      }, 3000); // Every 3 seconds increment the counter safely
      
      return () => clearTimeout(timer);
    }
  }, [debate, debate?.completed]);

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
          if (msg.id.startsWith('user-temp-')) {
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
          if (msg.id.startsWith('user-temp-')) {
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
      
      // Add a temporary typing indicator message with a truly unique ID
      // Use multiple sources of randomness for absolute uniqueness
      const timestamp = Date.now();
      const randomPart1 = Math.random().toString(36).substring(2, 10);
      const randomPart2 = Math.random().toString(36).substring(2, 10);
      const randomNumber = Math.floor(Math.random() * 100000000);
      // Combine all these elements to create a very unique ID that cannot possibly collide
      const uniqueTypingId = `typing-${timestamp}-${randomPart1}-${randomPart2}-${randomNumber}`;
      
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
              
              // IMPORTANT: First, immediately stop the polling state to prevent duplicate typing indicators
              setMessageStatus(prev => ({ ...prev, polling: false }));
              
              // Then check if we already have this message to prevent duplicates
              // We'll use a combined approach: remove typing indicator and carefully add the new message in a single update
              setLocalMessages(prev => {
                // Get all messages except typing indicators
                const messagesWithoutTyping = prev.filter(msg => !msg.id.startsWith('typing-'));
                
                // Check if we already have the latest AI message (prevent duplicates)
                const alreadyHasLatestMessage = messagesWithoutTyping.some(
                  msg => msg.id === latestAIMessage.id
                );
                
                // Only add the message if we don't already have it
                if (!alreadyHasLatestMessage) {
                  return [...messagesWithoutTyping, latestAIMessage];
                } else {
                  console.log('Message already exists, not adding duplicate:', latestAIMessage.id);
                  return messagesWithoutTyping;
                }
              });
              
              // Update the cache
              queryClient.setQueryData([apiEndpoint], fetchedData);
              
              // Check if this was the final round and set the flag only after adding the message
              const userMessagesCount = fetchedData.messages.filter((msg: Message) => msg.role === 'user').length;
              const maxRoundsNumber = debate?.maxRounds || 3;
              
              if (userMessagesCount >= maxRoundsNumber) {
                // Set the final round flag for max rounds reached
                setTimeout(() => {
                  setMessageStatus(prev => ({ 
                    ...prev, 
                    finalRoundReached: true
                  }));
                }, 150); // Delay the final round state change to ensure smooth UI transition
              }
              
              // Stop polling since we received a response
              clearInterval(pollInterval);
            }
          })
          .catch(error => {
            console.error("Error polling for response:", error);
            
            // Increase the delay with backoff strategy
            currentDelay = Math.min(currentDelay * 1.5, 10000);
          });
        } else {
          // After max attempts or after receiving response, stop polling
          if (!hasReceivedResponse) {
            console.warn("Max polling attempts reached, giving up on getting bot response");
          
            // Clear the typing indicator since we stopped polling
            setLocalMessages(prev => prev.filter(msg => !msg.id.startsWith('typing-')));
            
            // Reset the polling state
            setMessageStatus(prev => ({ ...prev, polling: false }));
            
            // Show error toast
            toast({
              title: "Connection issue",
              description: "Having trouble getting a response. Please try again.",
              variant: "destructive",
            });
          }
          clearInterval(pollInterval);
        }
      }, 1000);
      
      // Return a cleanup function that clears the interval if unmounted
      return () => {
        clearInterval(pollInterval);
      };
    },
    onError: (error) => {
      // Reset state on error
      setMessageStatus(prev => ({ ...prev, sending: false, polling: false }));
      
      // Show error toast
      toast({
        title: "Failed to send message",
        description: error.message || "An error occurred while sending your message",
        variant: "destructive",
      });
    },
  });
  
  // End debate mutation - simplified to work with embedded animation
  const endDebateMutation = useMutation({
    mutationFn: async () => {
      console.log("Button clicked: Starting summary generation");
      
      // Show the animation immediately 
      setIsAnimationOpen(true);
      
      try {
        // Make the API call directly
        const response = await apiRequest("POST", endDebateEndpoint);
        const data = await response.json();
        
        // Update the query cache with the new debate data
        if (data) {
          queryClient.setQueryData([apiEndpoint], data);
        }
        
        // Prepare the summary path
        const summaryPath = secureId 
          ? `/summary/s/${secureId}` 
          : `/summary/${debate?.id}`;
            
        setSummaryUrl(summaryPath);
        
        // Wait 3 seconds to give the illusion of processing (animation effect)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Successfully completed
        return { success: true, path: summaryPath };
      } catch (error) {
        console.error("Error ending debate:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("End debate mutation completed successfully");
      
      // After 3 seconds, hide the animation and show the notification
      setTimeout(() => {
        setIsAnimationOpen(false);
        setIsNotificationOpen(true);
      }, 500);
    },
    onError: (error) => {
      console.error("Error in endDebateMutation:", error);
      setIsAnimationOpen(false);
      
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive"
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
    
    // Create a temporary user message with a truly unique ID using the same approach
    // as the typing indicators for consistency and guaranteed uniqueness
    // Use a distinctive prefix 'user-temp-' to avoid any possibility of ID overlap with typing indicators
    const timestamp = Date.now();
    const randomPart1 = Math.random().toString(36).substring(2, 10);
    const randomPart2 = Math.random().toString(36).substring(2, 10);
    const randomNumber = Math.floor(Math.random() * 100000000);
    // Combine all these elements to create a very unique ID that cannot possibly collide
    const uniqueId = `user-temp-${timestamp}-${randomPart1}-${randomPart2}-${randomNumber}`;
    
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
  
  // Navigate to the summary page
  const handleViewSummary = () => {
    if (summaryUrl) {
      console.log(`Navigating to summary page: ${summaryUrl}`);
      setLocation(summaryUrl);
    } else {
      // Fallback in case summaryUrl is not set
      const summaryPath = secureId 
        ? `/summary/s/${secureId}` 
        : `/summary/${debate?.id}`;
      console.log(`Navigating to summary page (fallback): ${summaryPath}`);
      setLocation(summaryPath);
    }
  };

  // Handle ending debate and generating summary
  const handleEndDebate = () => {
    // If debate is already completed, just navigate to the summary
    if (debate?.completed && debate?.summary) {
      console.log("Debate already completed, showing summary");
      handleViewSummary();
      return;
    }
    
    console.log("Ending debate and generating summary");
    endDebateMutation.mutate();
  };
  
  // Monitor debate state to update when completed
  useEffect(() => {
    if (!debate) return;
    
    if (debate.completed && debate.summary) {
      // Store the summary URL for later navigation
      const summaryPath = secureId 
        ? `/summary/s/${secureId}` 
        : `/summary/${debate.id}`;
      
      // Set the summary URL if it's not already set
      if (!summaryUrl) {
        setSummaryUrl(summaryPath);
      }
      
      // If animation is not currently showing, set to chat view
      if (!isAnimationOpen && !isNotificationOpen) {
        setViewStateWithLogging('chat');
      }
    } else {
      // ONLY change to chat view if we're not currently animating
      // This prevents the race condition where this effect resets the view during summary generation
      if (!isAnimationOpen && !isNotificationOpen) {
        setViewStateWithLogging('chat');
      }
    }
  }, [debate, secureId, summaryUrl, isAnimationOpen, isNotificationOpen]);
  
  // Global cleanup effect
  useEffect(() => {
    // Reset polling state on mount to ensure clean state
    setMessageStatus(prev => ({ ...prev, polling: false }));
    
    // Clear any typing indicators that might be lingering from previous sessions
    setLocalMessages(prev => prev.filter(msg => !msg.id.startsWith('typing-')));
    
    // Return cleanup function
    return () => {
      // Reset message status when component unmounts
      setMessageStatus(prev => ({ ...prev, sending: false, polling: false }));
      
      // Reset animation tracking to prevent blank screens due to stale state
      window.currentAnimationId = undefined;
      
      // Extra logging to help troubleshoot prod issues
      console.log("DEBATE PAGE UNMOUNTED: Cleaned up animation state");
    };
  }, []);
  
  // Combined loading state
  const isLoading = isLoadingDebate || isLoadingParty;
  
  if (isLoading && viewState === 'loading') {
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
    <div id="debate-container" className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-screen">
        <MobileHeader />
        
        {/* Chat View - Always displayed */}
        <ChatInterface 
          messages={localMessages.length > 0 ? localMessages : (debate?.messages || [])}
          isLoading={messageStatus.sending || messageStatus.polling}
          onSendMessage={handleSendMessage}
          onEndDebate={handleEndDebate}
          partyShortName={party?.shortName}
          userTyping={isUserTyping}
          maxRounds={debate?.maxRounds || 3}
          isGeneratingSummary={isAnimationOpen}
        />
        <ChatInput 
          onSendMessage={handleSendMessage}
          isLoading={messageStatus.sending || messageStatus.polling || isAnimationOpen}
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
            
            // CASE 4: When generating a summary or summary is ready
            isAnimationOpen || isNotificationOpen
          }
          disabledReason={
            // Determine the reason for disabling:
            
            // PRIORITY 1: When generating a summary or summary is ready
            isAnimationOpen
              ? 'generating'
            : isNotificationOpen
              ? 'summaryReady'
            
            // PRIORITY 2: When at maximum allowed rounds
            : (messageStatus.finalRoundReached || 
              debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 3))
                ? 'finalRound'
            
            // PRIORITY 3: When waiting for the bot to respond
            : (messageStatus.sending || messageStatus.polling ||
               (debate?.messages && debate.messages.length > 0 && 
                debate.messages[debate.messages.length - 1].role === 'user'))
                ? 'waiting'
            
            // PRIORITY 4: Default state
            : 'maxRounds'
          }
        />
        
        {/* Direct Animation Components (no portal) */}
        {isAnimationOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 max-w-md w-full">
              <div className="flex flex-col items-center">
                {/* Animation Title */}
                <h2 className="text-2xl font-bold mb-6 text-center">
                  Generating Debate Summary...
                </h2>
                
                {/* Processing Indicator */}
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
                
                {/* Loading Indicator */}
                <div className="flex items-center justify-center w-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                  <span>Please wait...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Summary Ready Notification (embedded directly) */}
        {isNotificationOpen && (
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
                  onClick={() => {
                    try {
                      setIsNotificationOpen(false);
                      if (summaryUrl) {
                        setLocation(summaryUrl);
                      } else {
                        // Fallback in case summaryUrl is not set
                        const summaryPath = secureId 
                          ? `/summary/s/${secureId}` 
                          : `/summary/${debate?.id}`;
                        setLocation(summaryPath);
                      }
                    } catch (error) {
                      console.error("Error viewing summary:", error);
                      try {
                        // Fallback navigation
                        window.location.href = window.location.href.replace('/debate/', '/summary/');
                      } catch (e) {
                        console.error("Even fallback navigation failed:", e);
                      }
                    }
                  }}
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