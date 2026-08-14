"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  type: "ok" | "warn" | "error" | "info";
  message: string;
  ts: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "ts">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id, ts: Date.now() }] }));
    // 4 秒后自动消失(error 类延到 6 秒)
    const delay = t.type === "error" ? 6000 : 4000;
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, delay);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));