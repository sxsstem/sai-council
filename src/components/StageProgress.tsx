"use client";

import { useCouncilStore } from "@/store/council";
import { PROVIDER_META, Provider } from "@/types";
import { cn } from "@/lib/utils";

const STAGES = [
  { id: 1, label: "任务分类", desc: "判断是否事实核查" },
  { id: 2, label: "证据检索", desc: "三模型并发检索公开来源" },
  { id: 3, label: "独立作答", desc: "基于证据各自回答" },
  { id: 4, label: "互相质询", desc: "交叉质询对方论据" },
  { id: 5, label: "证据矩阵", desc: "强/弱/冲突/无证据 四档汇总" },
  { id: 6, label: "推荐方案", desc: "基于证据生成可执行建议" },
] as const;

export function StageProgress() {
  const session = useCouncilStore((s) => s.session);
  const isRunning = useCouncilStore((s) => s.isRunning);
  if (!session) return null;

  // 从 events 判断每个阶段的状态
  const hasClassify = session.events.some((e) => e.stage === "classify" && e.type === "result");
  const hasRetrieveStart = session.events.some((e) => e.stage === "retrieve" && e.type === "start");
  const hasRetrieveDone = (["deepseek", "MiniMax", "zhipu"] as Provider[]).every(
    (p) => session.events.some((e) => e.stage === "retrieve" && e.type === "result" && e.provider === p) ||
           session.events.some((e) => e.stage === "retrieve" && e.type === "error" && e.provider === p)
  );
  const hasAnswerDone = (["deepseek", "MiniMax", "zhipu"] as Provider[]).every(
    (p) => session.events.some((e) => e.stage === "answer" && e.type === "result" && e.provider === p)
  );
  const hasDebate = session.events.some((e) => e.stage === "debate" && e.type === "end");
  const hasMatrix = session.events.some((e) => e.stage === "matrix" && e.type === "result");
  const hasRecommend = session.events.some((e) => e.stage === "recommend" && e.type === "result");

  const statuses = [hasClassify, hasRetrieveDone, hasAnswerDone, hasDebate, hasMatrix, hasRecommend];

  return (
    <div className="bg-white border border-line rounded-lg p-4">
      <div className="flex items-center gap-1 overflow-x-auto">
        {STAGES.map((stage, i) => {
          const done = statuses[i];
          const active = !done && isRunning && (i === 0 || statuses[i - 1]);
          return (
            <div key={stage.id} className="flex items-center gap-1 flex-1 min-w-fit">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-line min-w-fit">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    done ? "bg-ok text-white" : active ? "bg-accent text-white animate-pulse" : "bg-line text-ink-3"
                  )}
                >
                  {done ? "✓" : stage.id}
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-ink">{stage.label}</div>
                  <div className="text-ink-3">{stage.desc}</div>
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className={cn("h-px w-4 flex-shrink-0", done ? "bg-ok" : "bg-line")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}