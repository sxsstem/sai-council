"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCouncilStore } from "@/store/council";
import { useEnabledConfigs } from "@/store/settings";
import { useToastStore } from "@/store/toast";
import { useHistoryStore } from "@/store/history";
import { useFilesStore } from "@/store/files";
import { cn } from "@/lib/utils";
import { ArrowRight, Settings2, Loader2, Square, FileText } from "lucide-react";

export function QueryInput({ filesHint = false }: { filesHint?: boolean }) {
  const [query, setQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const start = useCouncilStore((s) => s.start);
  const reset = useCouncilStore((s) => s.reset);
  const session = useCouncilStore((s) => s.session);
  const isRunning = useCouncilStore((s) => s.isRunning);
  const startedAt = useCouncilStore((s) => s.session?.startedAt);
  const finishedAt = useCouncilStore((s) => (s.session?.isRunning === false ? Date.now() : null));
  const enabledConfigs = useEnabledConfigs();
  const pushToast = useToastStore((s) => s.push);
  const addHistory = useHistoryStore((s) => s.add);
  const readyFiles = useFilesStore((s) => s.files.filter((f) => f.status === "ready" && f.parsed));

  const enabledCount = enabledConfigs.length;
  const notConfigured = enabledCount < 2;

  // ⌘+K 聚焦输入框
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Esc 取消运行中
  useEffect(() => {
    if (!isRunning) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        reset();
        pushToast({ type: "info", message: "已取消本次合议" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isRunning, reset, pushToast]);

  async function handleStart() {
    if (!query.trim() || isRunning) return;
    if (notConfigured) {
      pushToast({ type: "warn", message: "至少需要启用 2 个模型,跳转到配置页" });
      setTimeout(() => router.push("/settings"), 600);
      return;
    }

    const abortCtrl = new AbortController();
    reset();
    const startTime = Date.now();
    const userQuery = query.trim();

    // 如果有文件,把文件内容附到 query 后面
    let fullQuery = userQuery;
    if (readyFiles.length > 0) {
      const fileContext = readyFiles
        .map((f, i) => {
          const head = `[参考文件 ${i + 1}] ${f.filename} (${f.parsed!.meta.wordCount} 字)`;
          const tail = f.parsed!.text.length > 3000
            ? f.parsed!.text.slice(0, 3000) + "\n...(截断)"
            : f.parsed!.text;
          return `${head}\n${tail}`;
        })
        .join("\n\n");
      fullQuery = `${userQuery}\n\n---\n\n## 参考资料\n${fileContext}`;
    }

    start(fullQuery);

    try {
      const resp = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: fullQuery, configs: enabledConfigs }),
        signal: abortCtrl.signal,
      });

      if (!resp.body) throw new Error("响应无 body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      const appendEvent = useCouncilStore.getState().appendEvent;

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          try {
            const event = JSON.parse(payload);
            appendEvent(event);
          } catch {}
        }
      }

      const ms = Date.now() - startTime;
      pushToast({ type: "ok", message: `合议完成,耗时 ${(ms / 1000).toFixed(1)}s` });

      // 完成后存历史(等 isRunning=false 再存,确保数据完整)
      const session = useCouncilStore.getState().session;
      if (session && !session.isRunning) {
        const titleSuffix = readyFiles.length > 0 ? ` 📎 ${readyFiles.length} 个文件` : "";
        addHistory({
          id: `${startTime}-${Math.random().toString(36).slice(2, 8)}`,
          mode: "fact_check",
          title: userQuery + titleSuffix,
          preview: userQuery,
          startedAt: startTime,
          finishedAt: Date.now(),
          data: session,
        });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      pushToast({ type: "error", message: `请求失败: ${(e as Error).message}` });
      // 关键修复:出错时也要把 isRunning 置 false,否则光标永远闪
      useCouncilStore.getState().appendEvent({ stage: "done", type: "ok" });
    }
  }

  function handleStop() {
    reset();
    pushToast({ type: "info", message: "已停止合议" });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleStart();
    }
  }

  return (
    <div className="bg-white border border-line rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-2">待核查陈述 / 问题</h2>
        <div className="flex items-center gap-3 text-xs text-ink-3">
          <span>
            已启用模型:{" "}
            <span className={cn("font-semibold", enabledCount >= 2 ? "text-ok" : "text-warn")}>
              {enabledCount}/3
            </span>
          </span>
          <button
            onClick={() => router.push("/settings")}
            className="flex items-center gap-1 text-accent hover:underline"
          >
            <Settings2 size={12} />
            {enabledCount >= 2 ? "管理" : "去配置"}
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="例:埃菲尔铁塔有多高?/ 某个科学常识 / 一段待核实陈述..."
        className="w-full h-24 px-3 py-2 text-sm text-ink bg-white border border-line-strong rounded-md resize-none focus:outline-none focus:border-accent placeholder:text-ink-3"
        disabled={isRunning}
      />

      {notConfigured && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-warn-soft border border-warn/20 rounded-md">
          <div className="text-warn mt-0.5">⚠</div>
          <div className="flex-1 text-xs text-ink-2">
            <div className="font-semibold text-warn mb-1">尚未配置模型</div>
            <div>Council 至少需要 2 个启用的模型才能跑合议。
              <button onClick={() => router.push("/settings")} className="text-accent hover:underline ml-1">
                去配置 →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-ink-3">
          {session && !isRunning && (
            <span>本次共 {session.events.length} 个事件 · ⌘+Enter 开始 · ⌘+K 聚焦</span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              合议进行中 · Esc 取消
            </span>
          )}
        </div>
        {isRunning ? (
          <button
            onClick={handleStop}
            className="px-5 py-2 rounded-md text-sm font-semibold bg-warn text-white hover:bg-red-700 flex items-center gap-1.5"
          >
            <Square size={12} fill="currentColor" />
            停止
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={!query.trim()}
            className={cn(
              "px-5 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5",
              !query.trim()
                ? "bg-line text-ink-3 cursor-not-allowed"
                : "bg-accent text-white hover:bg-blue-700"
            )}
          >
            开始核查
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}