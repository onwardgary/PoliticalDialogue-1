import { configureStore } from '@reduxjs/toolkit';
import debateReducer from './debateSlice';
import { errorMiddleware } from './middleware/errorMiddleware';
import { typingMiddleware } from './middleware/typingMiddleware';

// Configure the Redux store with all reducers and middleware
export const store = configureStore({
  reducer: {
    debate: debateReducer,
    // Add additional reducers here as the application grows
  },
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      // Enable serializable check in production
      serializableCheck: true,
      // Customize thunk options if needed
      thunk: {
        extraArgument: undefined,
      },
    })
    .concat(errorMiddleware)
    .concat(typingMiddleware),
  // Enable Redux DevTools in development
  devTools: process.env.NODE_ENV !== 'production',
});

// Types are now in types.ts for better organization