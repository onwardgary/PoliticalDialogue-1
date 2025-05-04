import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, XCircle, CheckCircle2, Loader2 } from "lucide-react";

// Type for the animation steps
export type SummaryAnimationStep = 1 | 2 | 3 | 4;

// Type for animation state
export type AnimationState = {
  isActive: boolean;
  currentStep: SummaryAnimationStep;
  isCompleted: boolean;
  summaryPath: string | null;
};

// Animation component props
type SummaryAnimationOverlayProps = {
  onStart: () => Promise<{ success: boolean; path: string }>;
  onComplete: (path: string) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

/**
 * A portal-based animation overlay that can't be accidentally unmounted
 * during component re-renders. Uses an independent state life cycle.
 */
export default function SummaryAnimationOverlay({
  onStart,
  onComplete,
  isOpen,
  onOpenChange
}: SummaryAnimationOverlayProps) {
  const [animationState, setAnimationState] = useState<AnimationState>({
    isActive: false,
    currentStep: 1,
    isCompleted: false,
    summaryPath: null
  });
  
  // Track unmounting to prevent state updates after component is gone
  const isMounted = useRef(true);
  
  // Set up cleanup for unmounting
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Only run the animation if the portal is open
  useEffect(() => {
    if (isOpen && !animationState.isActive) {
      console.log("Animation overlay opened, starting animation sequence");
      
      // Only update state if still mounted
      if (isMounted.current) {
        // Mark animation as active
        setAnimationState(prev => ({ ...prev, isActive: true }));
      }
      
      // Run the animation sequence
      const runAnimation = async () => {
        try {
          // Run onStart callback to trigger the API request
          console.log("Calling onStart callback");
          const result = await onStart();
          
          // Always check if still mounted before state updates
          if (!isMounted.current) return;
          
          if (!result.success) {
            console.error("Animation failed - API call unsuccessful");
            onOpenChange(false);
            return;
          }
          
          // Store the summary path
          setAnimationState(prev => ({ 
            ...prev, 
            summaryPath: result.path 
          }));
          
          // Create safe timeout that checks mounting status
          const safeTimeout = (ms: number) => new Promise<void>(resolve => {
            const timer = setTimeout(() => {
              if (isMounted.current) {
                resolve();
              }
            }, ms);
            
            // Clean up timer if component unmounts during timeout
            return () => clearTimeout(timer);
          });
          
          // Simulate the steps of the animation with delays and mount checks
          await safeTimeout(1500);
          if (!isMounted.current) return;
          setAnimationState(prev => ({ ...prev, currentStep: 2 }));
          
          await safeTimeout(1500);
          if (!isMounted.current) return;
          setAnimationState(prev => ({ ...prev, currentStep: 3 }));
          
          await safeTimeout(1500);
          if (!isMounted.current) return;
          setAnimationState(prev => ({ ...prev, currentStep: 4 }));
          
          // Mark as completed
          await safeTimeout(1500);
          if (!isMounted.current) return;
          setAnimationState(prev => ({ 
            ...prev, 
            isCompleted: true 
          }));
          
          // Call the onComplete callback
          console.log("Animation sequence completed, calling onComplete");
          if (result.path && isMounted.current) {
            onComplete(result.path);
          }
        } catch (error) {
          console.error("Error during animation sequence:", error);
          // Only update if still mounted
          if (isMounted.current) {
            // Close the animation portal on error
            onOpenChange(false);
          }
        }
      };
      
      // Start the animation
      runAnimation();
    } else if (!isOpen && animationState.isActive && isMounted.current) {
      // Reset animation state when portal is closed (only if still mounted)
      setAnimationState({
        isActive: false,
        currentStep: 1,
        isCompleted: false,
        summaryPath: null
      });
    }
  }, [isOpen, animationState.isActive, onStart, onComplete, onOpenChange]);
  
  // Don't render anything if not open
  if (!isOpen) return null;
  
  // Create a portal to render the animation overlay
  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="flex flex-col items-center">
          {/* Animation Title */}
          <h2 className="text-2xl font-bold mb-6 text-center">
            {animationState.isCompleted 
              ? "Debate Summary Ready!" 
              : "Generating Debate Summary..."}
          </h2>
          
          {/* Progress Steps */}
          <div className="w-full space-y-6 mb-8">
            <AnimationStep 
              number={1}
              title="Analyzing arguments"
              description="Identifying key points from both sides"
              isActive={animationState.currentStep === 1}
              isCompleted={animationState.currentStep > 1}
            />
            
            <AnimationStep 
              number={2}
              title="Evaluating evidence"
              description="Assessing the quality of reasoning and factual support"
              isActive={animationState.currentStep === 2}
              isCompleted={animationState.currentStep > 2}
            />
            
            <AnimationStep 
              number={3}
              title="Comparing positions"
              description="Creating point-by-point comparison"
              isActive={animationState.currentStep === 3}
              isCompleted={animationState.currentStep > 3}
            />
            
            <AnimationStep 
              number={4}
              title="Forming conclusions"
              description="Determining outcome based on logical assessment"
              isActive={animationState.currentStep === 4}
              isCompleted={animationState.currentStep > 4 || animationState.isCompleted}
            />
          </div>
          
          {/* Action Button */}
          {animationState.isCompleted ? (
            <Button
              onClick={() => {
                // Close the animation portal
                onOpenChange(false);
              }}
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

// Individual animation step component
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
  // This prevents errors during SSR or unmounting
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
                  console.error("Error in notification view summary click:", error);
                  // Navigate manually as fallback
                  window.location.href = window.location.href.replace('/debate/', '/summary/');
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
                // Close notification without navigation
                const notification = document.getElementById('summary-notification');
                if (notification) {
                  notification.classList.add('animate-slide-down');
                  setTimeout(() => {
                    notification.remove();
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