import { useRef, useEffect, useState } from "react";
import MessageBubble from "./message-bubble";
import { Message } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Check, Calendar, CalendarPlus } from "lucide-react";

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
  
  // Filter out system messages
  const filteredMessages = messages.filter(msg => msg.role !== "system");
  
  // Calculate the current round based on user messages
  const userMessages = filteredMessages.filter(msg => msg.role === "user");
  // Each round is one user message (assistant responses don't count toward the round number)
  const currentRound = Math.min(userMessages.length, maxRounds);
  
  // We now rely on the parent component to decide when to show/hide extension options
  // This resolves state synchronization issues between debate-page.tsx and chat-interface.tsx
  
  // Compute whether to show inline extension options based on parent props
  const showInlineExtensionOptions = 
    currentRound === maxRounds && 
    maxRounds < 8 && 
    !isExtendingRounds && 
    !isLoading;

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
            <p>Start a conversation with the {partyShortName} Unofficial Fanbot. You can discuss any policy position or political topic relevant to Singapore.</p>
            
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
        
        {/* In-chat round extension options */}
        {showInlineExtensionOptions && !isExtendingRounds && (
          <div className="flex w-full mb-4 animate-fadeIn">
            <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
              <span className="text-white font-bold text-xs">SYS</span>
            </div>
            <div className="bg-white p-4 rounded-lg rounded-tl-none shadow-sm max-w-[85%]">
              <p className="text-sm font-medium mb-2">You've completed {maxRounds} rounds of your debate.</p>
              <p className="text-sm text-gray-600 mb-3">Would you like to extend your debate with more rounds or generate a summary now?</p>
              
              <div className="flex flex-col space-y-2">
                {/* Medium debate option */}
                {maxRounds < 6 && (
                  <Button 
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => {
                      // Only proceed if we're not already at or above this round count
                      if (maxRounds < 6) {
                        setTimeout(() => {
                          if (onExtendRounds) {
                            console.log("Extending to 6 rounds");
                            onExtendRounds(6);
                          }
                        }, 100);
                      }
                    }}
                    disabled={isExtendingRounds || maxRounds >= 6}
                  >
                    <Calendar className="h-4 w-4 text-amber-500" />
                    <span>Add {6 - maxRounds} more rounds (total: 6)</span>
                  </Button>
                )}
                
                {/* Extended debate option */}
                {maxRounds < 8 && (
                  <Button 
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => {
                      // Only proceed if we're not already at or above this round count
                      if (maxRounds < 8) {
                        setTimeout(() => {
                          if (onExtendRounds) {
                            console.log("Extending to 8 rounds");
                            onExtendRounds(8);
                          }
                        }, 100);
                      }
                    }}
                    disabled={isExtendingRounds || maxRounds >= 8}
                  >
                    <CalendarPlus className="h-4 w-4 text-emerald-500" />
                    <span>Add {8 - maxRounds} more rounds (maximum: 8)</span>
                  </Button>
                )}
                
                {/* End debate option */}
                <Button 
                  variant="default"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => {
                    setTimeout(() => {
                      if (onEndDebate) {
                        console.log("Ending debate and generating summary");
                        onEndDebate();
                      }
                    }, 100);
                  }}
                  disabled={isExtendingRounds}
                >
                  <Check className="h-4 w-4" />
                  <span>End debate and generate summary</span>
                </Button>
              </div>
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
    </>
  );
}