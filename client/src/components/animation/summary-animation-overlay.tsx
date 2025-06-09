import { CheckCircle2, ArrowRight, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useState, useEffect } from "react";

// Animation component props
type SummaryAnimationOverlayProps = {
  onStart: () => Promise<{ success: boolean; path: string }>;
  onComplete: (path: string) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

/**
 * A simplified animation overlay with minimal state management
 * to prevent race conditions and ensure reliability
 */
export default function SummaryAnimationOverlay({
  onStart,
  onComplete,
  isOpen,
  onOpenChange
}: SummaryAnimationOverlayProps) {
  // Track each step separately for simplicity
  const [step, setStep] = useState(1);
  const [isDone, setIsDone] = useState(false);
  const [summaryPath, setSummaryPath] = useState("");
  const [hasStarted, setHasStarted] = useState(false);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setIsDone(false);
      setHasStarted(false);
    }
  }, [isOpen]);

  // Start the API call and animation only once when opened
  useEffect(() => {
    let isActive = true; // Track whether component is still mounted
    
    if (isOpen && !hasStarted) {
      setHasStarted(true);
      
      // Make the API call
      const startSummaryGeneration = async () => {
        try {
          console.log("Starting API call to generate summary");
          const result = await onStart();
          
          if (!isActive) return; // Don't update state if unmounted
          
          if (!result.success) {
            console.error("Failed to generate summary");
            onOpenChange(false);
            return;
          }
          
          // Store the path
          setSummaryPath(result.path);
          
          // Simple fixed-time steps (animation is just visual feedback)
          setTimeout(() => { 
            if (isActive) setStep(2); 
            setTimeout(() => { 
              if (isActive) setStep(3);
              setTimeout(() => { 
                if (isActive) setStep(4);
                setTimeout(() => { 
                  if (isActive) {
                    setIsDone(true);
                    onComplete(result.path);
                  }
                }, 1000);
              }, 1000);
            }, 1000);
          }, 1000);
          
        } catch (error) {
          console.error("Error generating summary:", error);
          if (isActive) onOpenChange(false);
        }
      };
      
      startSummaryGeneration();
    }
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isActive = false;
    };
  }, [isOpen, hasStarted, onStart, onComplete, onOpenChange]);
  
  // Don't render anything if not open
  if (!isOpen) return null;
  
  // Create portal for the animation overlay
  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="flex flex-col items-center">
          {/* Title */}
          <h2 className="text-2xl font-bold mb-6 text-center">
            {isDone ? "Debate Summary Ready!" : "Generating Debate Summary..."}
          </h2>
          
          {/* Progress Steps */}
          <div className="w-full space-y-6 mb-8">
            <AnimationStep 
              number={1}
              title="Analyzing arguments"
              description="Identifying key points from both sides"
              isActive={step === 1}
              isCompleted={step > 1}
            />
            
            <AnimationStep 
              number={2}
              title="Evaluating evidence"
              description="Assessing the quality of reasoning and factual support"
              isActive={step === 2}
              isCompleted={step > 2}
            />
            
            <AnimationStep 
              number={3}
              title="Comparing positions"
              description="Creating point-by-point comparison"
              isActive={step === 3}
              isCompleted={step > 3}
            />
            
            <AnimationStep 
              number={4}
              title="Forming conclusions"
              description="Determining outcome based on logical assessment"
              isActive={step === 4}
              isCompleted={isDone}
            />
          </div>
          
          {/* Action Button or Loading Indicator */}
          {isDone ? (
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center justify-center w-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <span>Please wait...</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Animation step component
type AnimationStepProps = {
  number: number;
  title: string;
  description: string;
  isActive: boolean;
  isCompleted: boolean;
};

function AnimationStep({ 
  number, 
  title, 
  description, 
  isActive, 
  isCompleted 
}: AnimationStepProps) {
  return (
    <div className={cn(
      "flex items-start",
      isActive && "animate-pulse",
      isCompleted && "opacity-100",
      !isActive && !isCompleted && "opacity-50"
    )}>
      <div className="mr-4 flex-shrink-0">
        {isCompleted ? (
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        ) : isActive ? (
          <div className="h-6 w-6 rounded-full bg-amber-500 animate-pulse flex items-center justify-center text-white font-bold">
            {number}
          </div>
        ) : (
          <div className="h-6 w-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 font-bold">
            {number}
          </div>
        )}
      </div>
      <div>
        <h3 className={cn(
          "font-medium",
          isActive && "text-amber-500 font-bold",
          isCompleted && "text-green-500"
        )}>
          {title}
        </h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}

/**
 * A component that shows the completion notification when the summary is ready
 */
export function SummaryReadyNotification({ 
  onViewSummary 
}: { 
  onViewSummary: () => void 
}) {
  // Only create portal if document is available
  if (typeof document === 'undefined') return null;
  
  return createPortal(
    <div id="summary-notification" className="fixed bottom-6 right-6 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4 max-w-sm animate-slide-up">
        <div className="flex items-start">
          <div className="mr-3 mt-0.5">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold">Debate Summary Ready</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Your debate has been analyzed and conclusions have been drawn.
            </p>
            <Button 
              size="sm" 
              onClick={() => {
                try {
                  onViewSummary();
                } catch (error) {
                  console.error("Error viewing summary:", error);
                  try {
                    // Fallback navigation
                    window.location.href = window.location.href.replace('/debate/', '/summary/');
                  } catch (e) {
                    console.error("Even fallback navigation failed:", e);
                  }
                }
              }}
              className="w-full"
            >
              View Summary <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <button 
            onClick={() => {
              try {
                const notification = document.getElementById('summary-notification');
                if (notification) {
                  notification.classList.add('animate-slide-down');
                  setTimeout(() => {
                    try {
                      notification.remove();
                    } catch (e) {
                      console.error("Error removing notification:", e);
                    }
                  }, 300);
                }
              } catch (error) {
                console.error("Error closing notification:", error);
              }
            }}
            className="ml-2 text-gray-400 hover:text-gray-500"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}