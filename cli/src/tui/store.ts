/**
 * TUI State Management with Zustand
 */

import { create } from "zustand";
import { CLIState, TUIMessage } from "@/types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("tui-store");

const generateSessionId = () => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export interface Suggestion {
  command: string;
  description: string;
  confidence: number;
}

export interface TUIStore extends CLIState {
  // Message management
  addMessage: (message: Omit<TUIMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;
  getMessages: () => TUIMessage[];

  // Tool management
  setActiveTool: (toolId: string | undefined) => void;
  setConnected: (connected: boolean) => void;

  // Profile management
  setInitialized: (initialized: boolean) => void;
  setProfile: (profile: string) => void;

  // AI state management (Phase 3/4)
  setSuggestions: (suggestions: Suggestion[]) => void;
  getSuggestions: () => Suggestion[];
  setAIConnected: (connected: boolean) => void;
  getAIConnected: () => boolean;
  setSessionTokens: (tokens: number) => void;
  getSessionTokens: () => number;
  setSessionCost: (cost: number) => void;
  getSessionCost: () => number;
  setIsStreaming: (streaming: boolean) => void;
  getIsStreaming: () => boolean;
}

export const useTUIStore = create<TUIStore>((set, get) => ({
  isInitialized: false,
  currentProfile: "default",
  messages: [],
  activeTool: undefined,
  isConnected: false,
  sessionId: generateSessionId(),

  // AI state
  suggestions: [] as Suggestion[],
  aiConnected: false,
  sessionTokens: 0,
  sessionCost: 0,
  isStreaming: false,

  // Message management
  addMessage: (message: Omit<TUIMessage, "id" | "timestamp">) => {
    const newMessage: TUIMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
    }));

    logger.debug({ messageType: message.type }, "Message added to store");
  },

  clearMessages: () => {
    set({ messages: [] });
    logger.debug("Messages cleared from store");
  },

  getMessages: () => get().messages,

  // Tool management
  setActiveTool: (toolId: string | undefined) => {
    set({ activeTool: toolId });
    logger.debug({ toolId }, "Active tool changed");
  },

  setConnected: (connected: boolean) => {
    set({ isConnected: connected });
    logger.debug({ connected }, "Connection status changed");
  },

  // Profile management
  setInitialized: (initialized: boolean) => {
    set({ isInitialized: initialized });
    logger.debug({ initialized }, "Initialization status changed");
  },

  setProfile: (profile: string) => {
    set({ currentProfile: profile });
    logger.debug({ profile }, "Profile changed");
  },

  // AI state management
  setSuggestions: (suggestions: Suggestion[]) => {
    set({ suggestions });
    logger.debug({ count: suggestions.length }, "Suggestions updated");
  },

  getSuggestions: () => get().suggestions,

  setAIConnected: (connected: boolean) => {
    set({ aiConnected: connected });
    logger.debug({ connected }, "AI connection status changed");
  },

  getAIConnected: () => get().aiConnected,

  setSessionTokens: (tokens: number) => {
    set({ sessionTokens: tokens });
  },

  getSessionTokens: () => get().sessionTokens,

  setSessionCost: (cost: number) => {
    set({ sessionCost: cost });
  },

  getSessionCost: () => get().sessionCost,

  setIsStreaming: (streaming: boolean) => {
    set({ isStreaming: streaming });
  },

  getIsStreaming: () => get().isStreaming,
}));
