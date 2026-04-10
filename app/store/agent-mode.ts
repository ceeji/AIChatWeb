import { create } from "zustand";

interface AgentModeState {
  enabledSessions: Record<string, boolean>;
  setEnabled: (sessionId: string, enabled: boolean) => void;
  isEnabled: (sessionId: string) => boolean;
}

export const useAgentModeStore = create<AgentModeState>((set, get) => ({
  enabledSessions: {},
  setEnabled: (sessionId, enabled) =>
    set((s) => ({
      enabledSessions: {
        ...s.enabledSessions,
        [sessionId]: enabled,
      },
    })),
  isEnabled: (sessionId) => get().enabledSessions[sessionId] ?? false,
}));
