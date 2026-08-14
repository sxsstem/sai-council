"use client";

import { useCouncilStore } from "@/store/council";
import { PROVIDER_META } from "@/types";

export function EvidenceMatrixPanel() {
  const session = useCouncilStore((s) => s.session);
  if (!session?.matrix) return null;
  const m = session.matrix;

  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-zinc-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-accent">⑤</span>
          <h3 className="text-sm font-semibold">证据矩阵</h3>
          <span className="text-xs text-ink-3 ml-auto">本次合议结论</span>
        </div>
      </div>

      {session.summary && (
        <div className="px-5 py-3 bg-accent-soft border-b border-line">
          <div className="text-sm text-ink">{session.summary}</div>
        </div>
      )}

      <div className="divide-y divide-line">
        <Section label="强证据" count={m.strong.length} color="ok">
          {m.strong.map((s, i) => (
            <Item key={i} claim={s.claim} providers={s.providers} badge={`置信 ${(s.confidence * 100).toFixed(0)}%`} />
          ))}
        </Section>
        <Section label="弱证据" count={m.weak.length} color="accent">
          {m.weak.map((w, i) => (
            <Item key={i} claim={w.claim} providers={w.providers} badge="仅 1 个来源" muted />
          ))}
        </Section>
        <Section label="冲突证据" count={m.conflicting.length} color="warn">
          {m.conflicting.map((c, i) => (
            <div key={i} className="px-5 py-2 text-xs">
              <div className="text-ink-2 mb-1">{c.claim}</div>
              {c.positions.map((p, j) => (
                <div key={j} className="flex items-center gap-2 ml-3">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: PROVIDER_META[p.provider].color }} />
                  <span className="text-ink-2" style={{ color: PROVIDER_META[p.provider].color, fontWeight: 600 }}>
                    {PROVIDER_META[p.provider].name}:
                  </span>
                  <span className="text-ink-3">{p.text}</span>
                </div>
              ))}
            </div>
          ))}
        </Section>
        <Section label="无证据" count={m.unsupported.length} color="ink-3">
          {m.unsupported.map((u, i) => (
            <Item key={i} claim={u.claim} providers={u.providers} badge="无引用" muted />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ label, count, color, children }: { label: string; count: number; color: string; children: React.ReactNode }) {
  const hasContent = count > 0;
  return (
    <div className={hasContent ? "" : "opacity-50"}>
      <div className="px-5 py-2 flex items-center gap-2 bg-zinc-50">
        <div className={`w-2 h-2 rounded-full bg-${color}`} />
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-xs text-ink-3 ml-auto">{count} 条</span>
      </div>
      {hasContent ? <div className="divide-y divide-line">{children}</div> : (
        <div className="px-5 py-2 text-xs text-ink-3">无</div>
      )}
    </div>
  );
}

function Item({ claim, providers, badge, muted }: { claim: string; providers: any[]; badge: string; muted?: boolean }) {
  return (
    <div className={`px-5 py-2 text-xs ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="flex gap-1 mt-0.5">
          {providers.map((p) => (
            <span key={p} className="w-1.5 h-1.5 rounded-full" style={{ background: PROVIDER_META[p as keyof typeof PROVIDER_META]?.color }} />
          ))}
        </div>
        <div className="flex-1">
          <div className="text-ink-2">{claim}</div>
          <div className="mt-0.5">
            <span className="text-[10px] text-ink-3">{badge}</span>
          </div>
        </div>
      </div>
    </div>
  );
}