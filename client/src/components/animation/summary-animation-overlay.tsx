import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BrainCircuit, CheckCircle2, Loader2, MedalIcon, Scale } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

export type SummaryAnimationStep = 1 | 2 | 3 | 4;

export type AnimationState = {
  isActive: boolean;
  currentStep: SummaryAnimationStep;
  isCompleted: boolean;
  summaryPath: string | null;
};

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
  onOpenChange,
}: SummaryAnimationOverlayProps) {
  const { toast } = useToast();
  
  // Animation steps
  const steps = [
    { id: 1, name: "Analyzing Arguments", icon: BrainCircuit },
    { id: 2, name: "Evaluating Logic", icon: Scale },
    { id: 3, name: "Determining Outcome", icon: MedalIcon },
    { id: 4, name: "Creating Summary", icon: CheckCircle2 },
  ];

  // Local state for animation
  const [currentStep, setCurrentStep] = useState<SummaryAnimationStep>(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [summaryPath, setSummaryPath] = useState<string | null>(null);
  
  // Track component mounted state reliably
  const isMounted = useRef(true);
  
  // Control animation timer safely
  const animationTimerRef = useRef<number | null>(null);
  
  // Track animation instance to avoid race conditions
  const animationIdRef = useRef<string | null>(null);

  // Handle animation initialization when opened
  useEffect(() => {
    if (isOpen && !isCompleted && !animationIdRef.current) {
      // Generate a unique ID for this animation instance
      animationIdRef.current = `animation-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      console.log(`Starting animation sequence: ${animationIdRef.current}`);
      
      // Start animation with step 1
      setCurrentStep(1);
      
      // Actually run the callback to start generating the summary
      onStart().then(result => {
        if (isMounted.current && result.success && result.path) {
          setSummaryPath(result.path);
          
          // Continue with animation even if API call completes faster than animation
          console.log(`API call completed successfully, but continuing animation: ${animationIdRef.current}`);
        }
      }).catch(error => {
        if (isMounted.current) {
          console.error("Error starting animation:", error);
          toast({
            title: "An error occurred",
            description: "Unable to generate summary. Please try again.",
            variant: "destructive"
          });
          // Close the animation overlay on error
          onOpenChange(false);
        }
      });
      
      // Start the step-by-step animation
      runAnimationSequence();
    }
    
    // Handle animation reset when closed
    if (!isOpen) {
      resetAnimation();
    }
    
    // Cleanup function to handle unmounting
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, [isOpen, onStart]);
  
  // Set component unmount flag
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, []);
  
  // Complete animation when step 4 is reached and summaryPath is available
  useEffect(() => {
    if (isOpen && currentStep === 4 && summaryPath) {
      // Add a small delay to make animation look smoother
      const completeTimer = setTimeout(() => {
        if (isMounted.current) {
          setIsCompleted(true);
          
          // Show success toast
          toast({
            title: "Debate summary generated",
            description: "Your debate has been analyzed and summarized.",
          });
          
          // Notify parent component about completion with path
          onComplete(summaryPath);
        }
      }, 1500);
      
      return () => clearTimeout(completeTimer);
    }
  }, [currentStep, summaryPath, isOpen, onComplete]);
  
  // Reset animation state
  const resetAnimation = () => {
    setCurrentStep(1);
    setIsCompleted(false);
    setSummaryPath(null);
    
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    
    animationIdRef.current = null;
  };
  
  // Run the animation sequence
  const runAnimationSequence = () => {
    // Remember the current animation ID to validate state updates
    const currentAnimationId = animationIdRef.current;
    
    // Step 1 is already active at start
    
    // Schedule step 2
    animationTimerRef.current = window.setTimeout(() => {
      if (isMounted.current && animationIdRef.current === currentAnimationId) {
        setCurrentStep(2);
        
        // Schedule step 3
        animationTimerRef.current = window.setTimeout(() => {
          if (isMounted.current && animationIdRef.current === currentAnimationId) {
            setCurrentStep(3);
            
            // Schedule step 4
            animationTimerRef.current = window.setTimeout(() => {
              if (isMounted.current && animationIdRef.current === currentAnimationId) {
                setCurrentStep(4);
                // The completion effect above will handle the last step
              }
            }, 1500);
          }
        }, 1500);
      }
    }, 1500);
  };
  
  // Get current step info
  const currentStepInfo = steps.find(s => s.id === currentStep) || steps[0];
  const Icon = currentStepInfo.icon;
  
  // Create portal to render outside of normal component hierarchy
  return createPortal(
    isOpen ? (
      <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
        <div className="relative bottom-24 mb-4 px-4 w-full max-w-md">
          <div className="bg-gray-900 text-white p-4 rounded-lg shadow-lg w-full border border-gray-700 pointer-events-auto">
            <div className="flex items-center">
              <div className="rounded-full p-2 mr-3 bg-white/10 animate-pulse">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{currentStepInfo.name}</p>
                <div className="mt-2">
                  <Progress value={(currentStep / steps.length) * 100} className="h-2 bg-gray-800" />
                </div>
                <p className="text-xs text-gray-300 mt-1">
                  Step {currentStep} of {steps.length}: Generating debate summary
                </p>
              </div>
              <Loader2 className="h-5 w-5 animate-spin text-white ml-3" />
            </div>
          </div>
        </div>
      </div>
    ) : null,
    document.body
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
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      <div className="relative bottom-24 mb-4 px-4 w-full max-w-md">
        <div className="bg-primary text-white p-4 rounded-lg shadow-lg w-full flex items-center justify-between pointer-events-auto">
          <div className="flex items-center">
            <CheckCircle2 className="h-5 w-5 mr-3 text-white" />
            <div>
              <p className="font-medium">Summary Ready!</p>
              <p className="text-xs opacity-90">Your debate has been analyzed and summarized.</p>
            </div>
          </div>
          <button 
            onClick={onViewSummary}
            className="bg-white text-primary px-3 py-1.5 rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors"
          >
            View Summary
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}