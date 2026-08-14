"use client";

import { useCouncilStore } from "@/store/council";
import { PROVIDER_META, Provider } from "@/types";
import { cn } from "@/lib/utils";

const PROVIDERS: Provider[] = ["deepseek", "MiniMax", "zhipu"];

export function RetrievalPanel() {
  const session = useCouncilStore((s) => s.session);
  if (!session) return null;

  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-zinc-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-accent">②</span>
          <h3 className="text-sm font-semibold">证据检索</h3>
          <span className="text-xs text-ink-3 ml-auto">三模型并发</span>
        </div>
      </div>
      <div className="divide-y divide-line">
        {PROVIDERS.map((p) => {
          const meta = PROVIDER_META[p];
          const ret = session.retrieval[p];
          const evidences = ret?.evidences || [];
          const error = ret && (ret as any).error;

          return (
            <div key={p} className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                <span className="text-sm font-semibold">{meta.name}</span>
                <span className="text-xs text-ink-3 ml-auto">
                  {evidences.length > 0 ? `找到 ${evidences.length} 条` : error ? `✗ ${error}` : "检索中..."}
                </span>
              </div>
              {evidences.length > 0 && (
                <div className="space-y-2 pl-4">
                  {evidences.map((e, i) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                          e.sourceType === "百科" || e.sourceType === "官网" || e.sourceType === "学术" ? "bg-ok-soft text-ok" :
                          e.sourceType === "新闻" ? "bg-accent-soft text-accent" :
                          e.sourceType === "营销" || e.sourceType === "UGC" ? "bg-warn-soft text-warn" :
                          "bg-zinc-100 text-ink-2"
                        )}>
                          {e.sourceType}
                        </span>
                        <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate flex-1">
                          {e.title}
                        </a>
                      </div>
                      <div className="text-ink-3 mt-0.5 line-clamp-2">{e.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}