import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function Typewriter({ 
  text, 
  speed = 10, 
  onComplete,
  className = ""
}: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Reset state when text changes
    setDisplayedText("");
    setCurrentIndex(0);
    setIsComplete(false);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      // Adaptive speed: type faster for long messages, slower for punctuation
      const char = text[currentIndex];
      let adjustedSpeed = speed;
      
      // Slow down for punctuation
      if (['.', '!', '?', ',', ';', ':'].includes(char)) {
        adjustedSpeed = speed * 5;
      }
      
      // Speed up for very long messages
      if (text.length > 500) {
        adjustedSpeed = Math.max(1, speed / 2);
      }

      const timer = setTimeout(() => {
        setDisplayedText(prevText => prevText + char);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, adjustedSpeed);
      
      return () => clearTimeout(timer);
    } else if (!isComplete) {
      setIsComplete(true);
      if (onComplete) {
        onComplete();
      }
    }
  }, [currentIndex, speed, text, isComplete, onComplete]);

  return (
    <div className={className}>
      <ReactMarkdown>
        {displayedText}
      </ReactMarkdown>
      {!isComplete && (
        <span className="inline-block w-1 h-4 bg-current ml-0.5 animate-blink"></span>
      )}
    </div>
  );
}