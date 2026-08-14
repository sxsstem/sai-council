"use client";

import { useCouncilStore } from "@/store/council";
import { Lightbulb, AlertTriangle, Target, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function RecommendationPanel() {
  const session = useCouncilStore((s) => s.session);
  if (!session) return null;

  const rec = session.recommendation;
  const started = session.events.some((e) => e.stage === "recommend" && e.type === "start");
  const streaming = session.recommendationStream;
  const isDone = !!rec;

  if (!started) return null;

  const recs = rec?.recommendations || [];
  const reasoning = rec?.reasoning || "";

  return (
    <div className="bg-white border-2 border-accent/30 rounded-lg overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-line bg-accent-soft">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="text-accent" />
          <span className="text-xs font-bold text-accent">⑥</span>
          <h3 className="text-sm font-semibold text-accent">推荐方案</h3>
          <span className="text-xs text-ink-3 ml-auto">
            {isDone ? `${recs.length} 个方案 · 基于证据矩阵综合` : streaming ? "生成中..." : ""}
          </span>
        </div>
      </div>

      {/* 整体决策逻辑 */}
      {reasoning && (
        <div className="px-5 py-3 border-b border-line bg-zinc-50">
          <div className="flex items-start gap-2">
            <Target size={14} className="text-accent mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold text-ink-2 mb-1">决策逻辑</div>
              <div className="text-sm text-ink-2 leading-relaxed">{reasoning}</div>
            </div>
          </div>
        </div>
      )}

      {/* 流式生成中 */}
      {!isDone && streaming && (
        <div className="px-5 py-4 text-sm text-ink-2 streaming whitespace-pre-wrap">{streaming}</div>
      )}

      {/* 方案列表 */}
      {recs.length > 0 && (
        <div className="divide-y divide-line">
          {recs.map((r, i) => (
            <RecommendationCard key={i} rec={r} index={i + 1} />
          ))}
        </div>
      )}

      {/* 没生成出来 */}
      {isDone && recs.length === 0 && (
        <div className="px-5 py-6 text-sm text-ink-3 text-center">
          本次未能生成推荐方案,可能是证据不足以支撑决策。请基于上方证据矩阵自行判断。
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec, index }: { rec: any; index: number }) {
  const conf = Math.round((rec.confidence || 0) * 100);
  const confColor =
    conf >= 80 ? "bg-ok text-white" : conf >= 60 ? "bg-accent text-white" : "bg-warn text-white";

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-7 h-7 rounded-full bg-accent-soft text-accent font-bold text-sm flex items-center justify-center flex-shrink-0">
          {index}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-base font-semibold text-ink">{rec.title}</h4>
            <span className={cn("px-2 py-0.5 rounded text-[11px] font-bold", confColor)}>
              置信 {conf}%
            </span>
          </div>
          <div className="text-xs text-ink-3 mb-2 flex items-center gap-1">
            <ChevronRight size={11} />
            适合:{rec.bestFor}
          </div>
          <div className="text-sm text-ink-2 leading-relaxed mb-3">
            <span className="font-semibold text-ink">推荐理由:</span>
            {rec.rationale}
          </div>
          {rec.risks && rec.risks.length > 0 && (
            <div className="bg-warn-soft border border-warn/20 rounded p-2 mt-2">
              <div className="flex items-start gap-2">
                <AlertTriangle size={12} className="text-warn mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-warn mb-1">风险提示</div>
                  <ul className="text-xs text-ink-2 space-y-0.5">
                    {rec.risks.map((risk: string, j: number) => (
                      <li key={j} className="pl-3 relative">
                        <span className="absolute left-0 top-1.5 w-1 h-1 bg-warn rounded-full" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}