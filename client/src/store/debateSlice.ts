import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { nanoid } from 'nanoid';
import { type RootState } from './types';
import { apiRequest } from '@/lib/queryClient';
import type { Message, Debate } from '@shared/schema';

// Define types for slice state
interface DebateState {
  debate: Debate | null;
  localMessages: Message[];
  status: 'idle' | 'loadingDebate' | 'sendingMessage' | 'waitingForBot' | 'finalRound' | 'generatingSummary' | 'completed';
  error: string | null;
  typingIndicator: boolean;
  messageBeingSent: string | null;
  summaryGenerationStep: number;
}

// Initial state
const initialState: DebateState = {
  debate: null,
  localMessages: [],
  status: 'idle',
  error: null,
  typingIndicator: false,
  messageBeingSent: null,
  summaryGenerationStep: 1,
};

// Async thunks
export const fetchDebate = createAsyncThunk(
  'debate/fetchDebate',
  async ({ secureId, id }: { secureId?: string; id?: string }, { rejectWithValue }) => {
    try {
      let endpoint = '';
      if (secureId) {
        endpoint = `/api/debates/s/${secureId}`;
      } else if (id) {
        endpoint = `/api/debates/${id}`;
      } else {
        throw new Error('Either secureId or id must be provided');
      }

      const response = await apiRequest('GET', endpoint);
      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not fetch debate';
      return rejectWithValue(errorMessage);
    }
  }
);

export const sendMessage = createAsyncThunk(
  'debate/sendMessage',
  async ({ content, secureId, id }: { content: string; secureId?: string; id?: string }, { rejectWithValue }) => {
    try {
      let endpoint = '';
      if (secureId) {
        endpoint = `/api/debates/s/${secureId}/messages`;
      } else if (id) {
        endpoint = `/api/debates/${id}/messages`;
      } else {
        throw new Error('Either secureId or id must be provided');
      }

      console.log('Sending message to:', endpoint);
      const response = await apiRequest('POST', endpoint, { content });
      const data = await response.json();
      
      // Extract data from response
      return {
        userMessage: data.userMessage,
        botMessage: data.botMessage,
        debate: data.debate
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not send message';
      return rejectWithValue(errorMessage);
    }
  }
);

export const endDebate = createAsyncThunk(
  'debate/endDebate',
  async ({ secureId, id }: { secureId?: string; id?: string }, { rejectWithValue }) => {
    try {
      let endpoint = '';
      if (secureId) {
        endpoint = `/api/debates/s/${secureId}/end`;
      } else if (id) {
        endpoint = `/api/debates/${id}/end`;
      } else {
        throw new Error('Either secureId or id must be provided');
      }

      const response = await apiRequest('POST', endpoint);
      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not end debate';
      return rejectWithValue(errorMessage);
    }
  }
);

// Create the slice
const debateSlice = createSlice({
  name: 'debate',
  initialState,
  reducers: {
    // Show typing indicator
    showTypingIndicator: (state) => {
      state.typingIndicator = true;
    },
    // Hide typing indicator
    hideTypingIndicator: (state) => {
      state.typingIndicator = false;
    },
    // Set summary generation step
    setSummaryGenerationStep: (state, action: PayloadAction<number>) => {
      state.summaryGenerationStep = action.payload;
    },
    // Reset state (used when navigating away)
    resetDebateState: () => initialState,
  },
  extraReducers: (builder) => {
    // Handle fetchDebate
    builder
      .addCase(fetchDebate.pending, (state) => {
        state.status = 'loadingDebate';
        state.error = null;
      })
      .addCase(fetchDebate.fulfilled, (state, action) => {
        state.status = 'idle';
        state.debate = action.payload;
        state.localMessages = action.payload.messages || [];
        
        // Handle completed debates
        if (action.payload.completed) {
          state.status = 'completed';
        }
      })
      .addCase(fetchDebate.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload as string || 'Failed to fetch debate';
      })

    // Handle sendMessage
    builder
      .addCase(sendMessage.pending, (state, action) => {
        state.status = 'sendingMessage';
        state.messageBeingSent = action.meta.arg.content;
        state.error = null;
        
        // Optimistically add the user message to the local state
        const userMessage: Message = {
          id: nanoid(),
          role: 'user',
          content: action.meta.arg.content,
          timestamp: Date.now(),
        };
        state.localMessages.push(userMessage);
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        console.log('Message sent successfully, payload:', action.payload);
        
        // Replace optimistically added user message with the server version if available
        if (action.payload.userMessage) {
          // First, find and remove the optimistic user message
          // Find the last user message index
          const lastUserMsgIndex = [...state.localMessages].reverse()
            .findIndex(msg => msg.role === 'user');
          
          if (lastUserMsgIndex !== -1) {
            // Convert reverse index to actual index
            const actualIndex = state.localMessages.length - 1 - lastUserMsgIndex;
            // Replace it with the server version
            state.localMessages[actualIndex] = action.payload.userMessage;
          }
        }
        
        // Handle bot response
        if (action.payload.botMessage) {
          // Set status back to idle since we have the bot message
          state.status = 'idle';
          state.messageBeingSent = null;
          
          // First remove any typing indicator
          state.localMessages = state.localMessages.filter(msg => !msg.id.startsWith('typing-'));
          
          // Then add the real bot message from server
          state.localMessages.push(action.payload.botMessage);
          
          console.log('Added bot message to local state:', action.payload.botMessage);
        } else {
          // No bot message yet, keep waiting state
          state.status = 'waitingForBot';
          state.messageBeingSent = null;
          
          // Add a typing indicator for the bot
          if (state.typingIndicator) {
            const typingIndicator: Message = {
              id: `typing-${nanoid()}`,
              role: 'assistant',
              content: '...',
              timestamp: Date.now(),
            };
            state.localMessages.push(typingIndicator);
            console.log('Added typing indicator while waiting for bot');
          }
        }
        
        // Update debate if returned
        if (action.payload.debate) {
          state.debate = action.payload.debate;
        }
        
        // Check if this is the final round
        const userMessageCount = state.localMessages.filter(msg => msg.role === 'user').length;
        if (state.debate && state.debate.maxRounds && userMessageCount >= state.debate.maxRounds) {
          state.status = 'finalRound';
          console.log('Final round reached, disabling input');
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.status = 'idle';
        state.messageBeingSent = null;
        state.error = action.payload as string || 'Failed to send message';
        
        // Remove optimistically added message on error
        if (state.localMessages.length > 0) {
          state.localMessages.pop();
        }
      })

    // Handle endDebate
    builder
      .addCase(endDebate.pending, (state) => {
        state.status = 'generatingSummary';
        state.summaryGenerationStep = 1;
        state.error = null;
      })
      .addCase(endDebate.fulfilled, (state, action) => {
        state.status = 'completed';
        state.debate = action.payload;
      })
      .addCase(endDebate.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload as string || 'Failed to end debate';
      });
  },
});

