import { Middleware } from 'redux';
import { showTypingIndicator, hideTypingIndicator, sendMessage } from '../debateSlice';

/**
 * Middleware to handle typing indicator debouncing and message transitions.
 * This prevents flickering of typing indicators and ensures smooth transitions.
 */
export const typingMiddleware: Middleware = (store) => {
  // Store timeouts in closure to track them
  let hideTypingTimeout: NodeJS.Timeout | null = null;
  let messageTransitionTimeout: NodeJS.Timeout | null = null;
  
  return (next) => (action) => {
    // First, let the action pass through
    const result = next(action);
    
    // If this is an action to show typing indicator
    if (showTypingIndicator.match(action)) {
      console.log('Typing middleware: Showing typing indicator');
      // Clear any existing timeout to hide the indicator
      if (hideTypingTimeout) {
        clearTimeout(hideTypingTimeout);
        hideTypingTimeout = null;
      }
    }
    
    // If this is a successful message send with a bot response
    if (sendMessage.fulfilled.match(action) && action.payload.botMessage) {
      console.log('Typing middleware: Message sent with bot response');
      
      // Clear typing indicator after a short delay to ensure smooth transition
      if (hideTypingTimeout) {
        clearTimeout(hideTypingTimeout);
      }
      
      // First hide the typing indicator
      hideTypingTimeout = setTimeout(() => {
        store.dispatch(hideTypingIndicator());
        
        // Then process the actual message after a brief delay
        messageTransitionTimeout = setTimeout(() => {
          // This will be handled by the reducer normally
          console.log('Typing middleware: Processing bot message after delay');
        }, 100);
      }, 50);
    }
    
    // If the action is to hide typing indicator, add a small delay
    // This allows for a smoother transition when real message arrives
    if (hideTypingIndicator.match(action)) {
      console.log('Typing middleware: Hiding typing indicator with delay');
      // Don't proceed with immediate hide, use the timeout
      return result;
    }
    
    return result;
  };
};