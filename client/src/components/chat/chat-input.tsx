import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendIcon, InfoIcon, SmileIcon } from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ChatInputProps = {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onTypingStateChange?: (isTyping: boolean) => void;
  disabled?: boolean;
  disabledReason?: 'waiting' | 'maxRounds' | 'finalRound' | 'generating';
};

export default function ChatInput({ 
  onSendMessage, 
  isLoading, 
  onTypingStateChange, 
  disabled = false,
  disabledReason = 'maxRounds'
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_CHARS = 560; // Doubled character limit for users
  
  // Handle sending the message
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && message.length <= MAX_CHARS) {
      // Capture the message to send
      const messageToSend = message;
      
      // Clear input field immediately before any processing (for instant UI feedback)
      setMessage("");
      
      // Reset textarea height immediately
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      // Stop typing indicator immediately
      if (onTypingStateChange) {
        onTypingStateChange(false);
      }
      
      // Clear any existing typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      // Immediately focus back on textarea for better UX (no delay)
      textareaRef.current?.focus();
      
      // Finally send the message (after UI is updated)
      onSendMessage(messageToSend);
    }
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send message on Ctrl+Enter or Cmd+Enter (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (message.trim() && !isLoading && message.length <= MAX_CHARS) {
        handleSubmit(e as unknown as FormEvent);
      }
    }
  };
  
  // Calculate remaining characters
  const remainingChars = MAX_CHARS - message.length;
  const isOverLimit = remainingChars < 0;

  // Auto-adjust height of textarea effect
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = Math.min(textareaRef.current.scrollHeight, 100); // Max 100px height on mobile
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [message]);

  return (
    <div className="bg-white border-t border-neutral-200 p-4 pb-safe sticky bottom-0 z-20">
      <form className="flex items-end" onSubmit={handleSubmit}>
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            placeholder={
              disabled 
                ? disabledReason === 'waiting'
                  ? "Waiting for Unofficial Fanbot response..." 
                  : disabledReason === 'finalRound'
                    ? "Maximum rounds reached. Debate complete."
                    : disabledReason === 'generating'
                      ? "Generating debate summary..."
                      : "Maximum rounds reached. End debate to continue."
                : "Type your message... (Ctrl+Enter to send)"
            }
            className={`w-full resize-none pr-10 min-h-[45px] md:min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary ${disabled ? 'bg-neutral-100 text-neutral-500' : ''}`}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              
              // Handle typing indicator
              if (onTypingStateChange && !disabled) {
                // User is typing
                onTypingStateChange(true);
                
                // Clear any existing typing timeout
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }
                
                // Set a new timeout to turn off typing indicator after 1 second of inactivity
                typingTimeoutRef.current = setTimeout(() => {
                  onTypingStateChange(false);
                  typingTimeoutRef.current = null;
                }, 1000);
              }
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading || disabled}
            autoFocus={!disabled}
          />
          {/* Character counter on mobile */}
          {message.length > 0 && (
            <div className="absolute bottom-2 right-10 text-xs text-neutral-400 md:hidden">
              <span className={isOverLimit ? 'text-red-500 font-medium' : ''}>
                {message.length}/{MAX_CHARS}
              </span>
            </div>
          )}
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="text-neutral-400 hover:text-neutral-600 h-7 w-7"
              disabled={isLoading}
            >
              <SmileIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Button 
          type="submit" 
          className="ml-2 min-h-[45px] md:min-h-[60px] px-4 transition-all duration-100" 
          disabled={!message.trim() || isLoading || isOverLimit || disabled}
        >
          {isLoading ? (
            <span className="animate-pulse text-primary-foreground/80">Sent</span>
          ) : disabled ? (
            <span className="text-primary-foreground/60">
              {disabledReason === 'waiting'
                ? "Fanbot is typing..."
                : disabledReason === 'finalRound'
                  ? "Debate Complete"
                  : disabledReason === 'generating'
                    ? "Generating Summary"
                    : "Round Limit"
              }
            </span>
          ) : (
            <>
              <SendIcon className="h-4 w-4 mr-2" />
              Send
            </>
          )}
        </Button>
      </form>
      <div className="flex justify-between mt-2 text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <kbd className="px-1 py-0.5 text-xs text-neutral-700 bg-neutral-100 border border-neutral-300 rounded">Ctrl+Enter</kbd>
          <span className="ml-1">to send</span>
          <span className={`ml-2 ${isOverLimit ? 'text-red-500 font-medium' : remainingChars <= 100 ? 'text-amber-500' : ''}`}>
            {isOverLimit ? `${Math.abs(remainingChars)} over limit` : `${remainingChars} left`}
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="link" size="sm" className="text-xs text-neutral-500 hover:underline flex items-center p-0 h-auto">
                <InfoIcon className="h-3 w-3 mr-1" /> 
                How we use your debate data
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">
                Your debate data is used to generate aggregated summaries. 
                Personal information is never shared publicly.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
