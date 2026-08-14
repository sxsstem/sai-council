"use client";

import { useState } from "react";
import { useSettingsStore, useEnabledConfigs } from "@/store/settings";
import { useToastStore } from "@/store/toast";
import { useDeAIStore } from "@/store/deai";
import { useHistoryStore } from "@/store/history";
import { HistoryItem } from "@/types";

export function DeAIInputOnly() {
  const [text, setText] = useState("");
  const enabledConfigs = useEnabledConfigs();
  const pushToast = useToastStore((s) => s.push);
  const addHistory = useHistoryStore((s) => s.add);
  const startDeAI = useDeAIStore((s) => s.start);
  const appendDeAIEvent = useDeAIStore((s) => s.appendEvent);

  async function handleStart() {
    if (!text.trim() || text.trim().length < 30) {
      pushToast({ type: "warn", message: "请粘贴至少 30 字以上的文本" });
      return;
    }
    if (enabledConfigs.length < 2) {
      pushToast({ type: "warn", message: "至少需要 2 个启用的模型" });
      return;
    }

    const startTime = Date.now();
    startDeAI(text.trim());

    try {
      const resp = await fetch("/api/deai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), configs: enabledConfigs }),
      });
      if (!resp.body) throw new Error("无响应");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
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
            appendDeAIEvent(JSON.parse(payload));
          } catch {}
        }
      }
      const session = useDeAIStore.getState().session;
      if (session) {
        addHistory({
          id: `${startTime}-${Math.random().toString(36).slice(2, 8)}`,
          mode: "deai",
          title: text.trim().slice(0, 50),
          preview: text.trim(),
          startedAt: startTime,
          finishedAt: Date.now(),
          data: session,
        });
      }
      pushToast({ type: "ok", message: `风格审计完成 · ${((Date.now() - startTime) / 1000).toFixed(1)}s` });
    } catch (e) {
      pushToast({ type: "error", message: `请求失败: ${(e as Error).message}` });
    }
  }

  return (
    <div className="bg-white border border-line rounded-lg p-5">
      <div className="text-xs text-ink-3 mb-2">粘贴需要审计的文本(至少 30 字)</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例:在数字化浪潮下,品牌需要通过闭环赋能用户,打造完整链路,提升复盘效率..."
        className="w-full h-40 px-3 py-2 text-sm text-ink bg-white border border-line-strong rounded-md resize-y focus:outline-none focus:border-accent placeholder:text-ink-3"
      />
      <div className="flex justify-end mt-3">
        <button
          onClick={handleStart}
          disabled={text.trim().length < 30}
          className="px-5 py-2 rounded-md text-sm font-semibold bg-accent text-white hover:bg-blue-700 disabled:bg-line disabled:text-ink-3 disabled:cursor-not-allowed"
        >
          开始审计
        </button>
      </div>
    </div>
  );
}