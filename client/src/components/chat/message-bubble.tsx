import { format } from "date-fns";
import { useState } from "react";
import { Message } from "@shared/schema";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Typewriter } from "@/components/ui/typewriter";
import { Globe } from "lucide-react";

type MessageBubbleProps = {
  message: Message;
  partyShortName?: string;
  isGrouped?: boolean;
};

export default function MessageBubble({ message, partyShortName = "BOT", isGrouped = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isBot = message.role === "assistant";
  const formattedTime = format(new Date(message.timestamp), "h:mm a");
  
  // For tracking if the typewriter effect is complete
  const [typewriterComplete, setTypewriterComplete] = useState(false);

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

    // Special handling for numbered lists with titles/headers
    const numberedListWithHeadersRegex = /(\d+\.\s+)([\w\s]+):([^]+?)(?=\d+\.\s+[\w\s]+:|$)/g;
    if (content.match(numberedListWithHeadersRegex)) {
      // Format specifically for numbered lists with headers
      const formattedContent = content.replace(numberedListWithHeadersRegex, 
        '<div class="list-item-with-header mb-4">' +
        '<div class="list-header mb-1"><strong>$1$2</strong></div>' +
        '<div class="list-content pl-6">$3</div>' +
        '</div>'
      );
      
      return (
        <div 
          className="formatted-list" 
          dangerouslySetInnerHTML={{ __html: formattedContent }}
        />
      );
    }
    
    // Check if content contains a standard list with numbers or bullets
    if (content.match(/(\d+\.\s|•\s|\*\s).+/g)) {
      // Split content into list items and regular paragraphs
      const listItemRegex = /^(\d+\.\s|•\s|\*\s)(.+)$/gm;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      const contentWithNormalizedLineEndings = content.replace(/\r\n/g, '\n');
      const regex = new RegExp(listItemRegex);
      
      while ((match = regex.exec(contentWithNormalizedLineEndings)) !== null) {
        // Add any text before this list item as a paragraph
        if (match.index > lastIndex) {
          const textBefore = contentWithNormalizedLineEndings.substring(lastIndex, match.index).trim();
          if (textBefore) {
            parts.push({
              type: 'paragraph',
              content: textBefore
            });
          }
        }
        
        // Add this list item
        parts.push({
          type: 'list-item',
          marker: match[1],
          content: match[2].trim()
        });
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add any remaining text as a paragraph
      if (lastIndex < contentWithNormalizedLineEndings.length) {
        const textAfter = contentWithNormalizedLineEndings.substring(lastIndex).trim();
        if (textAfter) {
          parts.push({
            type: 'paragraph',
            content: textAfter
          });
        }
      }
      
      return (
        <div className="list-content">
          {parts.map((part, index) => {
            if (part.type === 'list-item') {
              return (
                <div key={index} className="flex mb-2">
                  <div className="list-marker mr-2">{part.marker}</div>
                  <div 
                    className="list-text flex-1"
                    dangerouslySetInnerHTML={{ __html: formatText(part.content) }}
                  />
                </div>
              );
            } else {
              return (
                <p 
                  key={index} 
                  className="mb-3"
                  dangerouslySetInnerHTML={{ __html: formatText(part.content.replace(/\n/g, '<br />')) }}
                />
              );
            }
          })}
        </div>
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
      "flex mb-2",
      isUser ? "flex-row-reverse animate-appear" : "animate-slideUp",
      isGrouped ? "mt-1" : "mt-4" // Add more spacing between different senders
    )}>
      {/* Only show avatar for the first message in a group */}
      {!isGrouped ? (
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
      ) : (
        <div className={cn(
          "w-8 h-8 flex-shrink-0",
          isUser ? "ml-2" : "mr-2"
        )} />
      )}
      
      <div className={cn(
        "chat-bubble p-3 rounded-lg shadow-sm max-w-[88%] md:max-w-3xl",
        isUser 
          ? "bg-primary text-white" 
          : "bg-white text-neutral-800",
        // Adjust bubble corners for grouped messages
        isGrouped 
          ? isUser 
            ? "rounded-tr-md"
            : "rounded-tl-md"
          : isUser 
            ? "rounded-tr-none"
            : "rounded-tl-none"
      )}>
        <div className={cn(
          "text-sm prose prose-sm dark:prose-invert chat-content",
          isUser ? "chat-content-user" : "chat-content-bot"
        )}>
          {isUser ? (
            <ReactMarkdown>
              {message.content}
            </ReactMarkdown>
          ) : message.id.startsWith('typing-') ? (
            // Special case for typing indicator - larger, more prominent animation
            <div className="flex space-x-2 items-center py-3 px-1">
              <div className="w-2.5 h-2.5 bg-neutral-400 rounded-full animate-pulse" style={{ animationDelay: "0ms", animationDuration: "800ms" }}></div>
              <div className="w-2.5 h-2.5 bg-neutral-400 rounded-full animate-pulse" style={{ animationDelay: "200ms", animationDuration: "800ms" }}></div>
              <div className="w-2.5 h-2.5 bg-neutral-400 rounded-full animate-pulse" style={{ animationDelay: "400ms", animationDuration: "800ms" }}></div>
            </div>
          ) : (
            <Typewriter 
              text={message.content} 
              speed={7} 
              onComplete={() => setTypewriterComplete(true)}
            />
          )}
        </div>
        
        {/* Footer with timestamp and search indicator if applicable */}
        <div className="flex justify-between items-center mt-1">
          {/* Show search icon for assistant messages that used search */}
          {!isUser && message.searchEnabled && (
            <div className="flex items-center text-blue-500" title="Web search was used to generate this response">
              <Globe className="w-3 h-3 mr-1" />
              <span className="text-xs">Search-enhanced</span>
            </div>
          )}
          
          {/* Always show timestamp */}
          <p className={cn(
            "text-xs",
            isUser ? "text-primary-100 ml-auto" : "text-neutral-400 ml-auto"
          )}>
            {formattedTime}
          </p>
        </div>
      </div>
    </div>
  );
}
