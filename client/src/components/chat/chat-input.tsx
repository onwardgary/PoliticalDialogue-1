import { useState, useRef, FormEvent, KeyboardEvent } from "react";
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
};

export default function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
      // Focus back on textarea after sending
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send message on Ctrl+Enter or Cmd+Enter (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (message.trim() && !isLoading) {
        handleSubmit(e as unknown as FormEvent);
      }
    }
  };

  return (
    <div className="bg-white border-t border-neutral-200 p-4">
      <form className="flex items-end" onSubmit={handleSubmit}>
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            placeholder="Type your message... (Ctrl+Enter to send)"
            className="w-full resize-none pr-10 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            autoFocus
          />
          <div className="absolute bottom-2 right-3 flex items-center gap-2">
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
          className="ml-2 min-h-[60px] px-4" 
          disabled={!message.trim() || isLoading}
        >
          {isLoading ? (
            <span className="animate-pulse">Sending...</span>
          ) : (
            <>
              <SendIcon className="h-4 w-4 mr-2" />
              Send
            </>
          )}
        </Button>
      </form>
      <div className="flex justify-between mt-2 text-xs text-neutral-500">
        <div>
          <kbd className="px-1 py-0.5 text-xs text-neutral-700 bg-neutral-100 border border-neutral-300 rounded">Ctrl+Enter</kbd>
          <span className="ml-1">to send</span>
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
