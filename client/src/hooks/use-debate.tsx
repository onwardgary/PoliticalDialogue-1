import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation } from 'wouter';
import { 
  fetchDebate, 
  createDebate, 
  sendMessage, 
  endDebate, 
  pollForResponse,
  showTypingIndicator, 
  setSummaryGenerationStep,
  resetState,
  selectDebate,
  selectLocalMessages,
  selectDebateStatus,
  selectSummaryGenerationStep,
  selectCanSendMessages,
  selectMaxRoundsReached,
  selectError
} from '@/store/debateSlice';
import { Message } from '@shared/schema';

export function useDebate({ secureId, id }: { secureId?: string; id?: string }) {
  const dispatch = useDispatch();
  const [, setLocation] = useLocation();

  // Select data from Redux store
  const debate = useSelector(selectDebate);
  const messages = useSelector(selectLocalMessages);
  const status = useSelector(selectDebateStatus);
  const summaryGenerationStep = useSelector(selectSummaryGenerationStep);
  const canSendMessages = useSelector(selectCanSendMessages);
  const maxRoundsReached = useSelector(selectMaxRoundsReached);
  const error = useSelector(selectError);

  // Check if debate is loading
  const isLoading = status === 'loadingDebate';
  
  // Check if we're waiting for a bot response
  const isWaitingForBot = status === 'waitingForBot' || status === 'sendingMessage';
  
  // Check if we're in the final round
  const isFinalRound = status === 'finalRound';
  
  // Check if we're generating a summary
  const isGeneratingSummary = status === 'generatingSummary';
  
  // Check if debate is completed
  const isCompleted = status === 'completed';
  
  // Fetch debate on mount if we have an ID
  useEffect(() => {
    if (secureId || id) {
      dispatch(fetchDebate({ secureId, id }));
    }
    
    // Cleanup on unmount
    return () => {
      dispatch(resetState());
    };
  }, [secureId, id, dispatch]);

  // Redirect to summary page if completed
  useEffect(() => {
    if (debate?.completed && debate?.summary) {
      const summaryPath = secureId 
        ? `/summary/s/${secureId}` 
        : `/summary/${debate.id}`;
      setLocation(summaryPath);
    }
  }, [debate, secureId, setLocation]);

  // Handle creating a new debate
  const createNewDebate = (partyId: number, topic: string, maxRounds: number) => {
    dispatch(createDebate({ partyId, topic, maxRounds }));
  };

  // Handle sending a message
  const handleSendMessage = (content: string) => {
    if (!content.trim()) return;
    
    // Show typing indicator immediately
    dispatch(showTypingIndicator());
    
    // Send the message
    dispatch(sendMessage({ content, secureId, id }));
    
    // Start polling for response
    dispatch(pollForResponse({ secureId, id }));
  };

  // Handle ending the debate
  const handleEndDebate = () => {
    dispatch(endDebate({ secureId, id }));
    
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

  return {
    debate,
    messages,
    status,
    summaryGenerationStep,
    canSendMessages,
    maxRoundsReached,
    isLoading,
    isWaitingForBot,
    isFinalRound,
    isGeneratingSummary,
    isCompleted,
    error,
    createNewDebate,
    sendMessage: handleSendMessage,
    endDebate: handleEndDebate
  };
}