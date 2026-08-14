import type { CouncilExport, Provider } from "@/types";
import { PROVIDER_META } from "@/types";

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function providerHtml(p: Provider) {
  const meta = PROVIDER_META[p];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${meta.soft};color:${meta.color};font-weight:600;font-size:12px;">${meta.name}</span>`;
}

export function buildHtml(data: CouncilExport): string {
  const providers: Provider[] = ["deepseek", "MiniMax", "zhipu"];

  const retrievalHtml = providers
    .map((p) => {
      const r = data.retrieval[p];
      const meta = PROVIDER_META[p];
      if (!r) return "";
      const evidencesHtml = r.evidences
        .map(
          (e, i) => `
        <div style="margin:8px 0;padding:8px;background:#fafafa;border-radius:4px;font-size:13px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:11px;padding:1px 6px;background:#f0fdf4;color:#15803d;border-radius:3px;">${e.sourceType}</span>
            <a href="${e.url}" target="_blank" style="color:#2563eb;text-decoration:none;">${e.title}</a>
          </div>
          <div style="color:#71717a;font-size:12px;">${e.snippet}</div>
        </div>`
        )
        .join("");
      return `
        <div style="margin-bottom:16px;padding:16px;border:1px solid #e4e4e7;border-radius:8px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${meta.color};"></div>
            <strong>${meta.name}</strong>
            <span style="margin-left:auto;color:#a1a1aa;font-size:12px;">${r.ms ? r.ms + "ms" : ""} · ${r.evidences.length} 条证据</span>
          </div>
          ${evidencesHtml}
        </div>`;
    })
    .join("");

  const answersHtml = providers
    .map((p) => {
      const a = data.answers[p];
      const meta = PROVIDER_META[p];
      if (!a) return "";
      const claimsHtml = a.claims
        .map((c) => `<li style="margin:4px 0;">${c.text}${(c.evidenceIds && c.evidenceIds.length > 0) ? ` <span style="color:#a1a1aa;">[${c.evidenceIds.join(",")}]</span>` : ""}</li>`)
        .join("");
      return `
        <div style="padding:16px;border:1px solid #e4e4e7;border-radius:8px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${meta.color};"></div>
            <strong>${meta.name}</strong>
            <span style="margin-left:auto;color:#a1a1aa;font-size:12px;">${(a.answerMs / 1000).toFixed(1)}s</span>
          </div>
          <div style="white-space:pre-wrap;font-size:13px;line-height:1.6;color:#18181b;">${a.answer.replace(/</g, "&lt;")}</div>
          ${a.claims.length > 0 ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #e4e4e7;">
            <div style="font-size:12px;font-weight:600;color:#52525b;margin-bottom:6px;">关键论据</div>
            <ul style="font-size:13px;color:#52525b;padding-left:20px;">${claimsHtml}</ul>
          </div>` : ""}
        </div>`;
    })
    .join("");

  const debateHtml = data.challenges
    .map((c) => {
      const resp = data.challengeResponses.find((r) => r.originalClaim === c.targetClaim && r.from === c.to);
      const fromMeta = PROVIDER_META[c.from];
      const toMeta = PROVIDER_META[c.to];
      return `
        <div style="margin-bottom:12px;">
          <div style="border-left:3px solid ${fromMeta.color};background:${fromMeta.soft};padding:10px 12px;border-radius:4px;font-size:13px;">
            <div style="font-weight:600;color:${fromMeta.color};margin-bottom:4px;">${fromMeta.name} → ${toMeta.name} · 质询</div>
            <div style="color:#52525b;margin-bottom:4px;"><span style="color:#a1a1aa;">目标:</span>"${c.targetClaim}"</div>
            <div style="color:#52525b;"><span style="color:#a1a1aa;">理由:</span>${c.reason}</div>
          </div>
          ${resp ? `<div style="border-left:3px solid ${toMeta.color};background:${toMeta.soft};padding:10px 12px;border-radius:4px;font-size:13px;margin-left:24px;margin-top:8px;">
            <div style="font-weight:600;color:${toMeta.color};margin-bottom:4px;">${toMeta.name} → 回应</div>
            <div style="color:#52525b;">${resp.response}</div>
          </div>` : ""}
        </div>`;
    })
    .join("");

  const m = data.matrix!;
  const matrixHtml = `
    <div style="margin-top:16px;">
      ${sectionHtml("强证据", m.strong.length, "#15803d", m.strong.map((s) => `<div style="font-size:13px;color:#18181b;padding:4px 0;">• ${s.claim} <span style="color:#a1a1aa;font-size:11px;">${s.providers.map(providerHtml).join(" ")} · 置信 ${(s.confidence * 100).toFixed(0)}%</span></div>`).join(""))}
      ${sectionHtml("弱证据", m.weak.length, "#2563eb", m.weak.map((w) => `<div style="font-size:13px;color:#52525b;padding:4px 0;">• ${w.claim} <span style="color:#a1a1aa;font-size:11px;">${w.providers.map(providerHtml).join(" ")}</span></div>`).join(""))}
      ${sectionHtml("冲突证据", m.conflicting.length, "#b91c1c", m.conflicting.map((c) => `<div style="font-size:13px;color:#18181b;padding:4px 0;">• ${c.claim}${c.positions.map((p) => `<div style="margin-left:24px;color:#71717a;">${providerHtml(p.provider)} ${p.text}</div>`).join("")}</div>`).join(""))}
      ${sectionHtml("无证据", m.unsupported.length, "#a1a1aa", m.unsupported.map((u) => `<div style="font-size:13px;color:#a1a1aa;padding:4px 0;">• ${u.claim}</div>`).join(""))}
    </div>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Council 合议报告 · ${fmtTime(data.startedAt)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "SF Pro Text", sans-serif; max-width: 900px; margin: 0 auto; padding: 32px 24px 80px; background: #fafaf9; color: #18181b; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  h1 { font-size: 24px; margin-bottom: 8px; }
  h2 { font-size: 16px; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e4e4e7; }
  .meta { color: #a1a1aa; font-size: 12px; margin-bottom: 24px; }
  .query { background: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 15px; }
  .summary { background: #f0fdfa; border-left: 3px solid #0d9488; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px; font-size: 14px; }
  .disclaimer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e4e4e7; color: #a1a1aa; font-size: 12px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  @media (max-width: 720px) { .grid2, .grid3 { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>Council 合议报告</h1>
<div class="meta">${fmtTime(data.startedAt)}${data.finishedAt ? " · 用时 " + ((data.finishedAt - data.startedAt) / 1000).toFixed(1) + "s" : ""}</div>

<div class="query">
  <div style="font-size:11px;color:#a1a1aa;letter-spacing:0.1em;font-weight:600;margin-bottom:6px;">待核查陈述</div>
  ${data.query}
</div>

${data.summary ? `<div class="summary"><strong>总结:</strong> ${data.summary}</div>` : ""}

<h2>① 证据检索</h2>
${retrievalHtml}

<h2>② 独立作答</h2>
<div class="grid3">${answersHtml}</div>

${data.challenges.length > 0 ? `<h2>③ 互相质询</h2>${debateHtml}` : ""}

<h2>④ 证据矩阵</h2>
${m ? matrixHtml : ""}

${data.recommendation && data.recommendation.recommendations.length > 0 ? `
<h2>⑤ 推荐方案</h2>
<div style="margin-bottom:8px;padding:12px 16px;background:#eff6ff;border-radius:8px;font-size:13px;color:#18181b;">
  <strong>决策逻辑:</strong> ${data.recommendation.reasoning}
</div>
<div class="grid2">
${data.recommendation.recommendations.map((r, i) => `
  <div style="padding:16px;border:2px solid #bfdbfe;border-radius:8px;background:#fff;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="width:28px;height:28px;border-radius:50%;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:700;">${i + 1}</div>
      <strong style="font-size:15px;">${r.title}</strong>
      <span style="margin-left:auto;background:#2563eb;color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">置信 ${(r.confidence * 100).toFixed(0)}%</span>
    </div>
    <div style="font-size:12px;color:#71717a;margin-bottom:8px;">适合:${r.bestFor}</div>
    <div style="font-size:13px;color:#18181b;line-height:1.6;margin-bottom:8px;">
      <strong>推荐理由:</strong>${r.rationale}
    </div>
    ${r.risks.length > 0 ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:8px;font-size:12px;">
      <div style="font-weight:600;color:#b91c1c;margin-bottom:4px;">风险提示</div>
      <ul style="padding-left:16px;color:#52525b;">${r.risks.map(rr => `<li>${rr}</li>`).join("")}</ul>
    </div>` : ""}
  </div>
`).join("")}
</div>` : ""}

<div class="disclaimer">
  <strong>声明:</strong>Council 不保证消除所有幻觉。它通过多模型合议 + 异构证据检索,结构性降低幻觉概率。
  对于投资、学术、新闻等高风险场景,请人工复核关键事实。
</div>
</body>
</html>`;
}

function sectionHtml(label: string, count: number, color: string, content: string) {
  return `
    <div style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};"></div>
        <strong style="font-size:13px;">${label}</strong>
        <span style="color:#a1a1aa;font-size:12px;margin-left:auto;">${count} 条</span>
      </div>
      ${content || '<div style="color:#a1a1aa;font-size:12px;padding:4px 0;">无</div>'}
    </div>`;
}