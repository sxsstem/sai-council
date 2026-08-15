"use client";

import { useState } from "react";
import { useCouncilStore } from "@/store/council";
import { useDeAIStore } from "@/store/deai";
import { QueryInput } from "@/components/QueryInput";
import { StageProgress } from "@/components/StageProgress";
import { RetrievalPanel } from "@/components/RetrievalPanel";
import { AnswerPanel } from "@/components/AnswerPanel";
import { DebatePanel } from "@/components/DebatePanel";
import { EvidenceMatrixPanel } from "@/components/EvidenceMatrixPanel";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { ExportButton } from "@/components/ExportButton";
import { ToastHost } from "@/components/ToastHost";
import { DeAIResult } from "@/components/DeAIResult";
import { HistorySidebar } from "@/components/HistorySidebar";
import { FileUploader } from "@/components/FileUploader";
import { useFilesStore } from "@/store/files";
import { WorkflowMode } from "@/types";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const MODE_META: Record<WorkflowMode, { label: string; desc: string }> = {
  fact_check: { label: "事实核查", desc: "多模型独立检索 + 证据对账" },
  deai: { label: "去 AI 味", desc: "识别 AI 表达,生成改写建议" },
};

export default function HomePage() {
  const councilSession = useCouncilStore((s) => s.session);
  const deaiSession = useDeAIStore((s) => s.session);
  const [mode, setMode] = useState<WorkflowMode>("fact_check");

  return (
    <div className="min-h-screen">
      <ToastHost />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs tracking-widest text-ink-3 font-semibold">SAI COUNCIL</div>
              <h1 className="text-2xl font-bold mt-1">多模型合议</h1>
              <p className="text-sm text-ink-2 mt-1 max-w-2xl">
                两个工作流,同一个引擎:多模型独立判断、互相质询、带证据链地给你结论。
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <ExportButton alwaysShow />
              <a
                href="/settings"
                className="px-3 py-1.5 text-xs font-semibold border border-line rounded hover:bg-zinc-50"
              >
                模型配置
              </a>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* 主区 */}
          <div className="space-y-4">
            {/* Tab 切换 */}
            <div className="flex items-center gap-3">
              <div className="bg-white border border-line rounded-lg p-1 inline-flex">
                {(Object.keys(MODE_META) as WorkflowMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "px-4 py-2 rounded-md text-sm font-semibold transition-colors",
                      mode === m
                        ? "bg-accent text-white"
                        : "text-ink-2 hover:bg-zinc-50"
                    )}
                  >
                    {MODE_META[m].label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-ink-3">{MODE_META[mode].desc}</span>
            </div>

            {/* 文件上传区(顶部常驻,两个工作流共用) */}
            <FileUploader />

            {/* 输入区 */}
            {mode === "fact_check" ? (
              <FactCheckBlock hasSession={!!councilSession} />
            ) : (
              <DeAIBlock hasSession={!!deaiSession} />
            )}

            {/* 结果区 */}
            {mode === "fact_check" && councilSession && (
              <>
                <HistoryBadge mode="fact_check" />
                <StageProgress />
                <RetrievalPanel />
                <AnswerPanel />
                <DebatePanel />
                <EvidenceMatrixPanel />
                <RecommendationPanel />
              </>
            )}
            {mode === "deai" && deaiSession && (
              <>
                <HistoryBadge mode="deai" />
                <DeAIResult />
              </>
            )}
          </div>

          {/* 侧栏 */}
          <aside className="space-y-4">
            <HistorySidebar />
          </aside>
        </div>

        <footer className="mt-12 pt-6 border-t border-line text-xs text-ink-3">
          <div>
            <strong className="text-ink-2">声明:</strong>
            Sai Council 通过多模型独立判断 + 证据对账 / 风格审计,辅助用户决策。
            对于投资、学术、新闻等高风险场景,仍需人工复核。
          </div>
        </footer>
      </div>
    </div>
  );
}

function FactCheckBlock({ hasSession }: { hasSession: boolean }) {
  const files = useFilesStore((s) => s.files);
  const readyFiles = files.filter((f) => f.status === "ready" && f.parsed);
  return (
    <>
      <QueryInput filesHint={readyFiles.length > 0} />
      {!hasSession && <EmptyHint mode="fact_check" />}
    </>
  );
}

