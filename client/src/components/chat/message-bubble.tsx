import { format } from "date-fns";
import { Message } from "@shared/schema";
import { cn } from "@/lib/utils";

type MessageBubbleProps = {
  message: Message;
  partyShortName?: string;
};

export default function MessageBubble({ message, partyShortName = "BOT" }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const formattedTime = format(new Date(message.timestamp), "h:mm a");

  // Format the content to handle paragraphs and lists
  const formatContent = (content: string) => {
    // Check if content contains a list with numbers
    if (content.match(/\d+\.\s.+/g)) {
      const parts = content.split(/(?=\d+\.\s)/);
      return (
        <>
          {parts.map((part, index) => {
            if (part.match(/^\d+\.\s/)) {
              // It's a list item
              return <li key={index} className="ml-4">{part}</li>;
            } else {
              // It's a paragraph
              return <p key={index} className="mb-2">{part}</p>;
            }
          })}
        </>
      );
    }
    
    // Handle normal paragraphs
    return content.split("\n\n").map((paragraph, index) => (
      <p key={index} className={index > 0 ? "mt-2" : ""}>{paragraph}</p>
    ));
  };

  return (
    <div className={cn(
      "flex mb-4 animate-slideUp",
      isUser ? "flex-row-reverse" : ""
    )}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
        isUser ? "ml-2 bg-neutral-200" : "mr-2 bg-primary"
      )}>
        {isUser ? (
          <span className="text-neutral-500 text-xs">YOU</span>
        ) : (
          <span className="text-white font-bold text-xs">{partyShortName}</span>
        )}
      </div>
      
      <div className={cn(
        "chat-bubble p-3 rounded-lg shadow-sm",
        isUser 
          ? "bg-primary text-white rounded-tr-none" 
          : "bg-white text-neutral-800 rounded-tl-none"
      )}>
        <div className="text-sm">
          {formatContent(message.content)}
        </div>
        <p className={cn(
          "text-xs mt-1 text-right",
          isUser ? "text-primary-100" : "text-neutral-400"
        )}>
          {formattedTime}
        </p>
      </div>
    </div>
  );
}
