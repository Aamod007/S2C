import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatSession {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingMessageId: string | null;
}

interface ChatState {
  sessions: Record<string, ChatSession>;
}

const initialState: ChatState = {
  sessions: {},
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    initializeChat: (state, action: PayloadAction<string>) => {
      const shapeId = action.payload;
      if (!state.sessions[shapeId]) {
        state.sessions[shapeId] = {
          messages: [],
          isStreaming: false,
          streamingMessageId: null,
        };
      }
    },

    addUserMessage: (
      state,
      action: PayloadAction<{ shapeId: string; message: ChatMessage }>
    ) => {
      const { shapeId, message } = action.payload;
      if (!state.sessions[shapeId]) {
        state.sessions[shapeId] = {
          messages: [],
          isStreaming: false,
          streamingMessageId: null,
        };
      }
      state.sessions[shapeId].messages.push(message);
    },

    startStreamingResponse: (
      state,
      action: PayloadAction<{ shapeId: string; messageId: string }>
    ) => {
      const { shapeId, messageId } = action.payload;
      if (state.sessions[shapeId]) {
        state.sessions[shapeId].isStreaming = true;
        state.sessions[shapeId].streamingMessageId = messageId;
        state.sessions[shapeId].messages.push({
          id: messageId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        });
      }
    },

    updateStreamingContent: (
      state,
      action: PayloadAction<{ shapeId: string; content: string }>
    ) => {
      const { shapeId, content } = action.payload;
      const session = state.sessions[shapeId];
      if (session && session.streamingMessageId) {
        const msg = session.messages.find(
          (m) => m.id === session.streamingMessageId
        );
        if (msg) {
          msg.content = content;
        }
      }
    },

    finishedStreamingResponse: (
      state,
      action: PayloadAction<string>
    ) => {
      const shapeId = action.payload;
      if (state.sessions[shapeId]) {
        state.sessions[shapeId].isStreaming = false;
        state.sessions[shapeId].streamingMessageId = null;
      }
    },

    handleError: (
      state,
      action: PayloadAction<{ shapeId: string; error: string }>
    ) => {
      const { shapeId, error } = action.payload;
      if (state.sessions[shapeId]) {
        state.sessions[shapeId].isStreaming = false;
        state.sessions[shapeId].streamingMessageId = null;
        state.sessions[shapeId].messages.push({
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${error}`,
          timestamp: Date.now(),
        });
      }
    },

    clearChat: (state, action: PayloadAction<string>) => {
      delete state.sessions[action.payload];
    },

    removeChat: (state, action: PayloadAction<string>) => {
      delete state.sessions[action.payload];
    },
  },
});

export const {
  initializeChat,
  addUserMessage,
  startStreamingResponse,
  updateStreamingContent,
  finishedStreamingResponse,
  handleError,
  clearChat,
  removeChat,
} = chatSlice.actions;
export default chatSlice.reducer;
