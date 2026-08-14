import type { Challenge, ChallengeResponse, ModelConfig, ModelAnswer, Provider } from "@/types";
import { chat, EvidenceCitation } from "@/lib/llm/client";

const CHALLENGE_SYSTEM_PROMPT = `你是合议团成员,负责质询另一方的回答。

任务:
1. 阅读对方的关键论据
2. 用你自己的知识 / 联网搜索,找出一条**最可疑**的论据
3. 如果找不到明显问题,直接输出空 challenges 数组

输出格式(JSON):
{
  "challenges": [
    {
      "targetClaim": "被质疑的论据原文",
      "reason": "为什么可疑 + 你找到的反证",
      "severity": "low|mid|high",
      "counterEvidence": {
        "url": "你找到的反证 URL(如果有)",
        "title": "来源标题",
        "snippet": "反证片段"
      }
    }
  ]
}

注意:反证必须有依据。如果你也没找到反证,输出空数组。`;

const RESPONSE_SYSTEM_PROMPT = `你是被质询方,你的某条论据被质疑了。

任务:
1. 阅读质疑理由和反证
2. 用你自己的联网搜索 / 知识,找证据回应
3. 可以承认错误、可以解释口径、可以反驳

输出格式(JSON):
{
  "response": "你的回应(承认 / 解释 / 反驳 + 证据)",
  "supportingEvidence": [
    { "url": "你找的支持证据 URL", "title": "标题", "snippet": "片段" }
  ]
}`;

export async function challengeStage(
  answers: Record<Provider, ModelAnswer | undefined>,
  configs: ModelConfig[],
  signal?: AbortSignal
): Promise<{
  challenges: Challenge[];
  responses: ChallengeResponse[];
  supplementaryEvidences: Record<Provider, EvidenceCitation[]>; // 新增:每家补充的证据
}> {
  const challenges: Challenge[] = [];
  const responses: ChallengeResponse[] = [];
  const supplementaryEvidences: Record<Provider, EvidenceCitation[]> = {
    deepseek: [],
    MiniMax: [],
    zhipu: [],
  };

  const availableAnswers = (Object.entries(answers) as [Provider, ModelAnswer | undefined][])
    .filter(([_, a]) => a && a.claims.length > 0);

  if (availableAnswers.length < 2) {
    return { challenges, responses, supplementaryEvidences };
  }

  // 配对质询:A 质询 B、B 质询 A
  const pairs: [Provider, Provider][] = [];
  for (let i = 0; i < availableAnswers.length; i++) {
    for (let j = 0; j < availableAnswers.length; j++) {
      if (i !== j) pairs.push([availableAnswers[i][0], availableAnswers[j][0]]);
    }
  }

  // 决定哪几家支持原生联网(用于决定质疑/回应时是否真去搜)
  const supportsNativeSearch = (cfg: ModelConfig) =>
    (cfg.provider === "deepseek" && cfg.model.includes("reasoner")) ||
    (cfg.provider === "zhipu" && (cfg.model.includes("plus") || cfg.model.includes("4-5")));

  const tasks = pairs.map(async ([from, to]) => {
    const fromCfg = configs.find((c) => c.provider === from);
    const targetAnswer = answers[to];
    if (!fromCfg || !targetAnswer) return;

    try {
      const targetText = targetAnswer.claims.map((c) => `- ${c.text}`).join("\n");
      const userPrompt = `对方回答的关键论据:\n${targetText}\n\n请质询。如果你支持联网搜索,请实际去搜反证。`;

      const result = await chat(fromCfg, {
        messages: [
          { role: "system", content: CHALLENGE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: 500,
        signal,
        enableWebSearch: supportsNativeSearch(fromCfg),
      });

      // 解析 challenge
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;

      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        return;
      }

      const found: any[] = parsed.challenges || [];
      if (found.length === 0) return; // 没找到问题,跳过

      const c = found[0];
      const counterEv: EvidenceCitation | undefined = c.counterEvidence?.url
        ? {
            url: c.counterEvidence.url,
            title: c.counterEvidence.title || "",
            snippet: c.counterEvidence.snippet || "",
            source: new URL(c.counterEvidence.url).hostname,
            sourceType: "其他" as any,
          }
        : undefined;

      // 如果质疑方有原生联网的引用,合并
      const allFromCitations = result.citations || [];

      challenges.push({
        from,
        to,
        targetClaim: c.targetClaim || "",
        reason: c.reason || "",
        severity: c.severity || "mid",
        timestamp: Date.now(),
      });

      // 把质疑方找到的反证,放到被质疑方的"待补充证据"列表里
      if (counterEv) {
        supplementaryEvidences[to].push(counterEv);
      }

      // 被质疑方回应
      const toCfg = configs.find((c) => c.provider === to);
      if (toCfg) {
        const respResult = await chat(toCfg, {
          messages: [
            { role: "system", content: RESPONSE_SYSTEM_PROMPT },
            {
              role: "user",
              content: `${from} 质疑你:"${c.targetClaim}"\n理由:${c.reason}\n${
                counterEv ? `反证来源:${counterEv.url}\n` : ""
              }请你回应。如果你支持联网搜索,请实际去搜支持证据。`,
            },
          ],
          temperature: 0.3,
          maxTokens: 600,
          signal,
          enableWebSearch: supportsNativeSearch(toCfg),
        });

        const respJson = respResult.text.match(/\{[\s\S]*\}/);
        let responseText = respResult.text;
        if (respJson) {
          try {
            const parsedResp = JSON.parse(respJson[0]);
            responseText = parsedResp.response || respResult.text;
            // 收集被质疑方找到的支持证据
            const supportEv = parsedResp.supportingEvidence || [];
            for (const ev of supportEv) {
              if (ev.url) {
                supplementaryEvidences[to].push({
                  url: ev.url,
                  title: ev.title || "",
                  snippet: ev.snippet || "",
                  source: new URL(ev.url).hostname,
                  sourceType: "其他" as any,
                });
              }
            }
            // 原生联网引用也算
            for (const c of respResult.citations || []) {
              supplementaryEvidences[to].push(c);
            }
          } catch {}
        }

        responses.push({
          from: to,
          to: from,
          originalClaim: c.targetClaim || "",
          response: responseText,
          timestamp: Date.now(),
        });
      }
    } catch {
      // 单个质询失败不影响全局
    }
  });

  await Promise.allSettled(tasks);

  // 去重 supplementaryEvidences(同一 URL 不重复)
  Object.keys(supplementaryEvidences).forEach((p) => {
    const seen = new Set<string>();
    supplementaryEvidences[p as Provider] = supplementaryEvidences[p as Provider].filter((e) => {
      if (seen.has(e.url)) return false;
      seen.add(e.url);
      return true;
    });
  });

  return { challenges, responses, supplementaryEvidences };
}