// Export actions
export const { 
  showTypingIndicator, 
  hideTypingIndicator, 
  setSummaryGenerationStep,
  resetDebateState
} = debateSlice.actions;

// Export selectors
export const selectDebate = (state: RootState) => state.debate.debate;
export const selectLocalMessages = (state: RootState) => state.debate.localMessages;
export const selectDebateStatus = (state: RootState) => state.debate.status;
export const selectTypingIndicator = (state: RootState) => state.debate.typingIndicator;
export const selectMessageBeingSent = (state: RootState) => state.debate.messageBeingSent;
export const selectSummaryGenerationStep = (state: RootState) => state.debate.summaryGenerationStep;
export const selectError = (state: RootState) => state.debate.error;

// Calculate derived state
export const selectCanSendMessages = (state: RootState) => {
  const { status, localMessages, debate } = state.debate;
  
  if (!debate) return false;
  if (status === 'sendingMessage' || status === 'waitingForBot') return false;
  if (status === 'generatingSummary' || status === 'completed') return false;
  
  // Don't allow sending if the last message was from the user (waiting for bot response)
  if (localMessages.length > 0 && localMessages[localMessages.length - 1].role === 'user') {
    return false;
  }
  
  return true;
};

export const selectMaxRoundsReached = (state: RootState) => {
  const { localMessages, debate } = state.debate;
  if (!debate || !debate.maxRounds) return false;
  
  const userMessageCount = localMessages.filter(msg => msg.role === 'user').length;
  return userMessageCount >= debate.maxRounds;
};

// Export reducer
export default debateSlice.reducer;