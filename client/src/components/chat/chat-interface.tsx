import { useRef, useEffect } from "react";
import MessageBubble from "./message-bubble";
import { Message } from "@shared/schema";

type ChatInterfaceProps = {
  messages: Message[];
  isLoading: boolean;
};

export default function ChatInterface({ messages, isLoading }: ChatInterfaceProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Filter out system messages
  const filteredMessages = messages.filter(msg => msg.role !== "system");

  return (
    <div 
      ref={chatContainerRef}
      className="chat-container bg-neutral-50 overflow-y-auto p-4 flex flex-col space-y-4"
      style={{ height: "calc(100vh - 180px)" }}
    >
      {/* System welcome message */}
      <div className="flex justify-center mb-6">
        <div className="bg-neutral-200 rounded-full px-4 py-2 text-sm text-neutral-600 max-w-md text-center">
          <p>You can discuss any policy position or political topic relevant to Singapore.</p>
        </div>
      </div>

      {/* Chat messages */}
      {filteredMessages.map((message) => (
        <MessageBubble 
          key={message.id} 
          message={message} 
        />
      ))}

      {/* Typing indicator */}
      {isLoading && (
        <div className="flex mb-4 animate-fadeIn">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-2 flex-shrink-0">
            <span className="text-white font-bold text-xs">BOT</span>
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
    </div>
  );
}
