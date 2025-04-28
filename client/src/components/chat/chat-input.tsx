import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Layers, InfoIcon, SmileIcon } from "lucide-react";
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  return (
    <div className="bg-white border-t border-neutral-200 p-4">
      <form className="flex items-end" onSubmit={handleSubmit}>
        <div className="flex-1 relative">
          <Textarea
            placeholder="Type your message..."
            className="w-full resize-none pr-10 min-h-[80px]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isLoading}
          />
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            className="absolute right-3 bottom-3 text-neutral-400 hover:text-neutral-600"
            disabled={isLoading}
          >
            <SmileIcon className="h-5 w-5" />
          </Button>
        </div>
        <Button 
          type="submit" 
          className="ml-2 px-4 py-3 h-[80px]" 
          disabled={!message.trim() || isLoading}
        >
          <Layers className="h-5 w-5" />
        </Button>
      </form>
      <div className="flex justify-center mt-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="link" size="sm" className="text-xs text-neutral-500 hover:underline flex items-center">
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
