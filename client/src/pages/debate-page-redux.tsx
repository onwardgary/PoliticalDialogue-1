import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

import ChatInterface from '@/components/chat/chat-interface-new';
import ChatInput from '@/components/chat/chat-input';
import Sidebar from '@/components/sidebar';
import { MobileHeader, MobileNavigation } from '@/components/mobile-nav';
import { useToast } from '@/hooks/use-toast';

import {
  fetchDebate,
  sendMessage,
  endDebate,
  showTypingIndicator,
  setSummaryGenerationStep,
  selectDebate,
  selectLocalMessages,
  selectDebateStatus,
  selectSummaryGenerationStep,
  selectCanSendMessages,
  selectMaxRoundsReached,
  selectError
} from '@/store/debateSlice';
import { useAppDispatch, useAppSelector } from '@/store/types';

// Component to show loader during summary generation
function SummaryGenerationLoader({ step }: { step: number }) {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h2 className="text-2xl font-semibold">Analyzing your debate...</h2>
        <div className="w-full max-w-md bg-muted rounded-full h-4 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-700 ease-in-out" 
            style={{ width: `${step * 25}%` }}
          ></div>
        </div>
        <div className="text-lg text-muted-foreground">
          {step === 1 && "Examining arguments..."}
          {step === 2 && "Comparing positions..."}
          {step === 3 && "Evaluating evidence..."}
          {step === 4 && "Finalizing summary..."}
        </div>
      </div>
    </div>
  );
}

// Define the view states
type ViewState = 'loading' | 'chat' | 'generating' | 'summary';

// Type guard function to check if a string is a valid ViewState
function isViewState(value: string): value is ViewState {
  return ['loading', 'chat', 'generating', 'summary'].includes(value as ViewState);
}

export default function DebatePageRedux() {
  // Get route params
  const params = useParams();
  const secureId = params.secureId;
  const id = params.id ? parseInt(params.id) : undefined;
  
  // Set up location for redirects
  const [, setLocation] = useLocation();
  
  // Set up toast for notifications
  const { toast } = useToast();
  
  // Local component state
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [isUserTyping, setIsUserTyping] = useState(false);
  
  // Redux state and dispatch
  const dispatch = useAppDispatch();
  const debate = useAppSelector(selectDebate);
  const localMessages = useAppSelector(selectLocalMessages);
  const status = useAppSelector(selectDebateStatus);
  const summaryGenerationStep = useAppSelector(selectSummaryGenerationStep);
  const canSendMessages = useAppSelector(selectCanSendMessages);
  const maxRoundsReached = useAppSelector(selectMaxRoundsReached);
  const error = useAppSelector(selectError);
  
  // Combined loading state
  const isLoading = status === 'loadingDebate';
  
  // Fetch debate data on mount
  useEffect(() => {
    if (secureId || id) {
      dispatch(fetchDebate({ secureId, id: id?.toString() }));
    }
  }, [secureId, id, dispatch]);
  
  // Monitor debate state to set appropriate view
  useEffect(() => {
    if (!debate) return;
    
    if (debate.completed && debate.summary) {
      // Redirect to summary page
      const summaryPath = secureId
        ? `/summary/s/${secureId}`
        : `/summary/${debate.id}`;
      setLocation(summaryPath);
    } else if (status === 'generatingSummary') {
      setViewState('generating');
    } else {
      setViewState('chat');
    }
  }, [debate, status, secureId, setLocation]);
  
  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: "An error occurred",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);
  
  // Handle sending messages
  const handleSendMessage = (content: string) => {
    if (!content.trim()) return;
    
    // Show typing indicator immediately
    dispatch(showTypingIndicator());
    
    // Send the message
    dispatch(sendMessage({ 
      content, 
      secureId, 
      id: id?.toString() 
    }));
  };
  
  // Handle ending debate and generating summary
  const handleEndDebate = () => {
    dispatch(endDebate({ secureId, id: id?.toString() }));
    
    // Simulate steps with timeouts
    setTimeout(() => {
      dispatch(setSummaryGenerationStep(2));
      setTimeout(() => {
        dispatch(setSummaryGenerationStep(3));
        setTimeout(() => {
          dispatch(setSummaryGenerationStep(4));
        }, 1500);
      }, 1500);
    }, 1500);
  };
  
  // Loading view
  if (isLoading && viewState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-screen">
        <MobileHeader />
        
        {/* Summary Generation View */}
        {viewState === 'generating' && (
          <div className="flex-1 overflow-auto bg-neutral-50">
            <SummaryGenerationLoader step={summaryGenerationStep || 1} />
          </div>
        )}
        
        {/* Chat View */}
        {viewState === 'chat' && (
          <>
            <ChatInterface
              messages={localMessages}
              isLoading={status === 'sendingMessage' || status === 'waitingForBot'}
              onSendMessage={handleSendMessage}
              onEndDebate={handleEndDebate}
              partyShortName={(debate as any)?.partyShortName}
              userTyping={isUserTyping}
              maxRounds={debate?.maxRounds || 6}
              isGeneratingSummary={Boolean(viewState === 'generating')}
            />
            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={status === 'sendingMessage' || status === 'waitingForBot' || status === 'generatingSummary'}
              onTypingStateChange={setIsUserTyping}
              disabled={
                // Disable input in various scenarios based on status
                status === 'sendingMessage' || 
                status === 'waitingForBot' || 
                status === 'finalRound' ||
                status === 'generatingSummary' ||
                status === 'completed' ||
                maxRoundsReached ||
                (localMessages.length > 0 && 
                localMessages[localMessages.length - 1].role === 'user')
              }
              disabledReason={
                // Determine the reason for disabling
                status === 'generatingSummary'
                  ? 'generating'
                : (status === 'sendingMessage' || status === 'waitingForBot' || 
                  (localMessages.length > 0 && 
                  localMessages[localMessages.length - 1].role === 'user'))
                  ? 'waiting'
                : (status === 'finalRound' || maxRoundsReached)
                  ? 'finalRound'
                : 'maxRounds'
              }
            />
          </>
        )}
        
        <MobileNavigation />
      </main>
    </div>
  );
}