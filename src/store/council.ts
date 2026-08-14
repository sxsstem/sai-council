"use client";

import { create } from "zustand";
import type {
  CouncilSession,
  CouncilEvent,
  Provider,
  ModelConfig,
  EvidenceItem,
  ModelAnswer,
  Challenge,
  ChallengeResponse,
  EvidenceMatrix,
  Classification,
} from "@/types";

interface CouncilStore {
  session: CouncilSession | null;
  isRunning: boolean;

  reset: () => void;
  start: (query: string) => void;
  appendEvent: (event: CouncilEvent) => void;

  // 便捷 selector
  getAnswer: (p: Provider) => ModelAnswer | undefined;
  getRetrieval: (p: Provider) => EvidenceItem[];
  getAnswerText: (p: Provider) => string;
}

const emptySession = (query: string): CouncilSession => ({
  query,
  startedAt: Date.now(),
  retrieval: { deepseek: undefined, MiniMax: undefined, zhipu: undefined },
  answers: { deepseek: undefined, MiniMax: undefined, zhipu: undefined },
  challenges: [],
  challengeResponses: [],
  events: [],
  isRunning: true,
});

export const useCouncilStore = create<CouncilStore>((set, get) => ({
  session: null,
  isRunning: false,

  reset: () => set({ session: null, isRunning: false }),

  start: (query) => set({ session: emptySession(query), isRunning: true }),

  appendEvent: (event) => {
    const s = get().session;
    if (!s) return;

    const next: CouncilSession = { ...s, events: [...s.events, event] };

    switch (event.stage) {
      case "classify":
        if (event.type === "result") {
          next.classification = event.data;
        }
        break;
      case "retrieve":
        if (event.type === "result") {
          next.retrieval = {
            ...next.retrieval,
            [event.provider]: {
              query: next.query,
              evidences: event.evidences,
              ms: event.ms,
            },
          };
        } else if (event.type === "error") {
          next.retrieval = {
            ...next.retrieval,
            [event.provider]: {
              query: next.query,
              evidences: [],
              error: event.error,
            },
          };
        }
        break;
      case "answer":
        if (event.type === "delta") {
          const cur = next.answers[event.provider];
          if (cur) {
            cur.answer = cur.answer + event.text;
            next.answers = { ...next.answers, [event.provider]: { ...cur } };
          } else {
            next.answers = {
              ...next.answers,
              [event.provider]: {
                provider: event.provider,
                retrievalQuery: next.query,
                evidences: [],
                answer: event.text,
                claims: [],
                answerMs: 0,
              },
            };
          }
        } else if (event.type === "result") {
          next.answers = { ...next.answers, [event.provider]: event.answer };
        }
        break;
      case "debate":
        if (event.type === "challenge") {
          next.challenges = [...next.challenges, event.data];
        } else if (event.type === "response") {
          next.challengeResponses = [...next.challengeResponses, event.data];
        }
        break;
      case "matrix":
        if (event.type === "result") {
          next.matrix = event.data;
        }
        break;
      case "recommend":
        if (event.type === "delta") {
          next.recommendationStream = (next.recommendationStream || "") + event.text;
        } else if (event.type === "result") {
          next.recommendation = event.data;
        }
        break;
      case "summary":
        if (event.type === "text") {
          next.summary = event.data;
        }
        break;
      case "done":
        next.isRunning = false;
        break;
      case "error":
        next.isRunning = false;
        break;
    }

    set({ session: next });
  },

  getAnswer: (p) => get().session?.answers[p],
  getRetrieval: (p) => get().session?.retrieval[p]?.evidences || [],
  getAnswerText: (p) => get().session?.answers[p]?.answer || "",
}));