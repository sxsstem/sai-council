"use client";

import { create } from "zustand";
import type { ParsedFile } from "@/lib/files/parser";

export interface UploadedFile {
  id: string;
  filename: string;
  type: string;
  sizeBytes: number;
  parsed: ParsedFile | null;
  error?: string;
  /** UI 状态 */
  status: "uploading" | "ready" | "error";
}

interface FilesStore {
  files: UploadedFile[];
  addOptimistic: (filename: string, sizeBytes: number) => string;
  setResult: (id: string, result: { filename: string; type: string; sizeBytes: number; parsed: ParsedFile | null; error?: string }) => void;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  getConcatenatedText: () => string;
}

export const useFilesStore = create<FilesStore>((set, get) => ({
  files: [],

  addOptimistic: (filename, sizeBytes) => {
    const id = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      files: [
        ...s.files,
        {
          id,
          filename,
          sizeBytes,
          type: "uploading",
          parsed: null,
          status: "uploading",
        },
      ],
    }));
    return id;
  },

  setResult: (id, result) => {
    set((s) => ({
      files: s.files.map((f) =>
        f.id === id
          ? {
              ...f,
              filename: result.filename,
              type: result.type,
              sizeBytes: result.sizeBytes,
              parsed: result.parsed,
              error: result.error,
              status: result.error ? "error" : "ready",
            }
          : f
      ),
    }));
  },

  remove: async (id) => {
    set((s) => ({ files: s.files.filter((f) => f.id !== id) }));
    try {
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      // 静默失败(临时文件后台会被清理)
    }
  },

  clear: async () => {
    const ids = get().files.map((f) => f.id);
    set({ files: [] });
    if (ids.length > 0) {
      try {
        await fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
      } catch {}
    }
  },

  getConcatenatedText: () => {
    const ready = get().files.filter((f) => f.status === "ready" && f.parsed);
    if (ready.length === 0) return "";
    const blocks = ready.map((f, i) => {
      const head = `[参考文件 ${i + 1}] ${f.filename} (${f.parsed!.meta.wordCount} 字)`;
      const tail = f.parsed!.text.length > 3000
        ? f.parsed!.text.slice(0, 3000) + "\n...(截断)"
        : f.parsed!.text;
      return `${head}\n${tail}`;
    });
    return blocks.join("\n\n");
  },
}));