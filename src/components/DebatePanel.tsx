"use client";

import { useCouncilStore } from "@/store/council";
import { PROVIDER_META, Provider } from "@/types";
import { cn } from "@/lib/utils";

export function DebatePanel() {
  const session = useCouncilStore((s) => s.session);
  if (!session) return null;

  const challenges = session.challenges;
  const responses = session.challengeResponses;
  const isRunning = session.isRunning;
  const debateStarted = session.events.some((e) => e.stage === "debate" && e.type === "start");
  const debateEnded = session.events.some((e) => e.stage === "debate" && e.type === "end");

  if (!debateStarted) return null;

  // 合并 challenges + responses 成按时间排序的消息流
  const messages: Array<{
    provider: Provider;
    timestamp: number;
    type: "challenge" | "response";
    body: string;
    targetClaim?: string;
    reason?: string;
    severity?: string;
    target?: Provider;
  }> = [];

  challenges.forEach((c) => {
    messages.push({
      provider: c.from,
      timestamp: c.timestamp,
      type: "challenge",
      body: c.reason,
      targetClaim: c.targetClaim,
      reason: c.reason,
      severity: c.severity,
      target: c.to,
    });
  });
  responses.forEach((r) => {
    messages.push({
      provider: r.from,
      timestamp: r.timestamp,
      type: "response",
      body: r.response,
      target: r.to,
      targetClaim: r.originalClaim,
    });
  });

  messages.sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden">
      {/* 群聊标题栏 */}
      <div className="px-5 py-3 border-b border-line bg-zinc-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-accent">④</span>
          <h3 className="text-sm font-semibold">合议群 · 互相质询</h3>
          <span className="text-xs text-ink-3 ml-auto">
            {!debateEnded ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-ok rounded-full animate-pulse" />
                讨论中
              </span>
            ) : (
              `共 ${messages.length} 条发言`
            )}
          </span>
        </div>
      </div>

      {/* 群聊消息流 */}
      <div className="px-5 py-4 space-y-3 max-h-[600px] overflow-y-auto bg-zinc-50/30">
        {messages.length === 0 && (
          <div className="text-xs text-ink-3 text-center py-4">
            {isRunning ? "等待发言..." : "本次未产生质询(三方答案高度一致)"}
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} msg={m} />
        ))}

        {!debateEnded && messages.length > 0 && (
          <div className="flex items-center gap-2 pl-12 text-xs text-ink-3">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            对方正在输入
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: any }) {
  const provider = msg.provider as Provider;
  const meta = PROVIDER_META[provider];
  const targetMeta = msg.target ? PROVIDER_META[msg.target as Provider] : null;
  // 用 provider 名的第一个字符当头像(简易头像)
  const initial = meta.name[0];

  return (
    <div className="flex items-start gap-2">
      {/* 头像 */}
      <div
        className="w-9 h-9 rounded-md flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
        style={{ background: meta.color }}
        title={meta.name}
      >
        {initial}
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-w-0">
        {/* 姓名 + 时间 */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-semibold" style={{ color: meta.color }}>
            {meta.name}
          </span>
          {targetMeta && (
            <span className="text-xs text-ink-3">
              {msg.type === "challenge" ? "@" : "回复 @"}
              <span style={{ color: targetMeta.color }}>{targetMeta.name}</span>
            </span>
          )}
          <span className="text-[10px] text-ink-3">
            {new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour12: false })}
          </span>
          {msg.type === "challenge" && msg.severity && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                msg.severity === "high"
                  ? "bg-warn-soft text-warn"
                  : msg.severity === "mid"
                    ? "bg-accent-soft text-accent"
                    : "bg-zinc-100 text-ink-2"
              )}
            >
              严重度 {msg.severity}
            </span>
          )}
        </div>

        {/* 引用的目标论据 */}
        {msg.targetClaim && (
          <div className="text-xs bg-white border border-line rounded px-2 py-1.5 mb-1.5 text-ink-3 italic">
            "{msg.targetClaim}"
          </div>
        )}

        {/* 消息气泡 */}
        <div
          className="inline-block max-w-full rounded-lg px-3 py-2 text-sm text-ink-2 leading-relaxed"
          style={{ background: meta.soft }}
        >
          {msg.body}
        </div>
      </div>
    </div>
  );
}