"use client";

import { useDeAIStore } from "@/store/deai";
import { PROVIDER_META, StyleConflict } from "@/types";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

export function DeAIResult() {
  const session = useDeAIStore((s) => s.session);
  if (!session) return null;

  const { originalText, fingerprints, conflicts, suggestions, rewriteVersions } = session;

  // 算总 AI 味分数(3 家平均)
  const scores = Object.values(fingerprints).filter(Boolean).map((f) => f!.overallScore);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return (
    <div className="space-y-4">
      {/* AI 味评分卡 */}
      <div className="bg-white border border-line rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-ink-3">AI 味总体评分</div>
            <div className="text-xs text-ink-3 mt-1">3 家模型独立评分的平均值</div>
          </div>
          <div className="text-right">
            <div className={cn(
              "text-4xl font-bold",
              avgScore >= 70 ? "text-warn" :
              avgScore >= 40 ? "text-accent" :
              "text-ok"
            )}>
              {avgScore}
            </div>
            <div className="text-xs text-ink-3">/ 100</div>
          </div>
        </div>
        <div className="mt-4 h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              avgScore >= 70 ? "bg-warn" : avgScore >= 40 ? "bg-accent" : "bg-ok"
            )}
            style={{ width: `${avgScore}%` }}
          />
        </div>
      </div>

      {/* 原文 + 高亮 */}
      <OriginalHighlight text={originalText} conflicts={conflicts} />

      {/* 共识度排序的 AI 味列表 */}
      <ConflictsList conflicts={conflicts} />

      {/* 改写建议 */}
      {suggestions.length > 0 && <SuggestionsPanel suggestions={suggestions} />}

      {/* 整体改写版本 */}
      {rewriteVersions.length > 0 && <RewriteVersions versions={rewriteVersions} />}
    </div>
  );
}

function OriginalHighlight({ text, conflicts }: { text: string; conflicts: StyleConflict[] }) {
  // 把 consensusLevel=high/mid 的高亮在原文里
  const toHighlight = conflicts.filter((c) => c.consensusLevel === "high" || c.consensusLevel === "mid");

  if (toHighlight.length === 0) {
    return (
      <div className="bg-white border border-line rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-3">原文</h3>
        <div className="text-sm text-ink-2 whitespace-pre-wrap leading-relaxed">{text}</div>
      </div>
    );
  }

  // 简单高亮:基于文本片段模糊匹配
  const segments: { text: string; highlight: boolean; level: string }[] = [];
  let remaining = text;
  let consumed = 0;

  while (remaining.length > 0) {
    let matched: { idx: number; length: number; level: string } | null = null;
    for (const c of toHighlight) {
      const idx = remaining.indexOf(c.expression);
      if (idx !== -1 && (matched === null || idx < matched.idx)) {
        matched = { idx, length: c.expression.length, level: c.consensusLevel };
      }
    }
    if (!matched) {
      segments.push({ text: remaining, highlight: false, level: "low" });
      break;
    }
    if (matched.idx > 0) {
      segments.push({ text: remaining.slice(0, matched.idx), highlight: false, level: "low" });
    }
    segments.push({ text: remaining.slice(matched.idx, matched.idx + matched.length), highlight: true, level: matched.level });
    remaining = remaining.slice(matched.idx + matched.length);
  }

  return (
    <div className="bg-white border border-line rounded-lg p-5">
      <h3 className="text-sm font-semibold mb-3">原文(标红 = AI 味)</h3>
      <div className="text-sm text-ink leading-relaxed">
        {segments.map((s, i) =>
          s.highlight ? (
            <mark
              key={i}
              className={cn(
                "px-0.5 rounded",
                s.level === "high" ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"
              )}
            >
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
      </div>
    </div>
  );
}

function ConflictsList({ conflicts }: { conflicts: StyleConflict[] }) {
  if (conflicts.length === 0) {
    return (
      <div className="bg-white border border-line rounded-lg p-5 text-center text-sm text-ok">
        ✓ 3 家模型均未发现明显 AI 味
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-zinc-50">
        <h3 className="text-sm font-semibold">识别的 AI 味表达 ({conflicts.length})</h3>
      </div>
      <div className="divide-y divide-line">
        {conflicts.map((c, i) => (
          <div key={i} className="px-5 py-3">
            <div className="flex items-start gap-3">
              <div className={cn(
                "px-2 py-1 rounded text-xs font-bold flex-shrink-0",
                c.consensusLevel === "high" ? "bg-warn-soft text-warn" :
                c.consensusLevel === "mid" ? "bg-accent-soft text-accent" :
                "bg-zinc-100 text-ink-3"
              )}>
                {c.consensusLevel === "high" ? "高" : c.consensusLevel === "mid" ? "中" : "低"}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">"{c.expression}"</div>
                <div className="text-xs text-ink-3 mt-1">
                  <span className="px-1.5 py-0.5 bg-zinc-100 rounded mr-2">{c.category}</span>
                  {c.identifiedBy.map((p) => PROVIDER_META[p].name).join(" · ")} 都识别到
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestionsPanel({ suggestions }: { suggestions: any[] }) {
  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-zinc-50">
        <h3 className="text-sm font-semibold">改写建议 ({suggestions.length})</h3>
      </div>
      <div className="divide-y divide-line">
        {suggestions.map((s, i) => (
          <div key={i} className="px-5 py-3">
            <div className="text-xs text-ink-3 mb-1">
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-bold mr-2",
                s.intensity === "保守" ? "bg-ok-soft text-ok" :
                s.intensity === "适中" ? "bg-accent-soft text-accent" :
                "bg-warn-soft text-warn"
              )}>
                {s.intensity}
              </span>
              原:{s.original}
            </div>
            <div className="text-sm text-ink mt-1">
              → {s.suggested}
            </div>
            <div className="text-xs text-ink-3 mt-1">{s.reason}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RewriteVersions({ versions }: { versions: any[] }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  return (
    <div className="bg-white border-2 border-accent/30 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-accent-soft">
        <h3 className="text-sm font-semibold text-accent">整体改写版本</h3>
      </div>
      <div className="divide-y divide-line">
        {versions.map((v, i) => (
          <div key={i} className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">{v.label}</div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(v.text);
                  setCopiedIdx(i);
                  setTimeout(() => setCopiedIdx(null), 1500);
                }}
                className="text-xs px-2 py-1 border border-line rounded hover:bg-zinc-50 flex items-center gap-1"
              >
                {copiedIdx === i ? <Check size={12} /> : <Copy size={12} />}
                {copiedIdx === i ? "已复制" : "复制"}
              </button>
            </div>
            <div className="text-sm text-ink-2 whitespace-pre-wrap leading-relaxed bg-zinc-50 rounded p-3">
              {v.text}
            </div>
            <div className="text-xs text-ink-3 mt-2">{v.rationale}</div>
          </div>
        ))}
      </div>
    </div>
  );
}