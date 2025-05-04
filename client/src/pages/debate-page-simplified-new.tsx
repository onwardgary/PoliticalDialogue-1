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
  
  // Animation state is now managed by the UIState machine
  
  // Track component mounting status
  const isMounted = useRef(true);
  
  // Add a local cache of messages for immediate updates
  // This bypasses React Query's asynchronous cache updates
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  
  // Add a ref to track messages for closures in async operations
  // This helps avoid stale state references in event handlers and callbacks
  const localMessagesRef = useRef<Message[]>([]);
  
  // Add a ref to track the polling interval
  // This allows us to clear the interval on unmount or when we're done polling
  const pollingRef = useRef<number>();
  
  // Add a ref to track polling attempts for React Query
  // This centralizes the polling logic within React Query's refetchInterval
  const attemptsRef = useRef<number>(0);
  
  // Define a union type for UI state management using the state machine pattern
  type UIState = 
    | { status: 'loading' }
    | { status: 'chat' }
    | { status: 'animating' }
    | { status: 'summaryReady'; url: string };
  
  // Initialize the UI state
  const [ui, setUI] = useState<UIState>({ status: 'loading' });
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      
      // Clear any polling interval on unmount
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = undefined;
      }
    };
  }, []);
  
  // Keep the ref in sync with the state
  useEffect(() => {
    // Update the ref whenever localMessages changes
    localMessagesRef.current = localMessages;
  }, [localMessages]);
  
  // Helper to set UI state with logging using functional update to ensure latest state
  const setUIWithLogging = (newState: UIState) => {
    if (isMounted.current) {
      setUI(prevState => {
        console.log(`Changing UI state from ${prevState.status} to ${newState.status}`);
        return newState;
      });
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
  
  // Constant for maximum polling attempts
  const MAX_POLLING_ATTEMPTS = 30; // About 60 seconds of polling at varying intervals
  
  // Fetch debate data
  const { data: debate, isLoading: isLoadingDebate } = useQuery({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      // Use the ref for attempt counting
      const currentAttempt = attemptsRef.current + 1;
      console.log(`Fetching debate data from: ${apiEndpoint} (attempt ${currentAttempt}/${MAX_POLLING_ATTEMPTS})`);
      
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
      
      // Update local messages unless debate is completed - using functional update
      if (data.messages) {
        setLocalMessages(_prev => {
          // If debate is completed, we clear local messages since the UI will show 
          // from the debate state directly. Otherwise, use the fetched messages.
          return !data.completed ? data.messages : [];
        });
      }
      
      return data;
    },
    refetchOnWindowFocus: true,
    refetchInterval: (data: any) => {
      // Centralize polling logic here with ref-based counter
      // It's safe to increment the ref counter here as it won't trigger re-renders
      attemptsRef.current = attemptsRef.current + 1;
      
      // If we've reached max attempts, stop polling
      if (attemptsRef.current >= MAX_POLLING_ATTEMPTS) {
        console.log(`Maximum polling attempts (${MAX_POLLING_ATTEMPTS}) reached, stopping automatic polling`);
        return false;
      }
      
      // If debate is completed, stop polling
      if (data?.completed) {
        console.log("Debate is completed, stopping polling");
        // Reset the attempts counter for next time
        attemptsRef.current = 0;
        return false;
      }
      
      const messages = data?.messages || [];
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      
      // More frequent polling when waiting for AI response
      if (lastMessage?.role === 'user') {
        console.log(`Waiting for bot response, polling every 1 second (attempt ${attemptsRef.current}/${MAX_POLLING_ATTEMPTS})`);
        return 1000;
      }
      
      // Adaptive polling based on conversation activity
      const lastMessageTime = lastMessage?.timestamp || 0;
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      
      // Regular polling for active conversations (within the last minute)
      if (timeSinceLastMessage < 60000) {
        console.log(`Active conversation, polling every 3 seconds (attempt ${attemptsRef.current}/${MAX_POLLING_ATTEMPTS})`);
        return 3000;
      }
      
      // Gradually reduce polling frequency for inactive conversations
      // Use exponential backoff: 10s, 15s, 22.5s, etc. up to 60s
      const backoffTime = Math.min(10000 * Math.pow(1.5, Math.floor(attemptsRef.current / 5)), 60000);
      console.log(`Inactive conversation, polling with backoff: ${backoffTime}ms (attempt ${attemptsRef.current}/${MAX_POLLING_ATTEMPTS})`);
      return backoffTime;
    },
    enabled: !!(id || secureId) && !messageStatus.sending,
    // Add stale time to prevent unnecessary refetches
    staleTime: 5000,
    // Add garbage collection time
    gcTime: 5 * 60 * 1000, // 5 minutes
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
        // First remove any existing typing indicators to prevent duplicates
        const messagesWithoutTyping = prev.filter(msg => !msg.id.startsWith('typing-'));
        
        // Then update user temp messages with confirmed message
        const messagesWithUpdatedUser = messagesWithoutTyping.map((msg: Message) => {
          if (msg.id.startsWith('user-temp-')) {
            return data.userMessage;
          }
          return msg;
        });
        
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
        
        // Return messages with updated user message and new typing indicator
        return [...messagesWithUpdatedUser, typingIndicatorMessage];
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
      
      // Explicitly set polling state to true when we start polling
      setMessageStatus(prev => ({ ...prev, polling: true }));
      
      // Start polling for AI response
      let pollCount = 0;
      let currentDelay = 1000;
      let hasReceivedResponse = false;
      
      // Clear any existing polling interval first
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = undefined;
      }
      
      // Store the interval ID in the ref
      pollingRef.current = window.setInterval(() => {
        pollCount++;
        
        if (pollCount <= 30 && !hasReceivedResponse) {
          // Use direct fetch for polling
          fetch(apiEndpoint, {
            headers: { 'Cache-Control': 'no-cache' }
          })
          .then(response => response.json())
          .then(fetchedData => {
            const currentMessageCount = fetchedData?.messages?.length || 0;
            
            // Use the ref instead of the state to avoid stale closures
            const currentMessages = localMessagesRef.current;
            const currentLocalCount = currentMessages.length;
            
            // Only compare with real messages
            const realLocalMessages = currentMessages.filter(msg => !msg.id.startsWith('typing-')).length;
            
            if (currentMessageCount > realLocalMessages) {
              hasReceivedResponse = true;
              
              const latestAIMessage = fetchedData.messages[fetchedData.messages.length - 1];
              
              // IMPORTANT: First, immediately stop the polling state to prevent duplicate typing indicators
              // Add a small delay to ensure the state update happens after the current event loop
              setTimeout(() => {
                setMessageStatus(prev => ({ ...prev, polling: false }));
                console.log("RESET POLLING STATE: Explicitly resetting polling state to enable text input");
              }, 10);
              
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
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = undefined;
              }
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
            
            // Reset the polling state with a small delay to ensure the state update happens properly
            setTimeout(() => {
              setMessageStatus(prev => ({ ...prev, polling: false }));
              console.log("RESET POLLING STATE: Explicitly resetting polling state due to max attempts");
            }, 10);
            
            // Show error toast
            toast({
              title: "Connection issue",
              description: "Having trouble getting a response. Please try again.",
              variant: "destructive",
            });
          }
          
          // Clean up interval
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = undefined;
          }
        }
      }, 1000);
    },
    onError: (error) => {
      // Reset state on error with a small delay to ensure proper state updates
      setTimeout(() => {
        setMessageStatus(prev => ({ ...prev, sending: false, polling: false }));
        console.log("RESET POLLING STATE: Explicitly resetting polling state after error");
      }, 10);
      
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
      
      // Show the animation immediately by setting state to 'animating'
      setUIWithLogging({ status: 'animating' });
      
      try {
        // Make the API call directly
        const response = await apiRequest("POST", endDebateEndpoint);
        const data = await response.json();
        
        // Update the query cache with the new debate data using functional update
        queryClient.setQueryData([apiEndpoint], (oldData: any) => {
          if (!oldData) return data;
          return {
            ...oldData,
            ...data,
            updatedAt: new Date().toISOString()
          };
        });
        
        // Prepare the summary path
        const summaryPath = secureId 
          ? `/summary/s/${secureId}` 
          : `/summary/${debate?.id}`;
        
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
      
      // After a short delay, switch to summary ready state with the URL
      // Using setTimeout but with functional update inside it
      setTimeout(() => {
        setUIWithLogging({ status: 'summaryReady', url: data.path });
      }, 500);
    },
    onError: (error) => {
      console.error("Error in endDebateMutation:", error);
      // Return to chat state on error
      setUIWithLogging({ status: 'chat' });
      
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
    // Use ref instead of state to avoid stale closure issues
    const currentMessages = localMessagesRef.current;
    const userMessagesCount = currentMessages.filter(msg => msg.role === 'user').length + 1; // +1 for the new message
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
    if (ui.status === 'summaryReady') {
      // We already have the URL in the state
      console.log(`Navigating to summary page: ${ui.url}`);
      setLocation(ui.url);
    } else {
      // Fallback in case we need to construct the URL
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
    
    // Only update the UI state if it's currently loading
    if (ui.status === 'loading') {
      // Set UI state to chat mode when debate data is loaded
      setUIWithLogging({ status: 'chat' });
    }
    
    // If debate is completed and has a summary but we're not already in an animation
    // or summary state, it means we loaded a page with an existing completed debate
    if (debate.completed && debate.summary && ui.status === 'chat') {
      // Keep track of the summary path for potential navigation
      const summaryPath = secureId 
        ? `/summary/s/${secureId}` 
        : `/summary/${debate.id}`;
      
      // We could update the button state here or add a "View Summary" button
      // but we'll just leave it in chat mode for now, as the navigation is
      // handled by handleEndDebate based on the debate.completed state
    }
  }, [debate, secureId, ui.status]);
  
  // Global cleanup effect
  useEffect(() => {
    // Set isMounted flag
    isMounted.current = true;
    
    // Reset polling state and counters on mount with a small delay to ensure clean state
    setTimeout(() => {
      setMessageStatus(prev => ({ ...prev, polling: false, sending: false }));
      console.log("RESET POLLING STATE: Resetting states on component mount");
    }, 10);
    
    attemptsRef.current = 0;
    
    // Clear any typing indicators that might be lingering from previous sessions
    setLocalMessages(prev => prev.filter(msg => !msg.id.startsWith('typing-')));
    
    // Return comprehensive cleanup function
    return () => {
      // Reset message status when component unmounts
      setMessageStatus(prev => ({ ...prev, sending: false, polling: false }));
      
      // Clean up any lingering polling intervals
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = undefined;
      }
      
      // Cancel any in-flight queries to prevent memory leaks and unnecessary processing
      queryClient.cancelQueries({ queryKey: [apiEndpoint] });
      
      // Reset all refs
      attemptsRef.current = 0;
      localMessagesRef.current = [];
      pollingRef.current = undefined;
      isMounted.current = false;
      
      // Reset global animation tracking to prevent blank screens due to stale state
      window.currentAnimationId = undefined;
      
      // Extra logging to help troubleshoot prod issues
      console.log("DEBATE PAGE UNMOUNTED: Comprehensive cleanup completed - reset refs, canceled queries, cleared intervals");
    };
  }, [apiEndpoint]);
  
  // Combined loading state
  const isLoading = isLoadingDebate || isLoadingParty;
  
  if (isLoading && ui.status === 'loading') {
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
    
  // Debug logging for message status - helpful to find why input remains disabled
  useEffect(() => {
    console.log("DISABLED STATE CHECK:", {
      sending: messageStatus.sending,
      polling: messageStatus.polling,
      finalRoundReached: messageStatus.finalRoundReached,
      lastMessageIsUser: debate?.messages && debate.messages.length > 0 && 
                          debate.messages[debate.messages.length - 1].role === 'user',
      animatingOrSummaryReady: ui.status === 'animating' || ui.status === 'summaryReady',
      uiState: ui.status
    });
  }, [messageStatus, debate?.messages, ui.status]);
  
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
          isGeneratingSummary={ui.status === 'animating'}
        />
        <ChatInput 
          onSendMessage={handleSendMessage}
          isLoading={messageStatus.sending || messageStatus.polling || ui.status === 'animating'}
          onTypingStateChange={setIsUserTyping}
          disabled={
            // Disable input in these scenarios:
            
            // CASE 1: While waiting for AI response (disable immediately after sending)
            messageStatus.sending || messageStatus.polling ||
            
            // CASE 2: When at max rounds (any number) - permanent disabling
            messageStatus.finalRoundReached ||
            (debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 3)) ||
            
            // CASE 3: Always disable when the last message is from the user (waiting for bot)
            // This is a critical change: we're checking localMessages instead of debate.messages
            // because localMessages is updated immediately when a response is received
            ((localMessages.length > 0 ? localMessages : debate?.messages)?.length > 0 && 
             (localMessages.length > 0 ? localMessages : debate?.messages)
               [localMessages.length > 0 ? localMessages.length - 1 : (debate?.messages?.length || 0) - 1]?.role === 'user') ||
            
            // CASE 4: When generating a summary or summary is ready
            ui.status === 'animating' || ui.status === 'summaryReady'
          }
          disabledReason={
            // Determine the reason for disabling:
            
            // PRIORITY 1: When generating a summary or summary is ready
            ui.status === 'animating'
              ? 'generating'
            : ui.status === 'summaryReady'
              ? 'summaryReady'
            
            // PRIORITY 2: When at maximum allowed rounds
            : (messageStatus.finalRoundReached || 
              debate?.messages?.filter((msg: Message) => msg.role === 'user').length >= (debate?.maxRounds || 3))
                ? 'finalRound'
            
            // PRIORITY 3: When waiting for the bot to respond
            : (messageStatus.sending || messageStatus.polling ||
               // Critical change: use localMessages to check if the last message is from the user
               ((localMessages.length > 0 ? localMessages : debate?.messages)?.length > 0 && 
                (localMessages.length > 0 ? localMessages : debate?.messages)
                  [localMessages.length > 0 ? localMessages.length - 1 : (debate?.messages?.length || 0) - 1]?.role === 'user'))
                ? 'waiting'
            
            // PRIORITY 4: Default state
            : 'maxRounds'
          }
        />
        
        {/* Direct Animation Components (no portal) */}
        {ui.status === 'animating' && (
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
        {ui.status === 'summaryReady' && (
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
                      // Change state back to chat before navigating
                      setUIWithLogging({ status: 'chat' });
                      
                      // Use the URL from the state
                      setLocation(ui.url);
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