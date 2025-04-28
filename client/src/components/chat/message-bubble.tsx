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

  // Format the content to handle paragraphs, lists, and formatting
  const formatContent = (content: string) => {
    // Process bold formatting (** or __ for bold)
    const processBold = (text: string) => {
      return text.replace(/\*\*(.*?)\*\*|__(.*?)__/g, (match, p1, p2) => {
        const content = p1 || p2;
        return `<strong>${content}</strong>`;
      });
    };

    // Process italic formatting (* or _ for italic)
    const processItalic = (text: string) => {
      return text.replace(/\*(.*?)\*|_(.*?)_/g, (match, p1, p2) => {
        // Skip if it's likely part of a bold marker that was partially processed
        if (match.startsWith('**') || match.endsWith('**')) return match;
        const content = p1 || p2;
        return `<em>${content}</em>`;
      });
    };

    // Apply formatting to text
    const formatText = (text: string) => {
      let formatted = processBold(text);
      formatted = processItalic(formatted);
      return formatted;
    };

    // Check if content contains a list with numbers or bullets
    if (content.match(/(\d+\.\s|•\s|\*\s).+/g)) {
      const parts = content.split(/(?=(\d+\.\s|•\s|\*\s))/);
      return (
        <>
          {parts.map((part, index) => {
            if (part.match(/^(\d+\.\s|•\s|\*\s)/)) {
              // It's a list item
              return (
                <li key={index} className="ml-4 mb-1" 
                    dangerouslySetInnerHTML={{ __html: formatText(part) }} />
              );
            } else if (part.trim()) {
              // It's a paragraph
              return (
                <p key={index} className="mb-2" 
                   dangerouslySetInnerHTML={{ __html: formatText(part) }} />
              );
            }
            return null;
          }).filter(Boolean)}
        </>
      );
    }
    
    // Handle normal paragraphs with better newline detection
    // Split by double newline for paragraphs, preserve single newlines within paragraphs
    const paragraphs = content.split(/\n\s*\n/);
    
    return (
      <>
        {paragraphs.map((paragraph, index) => {
          // Handle single newlines within a paragraph
          const formattedParagraph = formatText(paragraph.replace(/\n/g, '<br />'));
          return (
            <p 
              key={index} 
              className={index > 0 ? "mt-3" : ""} 
              dangerouslySetInnerHTML={{ __html: formattedParagraph }}
            />
          );
        })}
      </>
    );
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
        "chat-bubble p-4 rounded-lg shadow-sm max-w-3xl",
        isUser 
          ? "bg-primary text-white rounded-tr-none" 
          : "bg-white text-neutral-800 rounded-tl-none"
      )}>
        <div className="text-sm prose prose-sm dark:prose-invert">
          {formatContent(message.content)}
        </div>
        <p className={cn(
          "text-xs mt-2 text-right",
          isUser ? "text-primary-100" : "text-neutral-400"
        )}>
          {formattedTime}
        </p>
      </div>
    </div>
  );
}