function DeAIBlock({ hasSession }: { hasSession: boolean }) {
  const [text, setText] = useState("");
  const enabledConfigs = useEnabledConfigs();
  const pushToast = useToastStore((s) => s.push);
  const addHistory = useHistoryStore((s) => s.add);
  const startDeAI = useDeAIStore((s) => s.start);
  const appendDeAIEvent = useDeAIStore((s) => s.appendEvent);
  const readyFiles = useFilesStore((s) => s.files.filter((f) => f.status === "ready" && f.parsed));
  const usingFiles = readyFiles.length > 0;

  async function handleStart() {
    let inputText = text.trim();

    // 必传逻辑:如果没传文件,要求粘贴文字;如果传了,用文件
    if (usingFiles) {
      inputText = readyFiles.map((f) => f.parsed!.text).join("\n\n---\n\n");
    }

    if (!inputText || inputText.length < 30) {
      pushToast({ type: "warn", message: "请粘贴至少 30 字,或上传文件" });
      return;
    }
    if (enabledConfigs.length < 2) {
      pushToast({ type: "warn", message: "至少需要 2 个启用的模型" });
      return;
    }

    const startTime = Date.now();
    startDeAI(inputText);

    try {
      const resp = await fetch("/api/deai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, configs: enabledConfigs }),
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
        const previewTitle = usingFiles
          ? `${readyFiles.map((f) => f.filename).join(", ")}`
          : inputText.slice(0, 30);
        addHistory({
          id: `${startTime}-${Math.random().toString(36).slice(2, 8)}`,
          mode: "deai",
          title: previewTitle,
          preview: inputText.slice(0, 100),
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
    <>
      <div className="bg-white border border-line rounded-lg p-5">
        <div className="text-xs text-ink-3 mb-2">
          {usingFiles
            ? `已选 ${readyFiles.length} 个文件,审计其内容(总计 ${readyFiles.reduce((s, f) => s + (f.parsed?.meta.wordCount || 0), 0)} 字)`
            : "粘贴需要审计的文本(至少 30 字)"}
        </div>
        {!usingFiles && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例:在数字化浪潮下,品牌需要通过闭环赋能用户..."
            className="w-full h-40 px-3 py-2 text-sm text-ink bg-white border border-line-strong rounded-md resize-y focus:outline-none focus:border-accent placeholder:text-ink-3"
          />
        )}
        {usingFiles && (
          <div className="bg-zinc-50 border border-line rounded p-3 text-xs text-ink-2">
            ✓ 已就绪 · 点击"开始审计"将基于文件内容生成报告
          </div>
        )}
        <div className="flex justify-end mt-3">
          <button
            onClick={handleStart}
            disabled={!usingFiles && text.trim().length < 30}
            className="px-5 py-2 rounded-md text-sm font-semibold bg-accent text-white hover:bg-blue-700 disabled:bg-line disabled:text-ink-3 disabled:cursor-not-allowed"
          >
            开始审计
          </button>
        </div>
      </div>
      {!hasSession && <EmptyHint mode="deai" />}
    </>
  );
}

function EmptyHint({ mode }: { mode: WorkflowMode }) {
  return (
    <div className="bg-white border border-line rounded-lg p-12 text-center">
      <div className="text-ink-2 text-sm">
        {mode === "fact_check" ? "输入问题,开始多模型合议" : "粘贴文本,开始风格审计"}
      </div>
      <div className="text-xs text-ink-3 mt-2">
        {mode === "fact_check"
          ? "适合场景:科学常识核查、新闻事实验证、引用真伪判断"
          : "适合场景:小红书文案、公众号文章、课程文案、自媒体草稿"}
      </div>
    </div>
  );
}

function HistoryBadge({ mode }: { mode: WorkflowMode }) {
  // 判断当前 session 是不是从历史加载的
  // 标记规则:isRunning=false 且 没有 done 事件(说明不是自然完成的)
  const session = mode === "fact_check"
    ? useCouncilStore((s) => s.session)
    : useDeAIStore((s) => s.session);
  const resetCouncil = useCouncilStore((s) => s.reset);
  const resetDeAI = useDeAIStore((s) => s.reset);
  const pushToast = useToastStore((s) => s.push);

  if (!session) return null;
  // 还在跑的,不算历史
  if (session.isRunning) return null;

  return (
    <div className="bg-accent-soft border border-accent/20 rounded-lg px-4 py-2 flex items-center justify-between">
      <div className="text-xs text-accent">
        <strong className="font-semibold">📦 正在查看合议结果</strong>
        <span className="ml-2 text-ink-2">
          从历史加载 · {new Date(session.startedAt).toLocaleString("zh-CN", { hour12: false })}
        </span>
      </div>
      <button
        onClick={() => {
          if (mode === "fact_check") resetCouncil();
          else resetDeAI();
          pushToast({ type: "info", message: "已清掉主区,开始新合议" });
        }}
        className="text-xs text-ink-2 hover:text-warn flex items-center gap-1"
      >
        <X size={11} />
        清掉,开始新合议
      </button>
    </div>
  );
}

// 小工具
import { useEnabledConfigs } from "@/store/settings";
import { useToastStore } from "@/store/toast";
import { useHistoryStore } from "@/store/history";
import type { HistoryItem } from "@/types";