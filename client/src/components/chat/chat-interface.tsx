import { useRef, useEffect, useState } from "react";
import MessageBubble from "./message-bubble";
import { Message } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, Check, Calendar, CalendarPlus } from "lucide-react";

type ChatInterfaceProps = {
  messages: Message[];
  isLoading: boolean;
  onSendMessage?: (message: string) => void;
  onExtendRounds?: (rounds: number) => void;
  onEndDebate?: () => void;
  partyShortName?: string;
  userTyping?: boolean;
  maxRounds?: number;
  isExtendingRounds?: boolean;
};

// Suggested topics to help start the conversation
const SUGGESTED_TOPICS = [
  { topic: "Housing affordability", prompt: "What is your stance on housing affordability in Singapore?" },
  { topic: "Immigration policy", prompt: "How do you think Singapore should manage immigration?" },
  { topic: "Healthcare costs", prompt: "What solutions do you propose for rising healthcare costs?" },
  { topic: "Cost of living", prompt: "How would you address the increasing cost of living?" },
  { topic: "Public transport", prompt: "What are your plans to improve public transportation?" },
];

export default function ChatInterface({ 
  messages, 
  isLoading, 
  onSendMessage, 
  onExtendRounds, 
  onEndDebate, 
  partyShortName = "BOT", 
  userTyping = false, 
  maxRounds = 6,
  isExtendingRounds = false
}: ChatInterfaceProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showRoundExtensionDialog, setShowRoundExtensionDialog] = useState(false);
  
  // Filter out system messages
  const filteredMessages = messages.filter(msg => msg.role !== "system");
  
  // Calculate the current round based on user messages
  const userMessages = filteredMessages.filter(msg => msg.role === "user");
  // Each round is one user message (assistant responses don't count toward the round number)
  const currentRound = Math.min(userMessages.length, maxRounds);
  
  // Detect if we've reached the max rounds and need to show the extension dialog
  useEffect(() => {
    // Only show extension dialog if:
    // 1. We've reached the max rounds (currentRound === maxRounds)
    // 2. The max rounds is not already at the maximum (8)
    // 3. We have the extension handler available
    // 4. The dialog is not already open
    // 5. Not currently extending rounds (prevents reopening during API call)
    if (currentRound === maxRounds && maxRounds < 8 && onExtendRounds && !showRoundExtensionDialog && !isExtendingRounds) {
      setShowRoundExtensionDialog(true);
    } else if (isExtendingRounds && showRoundExtensionDialog) {
      // Force close the dialog when extension is in progress
      setShowRoundExtensionDialog(false);
    }
  }, [currentRound, maxRounds, onExtendRounds, showRoundExtensionDialog, isExtendingRounds]);

  // Auto-scroll to bottom when messages change or typing indicators appear - optimized for responsiveness
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    
    // Always auto-scroll when the user sends a new message
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const isLastMessageFromUser = lastMessage && lastMessage.role === "user";
    
    // Auto-scroll immediately if:
    // 1. User is already near the bottom
    // 2. User just sent a message (their message should always be visible)
    // 3. User is typing (typing indicator should be visible)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
    
    // Immediate scroll for user messages - no animation delay for better responsiveness
    if (isLastMessageFromUser) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    
    if (isNearBottom || userTyping) {
      // Use sync scrolling for user typing and when near bottom
      container.scrollTop = container.scrollHeight;
    } else if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
      // Show scroll button if we received a new message and didn't scroll
      setShowScrollButton(true);
    }
  }, [messages, isLoading, userTyping]);

  // Handle scroll events to show/hide scroll button
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom) {
        setShowScrollButton(false);
      }
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      setShowScrollButton(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (prompt: string) => {
    if (onSendMessage) {
      onSendMessage(prompt);
    }
  };

  // Show suggested topics only if this is the first message (just the welcome message)
  const showSuggestions = filteredMessages.length <= 1 && !isLoading;

  return (
    <>
      <div 
        ref={chatContainerRef}
        className="chat-container bg-neutral-50 overflow-y-auto p-4 md:p-6 flex flex-col space-y-4"
        style={{ height: "calc(100vh - 180px - env(safe-area-inset-bottom, 0px))" }}
      >
        {/* System welcome message */}
        <div className="flex justify-center mb-4">
          <div className="bg-neutral-100 rounded-2xl px-4 py-3 text-sm text-neutral-700 max-w-md text-center shadow-sm">
            <p>Start a conversation with the {partyShortName} bot. You can discuss any policy position or political topic relevant to Singapore.</p>
            
            {/* Round indicator */}
            <div className="mt-2 flex items-center justify-center space-x-1">
              <span className="text-xs text-neutral-500">Round {currentRound} of {maxRounds}</span>
              <div className="ml-2 bg-neutral-200 h-1.5 rounded-full w-24 overflow-hidden">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${(currentRound / maxRounds) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Suggested topics */}
        {showSuggestions && onSendMessage && (
          <div className="flex flex-col items-center mb-4 space-y-3">
            <p className="text-xs text-neutral-500 font-medium">SUGGESTED TOPICS</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_TOPICS.map((item, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-sm bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700"
                  onClick={() => handleSuggestionClick(item.prompt)}
                >
                  {item.topic}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {filteredMessages.map((message, index) => {
          // Check if this message should be grouped with the previous one (same sender)
          const previousMessage = index > 0 ? filteredMessages[index - 1] : null;
          const isGrouped = previousMessage && previousMessage.role === message.role ? true : false;
          
          return (
            <MessageBubble 
              key={message.id} 
              message={message}
              partyShortName={partyShortName}
              isGrouped={isGrouped}
            />
          );
        })}

        {/* Bot typing indicator */}
        {isLoading && (
          <div className="flex mb-4 animate-fadeIn">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-2 flex-shrink-0">
              <span className="text-white font-bold text-xs">{partyShortName}</span>
            </div>
            <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm flex items-center h-10">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-neutral-300 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* User typing indicator */}
        {userTyping && (
          <div className="flex mb-4 animate-fadeIn justify-end">
            <div className="bg-primary/10 p-3 rounded-lg rounded-tr-none shadow-sm flex items-center h-10">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
            <div className="w-8 h-8 bg-primary/90 rounded-full flex items-center justify-center ml-2 flex-shrink-0">
              <span className="text-white font-bold text-xs">YOU</span>
            </div>
          </div>
        )}
        
        {/* Scroll to bottom button */}
        {showScrollButton && (
          <div className="sticky bottom-4 w-full flex justify-center pointer-events-none">
            <Button 
              size="sm"
              onClick={scrollToBottom}
              className="bg-primary text-white rounded-full shadow-md pointer-events-auto animate-bounce-slow opacity-90 hover:opacity-100"
            >
              ↓ New message
            </Button>
          </div>
        )}
      </div>
      
      {/* Round extension dialog - moved outside main container */}
      <AlertDialog open={showRoundExtensionDialog} onOpenChange={setShowRoundExtensionDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>You've reached round {maxRounds}</AlertDialogTitle>
            <AlertDialogDescription>
              You've reached the maximum number of rounds for this debate. Would you like to extend the debate or generate a summary now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col space-y-3 p-3 my-3 bg-neutral-50 rounded-lg border border-neutral-100">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3"
                onClick={() => {
                  // First close the dialog immediately
                  setShowRoundExtensionDialog(false); 
                  // Only proceed if we're not already at or above this round count
                  if (maxRounds < 6) {
                    // Add a small delay to ensure dialog is fully closed before API call
                    setTimeout(() => {
                      if (onExtendRounds) onExtendRounds(6);
                    }, 100);
                  }
                }}
                disabled={isExtendingRounds || maxRounds >= 6}
              >
                <Calendar className="h-5 w-5 text-amber-500" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">Medium Debate</span>
                  <span className="text-xs text-neutral-500">6 rounds</span>
                </div>
              </Button>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="lg"
                className="w-full justify-start gap-3"
                onClick={() => {
                  // First close the dialog immediately, then process the extension
                  setShowRoundExtensionDialog(false);
                  // Add a small delay to ensure dialog is fully closed before API call
                  setTimeout(() => {
                    if (onExtendRounds) onExtendRounds(8);
                  }, 100);
                }}
                disabled={isExtendingRounds || maxRounds >= 8}
              >
                <CalendarPlus className="h-5 w-5 text-emerald-500" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">Extended Debate</span>
                  <span className="text-xs text-neutral-500">8 rounds (maximum)</span>
                </div>
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <Button 
              variant="default"
              onClick={() => {
                // First close the dialog immediately, then process ending debate
                setShowRoundExtensionDialog(false);
                // Add a small delay to ensure dialog is fully closed before API call
                setTimeout(() => {
                  if (onEndDebate) onEndDebate();
                }, 100);
              }}
              disabled={isExtendingRounds}
              className="w-full"
            >
              <Check className="h-4 w-4 mr-2" />
              End debate and generate summary
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}