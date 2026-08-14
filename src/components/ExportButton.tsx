"use client";

import { useCouncilStore } from "@/store/council";
import { buildHtml } from "@/lib/export/html";
import { useToastStore } from "@/store/toast";
import type { CouncilExport } from "@/types";
import { Download } from "lucide-react";

export function ExportButton({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const session = useCouncilStore((s) => s.session);
  const pushToast = useToastStore((s) => s.push);

  if (!session && !alwaysShow) return null;
  if (!session && alwaysShow) {
    return (
      <button
        disabled
        className="px-3 py-1.5 text-xs font-semibold border border-line rounded text-ink-3 opacity-50 cursor-not-allowed"
      >
        导出 HTML
      </button>
    );
  }

  function handleExport() {
    if (!session) return;
    const data: CouncilExport = {
      query: session.query,
      startedAt: session.startedAt,
      finishedAt: Date.now(),
      classification: session.classification,
      retrieval: session.retrieval as any,
      answers: session.answers as any,
      challenges: session.challenges,
      challengeResponses: session.challengeResponses,
      matrix: session.matrix,
      recommendation: session.recommendation,
      summary: session.summary,
    };
    const html = buildHtml(data);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date(session.startedAt).toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `council-${ts}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast({ type: "ok", message: "HTML 报告已下载" });
  }

  return (
    <button
      onClick={handleExport}
      className="px-3 py-1.5 text-xs font-semibold border border-line rounded hover:bg-zinc-50 flex items-center gap-1.5"
    >
      <Download size={12} />
      导出 HTML
    </button>
  );
}