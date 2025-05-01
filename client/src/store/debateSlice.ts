import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Debate, Message } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

// Define the state machine states
export type DebateStatus = 
  | 'idle'                  // Initial state
  | 'loadingDebate'         // Loading debate data
  | 'active'                // Debate active, user can send messages
  | 'sendingMessage'        // User message is being sent to server
  | 'waitingForBot'         // Waiting for bot to respond
  | 'finalRound'            // Final round reached, summarize button available
  | 'generatingSummary'     // Generating the debate summary
  | 'completed';            // Debate is complete with summary

export type TypingIndicator = {
  id: string;
  timestamp: number;
};

interface DebateState {
  status: DebateStatus;
  debate: Debate | null;
  localMessages: Message[];
  typingIndicator: TypingIndicator | null;
  summaryGenerationStep: number | null;
  pollCount: number;
  error: string | null;
  maxRoundsReached: boolean;
}

const initialState: DebateState = {
  status: 'idle',
  debate: null,
  localMessages: [],
  typingIndicator: null,
  summaryGenerationStep: null,
  pollCount: 0,
  error: null,
  maxRoundsReached: false
};

// Async thunks for API interactions
export const fetchDebate = createAsyncThunk(
  'debate/fetchDebate',
  async ({ secureId, id }: { secureId?: string; id?: string }) => {
    const endpoint = secureId 
      ? `/api/debates/s/${secureId}` 
      : `/api/debates/${id}`;
    
    const response = await apiRequest('GET', endpoint);
    return await response.json();
  }
);

export const createDebate = createAsyncThunk(
  'debate/createDebate',
  async ({ partyId, topic, maxRounds }: { partyId: number, topic: string, maxRounds: number }) => {
    const response = await apiRequest('POST', '/api/debates', { partyId, topic, maxRounds });
    return await response.json();
  }
);

export const sendMessage = createAsyncThunk(
  'debate/sendMessage',
  async ({ content, secureId, id }: { content: string, secureId?: string, id?: string }, { getState, dispatch }) => {
    const endpoint = secureId 
      ? `/api/debates/s/${secureId}/messages` 
      : `/api/debates/${id}/messages`;
    
    // Before API call, add a temporary user message to show immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now()
    };
    
    dispatch(addTempUserMessage(tempUserMessage));
    
    try {
      const response = await apiRequest('POST', endpoint, { content });
      const result = await response.json();
      
      // Start polling for AI response
      dispatch(startPolling({ secureId, id }));
      
      return result;
    } catch (error: any) {
      // Mark the message as failed
      dispatch(markMessageAsFailed(`temp-${Date.now()}`));
      throw error;
    }
  }
);

export const endDebate = createAsyncThunk(
  'debate/endDebate',
  async ({ secureId, id }: { secureId?: string, id?: string }) => {
    const endpoint = secureId 
      ? `/api/debates/s/${secureId}/end` 
      : `/api/debates/${id}/end`;
    
    const response = await apiRequest('POST', endpoint);
    return await response.json();
  }
);

