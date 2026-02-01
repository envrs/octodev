/**
 * TUI State Management with Zustand
 */

import { create } from "zustand";
import { CLIState, TUIMessage } from "@/types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("tui-store");

const generateSessionId = () => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export interface TUIStore extends CLIState {
  addMessage: (message: Omit<TUIMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;
  setActiveTool: (toolId: string | undefined) => void;
  setConnected: (connected: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setProfile: (profile: string) => void;
  getMessages: () => TUIMessage[];
}

export const useTUIStore = create<TUIStore>((set, get) => ({
  isInitialized: false,
  currentProfile: "default",
  messages: [],
  activeTool: undefined,
  isConnected: false,
  sessionId: generateSessionId(),

  addMessage: (message: Omit<TUIMessage, "id" | "timestamp">) => {
    const newMessage: TUIMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage],
    }));

    logger.debug({ messageType: message.type, content: message.content }, "Message added to store");
  },

  clearMessages: () => {
    set({ messages: [] });
    logger.debug("Messages cleared from store");
  },

  setActiveTool: (toolId: string | undefined) => {
    set({ activeTool: toolId });
    logger.debug({ toolId }, "Active tool changed");
  },

  setConnected: (connected: boolean) => {
    set({ isConnected: connected });
    logger.debug({ connected }, "Connection status changed");
  },

  setInitialized: (initialized: boolean) => {
    set({ isInitialized: initialized });
    logger.debug({ initialized }, "Initialization status changed");
  },

  setProfile: (profile: string) => {
    set({ currentProfile: profile });
    logger.debug({ profile }, "Profile changed");
  },

  getMessages: () => {
    return get().messages;
  },
}));
