"use client";

import { useToastStore } from "@/store/toast";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const META = {
  ok: { icon: CheckCircle2, cls: "bg-ok-soft border-ok/30 text-ok" },
  warn: { icon: AlertTriangle, cls: "bg-warn-soft border-warn/30 text-warn" },
  error: { icon: XCircle, cls: "bg-warn-soft border-warn/30 text-warn" },
  info: { icon: Info, cls: "bg-accent-soft border-accent/30 text-accent" },
} as const;

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((t) => {
        const meta = META[t.type];
        const Icon = meta.icon;
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 px-3 py-2 border rounded-md shadow-sm min-w-[280px] max-w-[420px]",
              "animate-in slide-in-from-right",
              meta.cls
            )}
          >
            <Icon size={16} className="mt-0.5 flex-shrink-0" />
            <div className="text-sm flex-1">{t.message}</div>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-60 hover:opacity-100"
              aria-label="dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}