export const pollForResponse = createAsyncThunk(
  'debate/pollForResponse',
  async ({ secureId, id }: { secureId?: string, id?: string }, { getState, dispatch }) => {
    const endpoint = secureId 
      ? `/api/debates/s/${secureId}` 
      : `/api/debates/${id}`;
    
    try {
      const response = await fetch(endpoint, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      const fetchedData = await response.json();
      
      // Compare message counts to check if there's a new message
      const state = getState() as { debate: DebateState };
      const realLocalMessages = state.debate.localMessages.filter(msg => !msg.id.startsWith('typing-')).length;
      
      if (fetchedData.messages.length > realLocalMessages) {
        // We have a new message, stop polling
        dispatch(stopPolling());
        return fetchedData;
      }
      
      // Continue polling if threshold not reached
      if (state.debate.pollCount < 30) {
        setTimeout(() => {
          dispatch(incrementPollCount());
          dispatch(pollForResponse({ secureId, id }));
        }, state.debate.pollCount > 5 ? 3000 : 1000);
      } else {
        // Max poll attempts reached
        dispatch(stopPolling());
        throw new Error("Max polling attempts reached. Try refreshing the page.");
      }
      
      return null; // No new messages yet
    } catch (error: any) {
      dispatch(stopPolling());
      throw error;
    }
  }
);

const debateSlice = createSlice({
  name: 'debate',
  initialState,
  reducers: {
    // Add a temporary user message (before API confirmation)
    addTempUserMessage: (state, action: PayloadAction<Message>) => {
      state.localMessages.push(action.payload);
    },
    
    // Mark a message as failed
    markMessageAsFailed: (state, action: PayloadAction<string>) => {
      state.localMessages = state.localMessages.map(msg => {
        if (msg.id === action.payload && !msg.content.includes('(Failed to send)')) {
          return {
            ...msg,
            content: `${msg.content} (Failed to send)`,
          };
        }
        return msg;
      });
    },
    
    // Show typing indicator
    showTypingIndicator: (state) => {
      if (!state.typingIndicator) {
        const uniqueId = `typing-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        state.typingIndicator = {
          id: uniqueId,
          timestamp: Date.now()
        };
        
        state.localMessages.push({
          id: uniqueId,
          role: 'assistant',
          content: '...',
          timestamp: Date.now()
        });
      }
    },
    
    // Hide typing indicator
    hideTypingIndicator: (state) => {
      if (state.typingIndicator) {
        state.localMessages = state.localMessages.filter(
          msg => msg.id !== state.typingIndicator?.id
        );
        state.typingIndicator = null;
      }
    },
    
    // Add bot response (after API confirmation)
    addBotResponse: (state, action: PayloadAction<Message>) => {
      // First ensure typing indicator is removed
      if (state.typingIndicator) {
        state.localMessages = state.localMessages.filter(
          msg => msg.id !== state.typingIndicator?.id
        );
        state.typingIndicator = null;
      }
      
      // Then add the real message
      state.localMessages.push(action.payload);
      
      // Check if max rounds reached
      if (state.debate) {
        const userMessages = state.localMessages.filter(msg => msg.role === 'user').length;
        if (userMessages >= (state.debate.maxRounds || 6)) {
          state.maxRoundsReached = true;
          state.status = 'finalRound';
        } else {
          state.status = 'active';
        }
      }
    },
    
    // Start polling
    startPolling: (state) => {
      state.pollCount = 0;
      state.status = 'waitingForBot';
    },
    
    // Stop polling
    stopPolling: (state) => {
      state.pollCount = 0;
    },
    
    // Increment poll count
    incrementPollCount: (state) => {
      state.pollCount += 1;
    },
    
    // Set summary generation step
    setSummaryGenerationStep: (state, action: PayloadAction<number>) => {
      state.summaryGenerationStep = action.payload;
    },
    
    // Reset state
    resetState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // fetchDebate reducers
      .addCase(fetchDebate.pending, (state) => {
        state.status = 'loadingDebate';
      })
      .addCase(fetchDebate.fulfilled, (state, action) => {
        state.debate = action.payload;
        if (action.payload.completed) {
          state.status = 'completed';
        } else {
          state.status = 'active';
          
          // Check if max rounds reached
          if (action.payload.messages) {
            const userMessagesCount = action.payload.messages.filter(
              (msg: Message) => msg.role === 'user'
            ).length;
            
            if (userMessagesCount >= (action.payload.maxRounds || 6)) {
              state.maxRoundsReached = true;
              state.status = 'finalRound';
            }
          }
        }
        
        // Initialize local messages
        if (state.localMessages.length === 0 && action.payload.messages) {
          state.localMessages = action.payload.messages;
        }
      })
      .addCase(fetchDebate.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.error.message || 'Failed to fetch debate';
      })
      
      // createDebate reducers
      .addCase(createDebate.pending, (state) => {
        state.status = 'loadingDebate';
      })
      .addCase(createDebate.fulfilled, (state, action) => {
        state.debate = action.payload;
        state.status = 'active';
        state.localMessages = action.payload.messages || [];
      })
      .addCase(createDebate.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.error.message || 'Failed to create debate';
      })
      
      // sendMessage reducers
      .addCase(sendMessage.pending, (state) => {
        state.status = 'sendingMessage';
      })
      .addCase(sendMessage.fulfilled, (state) => {
        // Don't change status here - the polling will handle that
        state.status = 'waitingForBot';
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.status = 'active';
        state.error = action.error.message || 'Failed to send message';
      })
      
      // endDebate reducers
      .addCase(endDebate.pending, (state) => {
        state.status = 'generatingSummary';
        state.summaryGenerationStep = 1;
      })
      .addCase(endDebate.fulfilled, (state, action) => {
        state.status = 'completed';
        state.debate = action.payload;
      })
      .addCase(endDebate.rejected, (state, action) => {
        state.status = 'active';
        state.error = action.error.message || 'Failed to generate summary';
      })
      
      // pollForResponse reducers
      .addCase(pollForResponse.fulfilled, (state, action) => {
        if (action.payload) {
          // We got a response, update debate and add bot message
          state.debate = action.payload;
          
          // Find the latest assistant message
          if (action.payload.messages) {
            const assistantMessages = action.payload.messages.filter(
              (msg: Message) => msg.role === 'assistant'
            );
            
            if (assistantMessages.length > 0) {
              const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];
              
              // First remove typing indicator if present
              if (state.typingIndicator) {
                state.localMessages = state.localMessages.filter(
                  msg => msg.id !== state.typingIndicator?.id
                );
                state.typingIndicator = null;
              }
              
              // Add the new message if it's not already in the local messages
              const messageExists = state.localMessages.some(msg => msg.id === latestAssistantMessage.id);
              if (!messageExists) {
                state.localMessages.push(latestAssistantMessage);
              }
              
              // Check if max rounds reached
              const userMessagesCount = action.payload.messages.filter(
                (msg: Message) => msg.role === 'user'
              ).length;
              
              if (userMessagesCount >= (action.payload.maxRounds || 6)) {
                state.maxRoundsReached = true;
                state.status = 'finalRound';
              } else {
                state.status = 'active';
              }
            }
          }
        }
      })
      .addCase(pollForResponse.rejected, (state, action) => {
        // Hide typing indicator if there was an error
        if (state.typingIndicator) {
          state.localMessages = state.localMessages.filter(
            msg => msg.id !== state.typingIndicator?.id
          );
          state.typingIndicator = null;
        }
        
        state.status = 'active';
        state.error = action.error.message || 'Failed to get bot response';
      });
  },
});

// Export actions
export const {
  addTempUserMessage,
  markMessageAsFailed,
  showTypingIndicator,
  hideTypingIndicator,
  addBotResponse,
  startPolling,
  stopPolling,
  incrementPollCount,
  setSummaryGenerationStep,
  resetState
} = debateSlice.actions;

// Export selectors
export const selectDebate = (state: { debate: DebateState }) => state.debate.debate;
export const selectDebateStatus = (state: { debate: DebateState }) => state.debate.status;
export const selectLocalMessages = (state: { debate: DebateState }) => state.debate.localMessages;
export const selectTypingIndicator = (state: { debate: DebateState }) => state.debate.typingIndicator;
export const selectSummaryGenerationStep = (state: { debate: DebateState }) => state.debate.summaryGenerationStep;
export const selectError = (state: { debate: DebateState }) => state.debate.error;
export const selectMaxRoundsReached = (state: { debate: DebateState }) => state.debate.maxRoundsReached;

// Input can be used if: 
// 1. We're in active state
// 2. Not the final round
// 3. Last message is not from user
export const selectCanSendMessages = (state: { debate: DebateState }) => {
  const { status, localMessages, maxRoundsReached } = state.debate;
  
  if (status !== 'active' || maxRoundsReached) {
    return false;
  }
  
  if (localMessages.length === 0) {
    return true;
  }
  
  return localMessages[localMessages.length - 1].role !== 'user';
};

export default debateSlice.reducer;