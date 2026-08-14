"use client";

import { create } from "zustand";
import type { DeAISession, DeAIEvent } from "@/types";

interface DeAIStore {
  session: DeAISession | null;
  reset: () => void;
  start: (text: string) => void;
  appendEvent: (event: DeAIEvent) => void;
}

const emptySession = (text: string): DeAISession => ({
  originalText: text,
  fingerprints: { deepseek: undefined, MiniMax: undefined, zhipu: undefined },
  conflicts: [],
  challenges: [],
  challengeResponses: [],
  suggestions: [],
  rewriteVersions: [],
  events: [],
  isRunning: true,
  startedAt: Date.now(),
});

export const useDeAIStore = create<DeAIStore>((set, get) => ({
  session: null,
  reset: () => set({ session: null }),
  start: (text) => set({ session: emptySession(text) }),
  appendEvent: (event) => {
    const s = get().session;
    if (!s) return;
    const next = { ...s, events: [...s.events, event] };
    switch (event.stage) {
      case "fingerprint":
        if (event.type === "result") {
          next.fingerprints = { ...next.fingerprints, [event.data.provider]: event.data };
        }
        break;
      case "compare":
        if (event.type === "result") {
          next.conflicts = event.data;
        }
        break;
      case "challenge":
        if (event.type === "challenge") {
          next.challenges = [...next.challenges, event.data];
        } else if (event.type === "response") {
          next.challengeResponses = [...next.challengeResponses, event.data];
        } else if (event.type === "end") {
          // noop
        }
        break;
      case "rewrite":
        if (event.type === "result") {
          next.suggestions = event.data.suggestions;
          next.rewriteVersions = event.data.versions;
        }
        break;
      case "done":
        next.isRunning = false;
        next.finishedAt = Date.now();
        break;
      case "error":
        next.isRunning = false;
        next.finishedAt = Date.now();
        break;
    }
    set({ session: next });
  },
}));