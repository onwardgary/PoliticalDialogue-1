import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Clock, Award, AlertTriangle } from "lucide-react";

type TutorialStep = {
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
};

export default function DebateTutorialOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Check localStorage to see if the user has seen the tutorial before
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenDebateTutorial');
    if (!hasSeenTutorial) {
      setIsOpen(true);
    }
  }, []);

  const tutorialSteps: TutorialStep[] = [
    {
      title: "Welcome to your Debate!",
      description: (
        <div className="space-y-2">
          <p>
            You're about to engage in a debate with an unofficial political party fanbot. 
            This is a chance to exchange ideas on policy topics that matter to you.
          </p>
          <p>
            This tutorial will guide you through how debates work on this platform.
          </p>
        </div>
      ),
      icon: <Check className="h-8 w-8 text-green-500" />,
    },
    {
      title: "Debate Rounds",
      description: (
        <div className="space-y-2">
          <p>
            Each debate consists of <strong>3 rounds</strong> where you can present your arguments 
            and respond to the party bot's position.
          </p>
          <p>
            Try to be clear, specific, and provide reasoning for your positions to get 
            the most thoughtful responses.
          </p>
          <p>
            After 3 rounds, you'll have the option to end the debate and generate a summary.
          </p>
        </div>
      ),
      icon: <Check className="h-8 w-8 text-green-500" />,
    },
    {
      title: "Judging Criteria",
      description: (
        <div className="space-y-2">
          <p>
            At the end of the debate, an AI judge will evaluate both sides based on:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Logical Soundness:</strong> Quality of reasoning and evidence</li>
            <li><strong>Emotional Reasoning:</strong> Appeal to values and ethics</li>
            <li><strong>Key Point Resolution:</strong> Addressing the central issues</li>
            <li><strong>Tone and Clarity:</strong> Communication effectiveness</li>
            <li><strong>Pragmatism:</strong> Practical viability of proposals</li>
          </ul>
          <p className="mt-2">
            The summary will declare a winner and suggest possible action steps.
          </p>
        </div>
      ),
      icon: <Award className="h-8 w-8 text-amber-500" />,
    },
    {
      title: "Debate Timeout",
      description: (
        <div className="space-y-2">
          <p className="font-medium">
            Important: Debates have a 15-minute inactivity timeout.
          </p>
          <p>
            If you step away for more than 15 minutes during a debate, the system will 
            automatically end it to prevent abandoned conversations.
          </p>
          <p>
            If you need to take a break, you can always start a new debate when you return.
          </p>
        </div>
      ),
      icon: <Clock className="h-8 w-8 text-red-500" />,
    },
  ];

  const handleClose = () => {
    // Mark that the user has seen the tutorial
    localStorage.setItem('hasSeenDebateTutorial', 'true');
    setIsOpen(false);
  };

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {tutorialSteps[currentStep].icon}
            <DialogTitle>{tutorialSteps[currentStep].title}</DialogTitle>
          </div>
          <DialogDescription>
            Step {currentStep + 1} of {tutorialSteps.length}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {tutorialSteps[currentStep].description}
        </div>
        
        <DialogFooter className="flex justify-between gap-2">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              Back
            </Button>
            
            <Button 
              onClick={nextStep}
            >
              {currentStep === tutorialSteps.length - 1 ? "Start Debating" : "Next"}
            </Button>
          </div>
          
          {currentStep < tutorialSteps.length - 1 && (
            <Button 
              variant="ghost" 
              onClick={handleClose}
              size="sm"
              className="text-gray-500"
            >
              Skip Tutorial
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}