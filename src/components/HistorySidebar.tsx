"use client";

import { useHistoryStore } from "@/store/history";
import { useCouncilStore } from "@/store/council";
import { useDeAIStore } from "@/store/deai";
import { useToastStore } from "@/store/toast";
import { HistoryItem, WorkflowMode } from "@/types";
import { Trash2, FileText, Sparkles, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function HistorySidebar() {
  const items = useHistoryStore((s) => s.items);
  const remove = useHistoryStore((s) => s.remove);
  const clear = useHistoryStore((s) => s.clear);
  const pushToast = useToastStore((s) => s.push);
  const resetCouncil = useCouncilStore((s) => s.reset);
  const resetDeAI = useDeAIStore((s) => s.reset);

  function loadItem(item: HistoryItem) {
    if (item.mode === "fact_check") {
      resetDeAI();
      useCouncilStore.setState({ session: item.data, isRunning: false });
      pushToast({ type: "info", message: `已加载案例:${item.title}` });
    } else {
      resetCouncil();
      useDeAIStore.setState({ session: item.data });
      pushToast({ type: "info", message: `已加载案例:${item.title}` });
    }
  }

  function clearCurrent() {
    // 清掉主区当前展示的 session(开始新合议前用)
    if (useCouncilStore.getState().session) resetCouncil();
    if (useDeAIStore.getState().session) resetDeAI();
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-line rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-ink-3" />
          <h3 className="text-sm font-semibold">历史案例</h3>
        </div>
        <div className="text-xs text-ink-3 text-center py-6">
          还没有历史记录。<br />
          完成一次合议后会自动保存到这里。
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-zinc-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-ink-3" />
          <h3 className="text-sm font-semibold">历史案例</h3>
          <span className="text-xs text-ink-3">({items.length})</span>
        </div>
        <button
          onClick={() => {
            if (confirm("清空所有历史?此操作不可恢复。")) clear();
          }}
          className="text-xs text-warn hover:underline"
        >
          清空
        </button>
      </div>

      <div className="max-h-[640px] overflow-y-auto divide-y divide-line">
        {items.map((item) => (
          <HistoryRow
            key={item.id}
            item={item}
            onLoad={() => loadItem(item)}
            onRemove={() => remove(item.id)}
          />
        ))}
      </div>

      <div className="px-5 py-2 border-t border-line bg-zinc-50">
        <button
          onClick={clearCurrent}
          className="text-xs text-ink-2 hover:text-warn flex items-center gap-1"
        >
          <X size={11} />
          清掉主区当前显示
        </button>
      </div>
    </div>
  );
}

function HistoryRow({ item, onLoad, onRemove }: { item: HistoryItem; onLoad: () => void; onRemove: () => void }) {
  return (
    <div className="px-5 py-3 hover:bg-zinc-50 group cursor-pointer" onClick={onLoad}>
      <div className="flex items-start gap-2">
        <ModeIcon mode={item.mode} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink truncate">{item.title}</div>
          <div className="text-xs text-ink-3 mt-0.5 truncate">{item.preview}</div>
          <div className="text-[10px] text-ink-3 mt-1">
            {new Date(item.startedAt).toLocaleString("zh-CN", { hour12: false })}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-warn"
          aria-label="delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function ModeIcon({ mode }: { mode: WorkflowMode }) {
  if (mode === "fact_check") {
    return (
      <div className="w-7 h-7 rounded bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
        <FileText size={14} />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded bg-zhipu-soft text-zhipu flex items-center justify-center flex-shrink-0">
      <Sparkles size={14} />
    </div>
  );
}