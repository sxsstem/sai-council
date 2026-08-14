"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HistoryItem, WorkflowMode } from "@/types";

interface HistoryStore {
  items: HistoryItem[];
  add: (item: HistoryItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  getById: (id: string) => HistoryItem | undefined;
}

const MAX_ITEMS = 50; // localStorage 5MB 限制下够存

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) =>
        set((s) => {
          // 去重:同 id 的覆盖,否则插到最前
          const filtered = s.items.filter((x) => x.id !== item.id);
          return { items: [item, ...filtered].slice(0, MAX_ITEMS) };
        }),
      remove: (id) =>
        set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      clear: () => set({ items: [] }),
      getById: (id) => get().items.find((x) => x.id === id),
    }),
    { name: "council-history" }
  )
);

// 工具:生成历史条目
export function makeHistoryItem(opts: {
  mode: WorkflowMode;
  title: string;
  preview: string;
  startedAt: number;
  finishedAt: number;
  data: any;
}): HistoryItem {
  return {
    id: `${opts.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
    mode: opts.mode,
    title: opts.title.slice(0, 50) || "未命名",
    preview: opts.preview.slice(0, 100),
    startedAt: opts.startedAt,
    finishedAt: opts.finishedAt,
    data: opts.data,
  };
}