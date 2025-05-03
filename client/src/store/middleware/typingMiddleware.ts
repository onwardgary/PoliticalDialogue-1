import { Middleware } from 'redux';
import { showTypingIndicator, hideTypingIndicator } from '../debateSlice';

/**
 * Middleware to handle typing indicator debouncing.
 * This prevents flickering of typing indicators and ensures smooth transitions.
 */
export const typingMiddleware: Middleware = (store) => {
  // Store timeouts in closure to track them
  let hideTypingTimeout: NodeJS.Timeout | null = null;
  
  return (next) => (action) => {
    // First, let the action pass through
    const result = next(action);
    
    // If this is an action to show typing indicator
    if (showTypingIndicator.match(action)) {
      // Clear any existing timeout to hide the indicator
      if (hideTypingTimeout) {
        clearTimeout(hideTypingTimeout);
        hideTypingTimeout = null;
      }
    }
    
    // If the action is to hide typing indicator, add a small delay
    // This allows for a smoother transition when real message arrives
    if (hideTypingIndicator.match(action)) {
      // Cancel the immediate hide and schedule it with a delay
      next({ type: 'CANCEL_HIDE_TYPING' }); // Cancel the immediate hide
      
      hideTypingTimeout = setTimeout(() => {
        store.dispatch({ type: 'TYPING_INDICATOR_HIDDEN' });
      }, 150); // Match this with the timing in the UI animations
      
      // Don't proceed with immediate hide
      return result;
    }
    
    return result;
  };
};