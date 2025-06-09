import { Middleware } from 'redux';
import { isRejectedWithValue } from '@reduxjs/toolkit';
import { toast } from '@/hooks/use-toast';

/**
 * Error middleware to handle rejected async thunks.
 * Shows toast notifications for API errors.
 */
export const errorMiddleware: Middleware = () => (next) => (action) => {
  // Check if the action is a rejected async thunk
  if (isRejectedWithValue(action)) {
    // Extract error message
    let errorMessage = 'An unknown error occurred';
    
    if (action.payload && typeof action.payload === 'object' && 'message' in action.payload) {
      errorMessage = String(action.payload.message);
    } else if (action.error && typeof action.error === 'object' && 'message' in action.error) {
      errorMessage = String(action.error.message);
    }
    
    // Log the error for debugging
    console.error('API Error:', errorMessage);
    
    // Show toast notification
    toast({
      title: 'Error',
      description: errorMessage,
      variant: 'destructive',
    });
  }
  
  return next(action);
};