"use client";

import { useCouncilStore } from "@/store/council";
import { PROVIDER_META, Provider } from "@/types";
import { cn } from "@/lib/utils";

const PROVIDERS: Provider[] = ["deepseek", "MiniMax", "zhipu"];

export function AnswerPanel() {
  const session = useCouncilStore((s) => s.session);
  const isRunning = useCouncilStore((s) => s.isRunning);
  if (!session) return null;

  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-zinc-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-accent">③</span>
          <h3 className="text-sm font-semibold">独立作答</h3>
          <span className="text-xs text-ink-3 ml-auto">基于各自检索到的证据</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
        {PROVIDERS.map((p) => {
          const meta = PROVIDER_META[p];
          const ans = session.answers[p];
          const text = ans?.answer || "";
          const isStreaming = isRunning && text && !session.events.some(
            (e) => e.stage === "answer" && e.type === "result" && e.provider === p
          );

          return (
            <div key={p} className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                <span className="text-sm font-semibold">{meta.name}</span>
                {isStreaming && <span className="text-xs text-accent ml-auto streaming">输出中</span>}
                {ans?.answerMs && !isStreaming && (
                  <span className="text-xs text-ink-3 ml-auto">{(ans.answerMs / 1000).toFixed(1)}s</span>
                )}
              </div>
              <div className={cn("text-sm text-ink-2 leading-relaxed whitespace-pre-wrap min-h-[80px]", isStreaming && "streaming")}>
                {text || <span className="text-ink-3">等待作答...</span>}
              </div>
              {ans?.claims && ans.claims.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line">
                  <div className="text-xs font-semibold text-ink-3 mb-1">关键论据({ans.claims.length})</div>
                  <ul className="space-y-1">
                    {ans.claims.map((c, i) => (
                      <li key={i} className="text-xs text-ink-2 pl-3 relative">
                        <span className="absolute left-0 top-1.5 w-1.5 h-1.5 bg-accent rounded-sm" />
                        {c.text}
                        {c.evidenceIds && c.evidenceIds.length > 0 && (
                          <span className="ml-1 text-ink-3">[{c.evidenceIds.join(",")}]</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}