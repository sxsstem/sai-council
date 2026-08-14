import type {
  DeAIEvent,
  ModelConfig,
  Provider,
  StyleFingerprint,
  AIFlavorExpression,
  StyleConflict,
  StyleChallenge,
  StyleChallengeResponse,
  RewriteSuggestion,
  RewriteVersion,
} from "@/types";
import { chat } from "@/lib/llm/client";

type Emit = (event: DeAIEvent) => void;

// ===== 阶段 ①:风格指纹采集 =====
// 每个模型独立读原文,识别 AI 味表达

const FINGERPRINT_SYSTEM_PROMPT = `你是文本风格审计员。任务是识别文本中的"AI 味"表达。

什么是 AI 味:
- 转折词:此外 / 不仅如此 / 更重要的是 / 值得注意的是 / 不可否认 / 综上所述 / 总而言之
- 抽象动词:赋能 / 打通 / 闭环 / 沉淀 / 抓手 / 链路 / 颗粒度 / 复盘 / 拉通
- 套话:在数字化浪潮下 / 在当今时代 / 随着...的发展 / 为了更好地
- 结构套路:首先...其次...最后... 的机械并列;四字成语堆砌
- 修辞:对称排比、空洞比喻(像...一样、如同...)
- 其他:任何你觉得"不像人写的"的表达

任务:
1. 通读原文
2. 找出 5-10 个最 AI 味的表达片段(完整短语,不是单词)
3. 给出每个片段在原文中的字符偏移(startOffset、endOffset)
4. 评估整体 AI 味分数(0-100,0=完全人类,100=纯 AI)

输出 JSON(不要任何其他文字):
{
  "expressions": [
    {
      "expression": "原文中的完整片段",
      "category": "转折词|抽象动词|套话|结构套路|修辞|其他",
      "severity": "low|mid|high",
      "startOffset": 0,
      "endOffset": 10,
      "reason": "为什么这是 AI 味"
    }
  ],
  "overallScore": 65,
  "comment": "整体评价一句话"
}`;

export async function fingerprintStage(
  originalText: string,
  configs: ModelConfig[],
  emit: Emit,
  signal?: AbortSignal
): Promise<Record<Provider, StyleFingerprint | undefined>> {
  const out: Record<Provider, StyleFingerprint | undefined> = {
    deepseek: undefined,
    MiniMax: undefined,
    zhipu: undefined,
  };

  const tasks = configs.map(async (cfg) => {
    emit({ stage: "fingerprint", type: "start", provider: cfg.provider });
    const start = Date.now();
    try {
      const result = await chat(cfg, {
        messages: [
          { role: "system", content: FINGERPRINT_SYSTEM_PROMPT },
          { role: "user", content: `原文:\n"""\n${originalText.slice(0, 3000)}\n"""\n\n请识别 AI 味。` },
        ],
        temperature: 0.2,
        maxTokens: 1200,
        signal,
      });

      // 解析 JSON
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("模型输出无 JSON");

      const parsed = JSON.parse(jsonMatch[0]);
      const expressions: AIFlavorExpression[] = (parsed.expressions || []).map((e: any) => ({
        expression: e.expression || "",
        category: e.category || "其他",
        severity: e.severity || "mid",
        startOffset: typeof e.startOffset === "number" ? e.startOffset : 0,
        endOffset: typeof e.endOffset === "number" ? e.endOffset : (e.expression?.length || 0),
        reason: e.reason || "",
      }));

      const fp: StyleFingerprint = {
        provider: cfg.provider,
        originalText,
        expressions,
        overallScore: parsed.overallScore ?? 50,
        analysisMs: Date.now() - start,
      };

      out[cfg.provider] = fp;
      emit({ stage: "fingerprint", type: "result", data: fp });
    } catch (e) {
      emit({ stage: "fingerprint", type: "error", provider: cfg.provider, error: (e as Error).message });
    }
  });

  await Promise.allSettled(tasks);
  return out;
}

// ===== 阶段 ②:交叉比对(程序化) =====

export function compareStage(
  fingerprints: Record<Provider, StyleFingerprint | undefined>
): StyleConflict[] {
  // 把所有 expressions 按"标准化表达"合并
  const buckets = new Map<string, {
    expression: string;
    category: AIFlavorExpression["category"];
    providers: Set<Provider>;
  }>();

  const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase().slice(0, 30);

  (Object.entries(fingerprints) as [Provider, StyleFingerprint | undefined][]).forEach(([provider, fp]) => {
    if (!fp) return;
    fp.expressions.forEach((e) => {
      const key = normalize(e.expression);
      if (!buckets.has(key)) {
        buckets.set(key, { expression: e.expression, category: e.category, providers: new Set() });
      }
      buckets.get(key)!.providers.add(provider);
    });
  });

  const conflicts: StyleConflict[] = [];
  buckets.forEach((b) => {
    const identifiedBy = Array.from(b.providers);
    let consensusLevel: StyleConflict["consensusLevel"] = "low";
    if (identifiedBy.length >= 3) consensusLevel = "high";
    else if (identifiedBy.length === 2) consensusLevel = "mid";
    conflicts.push({
      expression: b.expression,
      category: b.category,
      identifiedBy,
      consensusLevel,
    });
  });

  // 按共识度排序:高 → 低
  conflicts.sort((a, b) => {
    const order = { high: 3, mid: 2, low: 1 };
    return order[b.consensusLevel] - order[a.consensusLevel];
  });

  return conflicts;
}

// ===== 阶段 ③:互相质询(风格层面) =====

const STYLE_CHALLENGE_PROMPT = `你是风格审计团成员,负责质询另一方对"AI 味"的判断。

任务:
1. 对方识别出了几个 AI 味表达,挑出其中**最具争议的 1 个**(即"对方认为很 AI 味,你觉得还好")
2. 说明你的反对理由
3. 如果没有争议,输出空 challenges 数组

输出 JSON:
{
  "challenges": [
    {
      "expression": "被质疑的表达",
      "reason": "为什么这不算 AI 味 / 不严重"
    }
  ]
}`;

const STYLE_RESPONSE_PROMPT = `你是被质询方,你对某表达是否"AI 味"的判断被质疑了。

回应:承认错误、解释口径、或者反驳质疑。

输出 JSON:
{
  "response": "你的回应"
}`;

export async function styleChallengeStage(
  conflicts: StyleConflict[],
  configs: ModelConfig[],
  signal?: AbortSignal
): Promise<{ challenges: StyleChallenge[]; responses: StyleChallengeResponse[] }> {
  const challenges: StyleChallenge[] = [];
  const responses: StyleChallengeResponse[] = [];

  // 只对 high / mid 共识的表达发起质询(low 太弱,没必要)
  const disputedConflicts = conflicts.filter((c) => c.consensusLevel === "high" || c.consensusLevel === "mid");

  if (disputedConflicts.length === 0) {
    return { challenges, responses };
  }

  // 简单配对:让每家对共识度最高的 1 个表达发起质询
  const topConflict = disputedConflicts[0];
  const targets = topConflict.identifiedBy.filter((p) => p); // 不包括未配置
  if (targets.length < 2) return { challenges, responses };

  // 轮流挑战:每家挑战下一家
  const pairs: [Provider, Provider][] = [];
  for (let i = 0; i < targets.length; i++) {
    pairs.push([targets[i], targets[(i + 1) % targets.length]]);
  }

  const tasks = pairs.map(async ([from, to]) => {
    const fromCfg = configs.find((c) => c.provider === from);
    if (!fromCfg) return;
    try {
      const result = await chat(fromCfg, {
        messages: [
          { role: "system", content: STYLE_CHALLENGE_PROMPT },
          { role: "user", content: `其他模型都认为 "${topConflict.expression}" 是 AI 味(${topConflict.category},共识度:${topConflict.consensusLevel})。你同意吗?如果不同意,挑一个理由。` },
        ],
        temperature: 0.3,
        maxTokens: 300,
        signal,
      });

      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;
      const parsed = JSON.parse(jsonMatch[0]);
      const found = parsed.challenges || [];
      if (found.length === 0) {
        // 同意 AI 味
        challenges.push({
          from,
          to,
          expression: topConflict.expression,
          reason: "同意其他模型的判断",
          verdict: "agree_ai",
        });
      } else {
        challenges.push({
          from,
          to,
          expression: topConflict.expression,
          reason: found[0].reason || "",
          verdict: "disagree_ai",
        });

        // 被质疑方回应
        const toCfg = configs.find((c) => c.provider === to);
        if (toCfg) {
          const resp = await chat(toCfg, {
            messages: [
              { role: "system", content: STYLE_RESPONSE_PROMPT },
              { role: "user", content: `${from} 质疑你对 "${topConflict.expression}" 的 AI 味判断: ${found[0].reason}` },
            ],
            temperature: 0.3,
            maxTokens: 300,
            signal,
          });
          const respJson = resp.text.match(/\{[\s\S]*\}/);
          let respText = resp.text;
          if (respJson) {
            try {
              respText = JSON.parse(respJson[0]).response || resp.text;
            } catch {}
          }
          responses.push({
            from: to,
            to: from,
            expression: topConflict.expression,
            response: respText,
          });
        }
      }
    } catch {}
  });

  await Promise.allSettled(tasks);
  return { challenges, responses };
}

// ===== 阶段 ④:改写建议 =====

const REWRITE_PROMPT = `你是文风改写专家。基于风格审计结果,生成改写建议。

原文:
"""\n{originalText}\n"""

被识别的 AI 味表达(按共识度排序):
{conflicts}

任务:
1. 对每个被识别的表达,生成"更人类"的替代写法(2-3 个强度:保守 / 适中 / 激进)
2. 再生成 2-3 个完整改写版本:
   - 保守版:只删最严重的 AI 味,其他保留
   - 适中版:平衡自然度和专业性
   - 激进版:完全重写,口语化、不像 AI

输出 JSON:
{
  "suggestions": [
    {
      "original": "AI 味表达",
      "suggested": "人类写法",
      "reason": "为什么这样改",
      "intensity": "保守|适中|激进"
    }
  ],
  "versions": [
    {
      "label": "保守版",
      "text": "完整改写后的文本",
      "rationale": "改写思路"
    },
    {
      "label": "适中版",
      "text": "...",
      "rationale": "..."
    },
    {
      "label": "激进版",
      "text": "...",
      "rationale": "..."
    }
  ]
}`;

export async function rewriteStage(
  originalText: string,
  conflicts: StyleConflict[],
  cfg: ModelConfig,
  emit: Emit,
  signal?: AbortSignal
): Promise<{ suggestions: RewriteSuggestion[]; versions: RewriteVersion[] }> {
  emit({ stage: "rewrite", type: "start" });

  const conflictText = conflicts
    .slice(0, 10)
    .map((c) => `- "${c.expression}" [${c.category}, 共识:${c.consensusLevel}]`)
    .join("\n");

  const prompt = REWRITE_PROMPT
    .replace("{originalText}", originalText.slice(0, 3000))
    .replace("{conflicts}", conflictText);

  try {
    const result = await chat(cfg, {
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      maxTokens: 2000,
      signal,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      emit({
        stage: "rewrite",
        type: "result",
        data: { suggestions: [], versions: [] },
      });
      return { suggestions: [], versions: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const suggestions: RewriteSuggestion[] = (parsed.suggestions || []).map((s: any) => ({
      original: s.original || "",
      suggested: s.suggested || "",
      reason: s.reason || "",
      intensity: s.intensity || "适中",
    }));
    const versions: RewriteVersion[] = (parsed.versions || []).map((v: any) => ({
      label: v.label || "",
      text: v.text || "",
      rationale: v.rationale || "",
    }));

    emit({
      stage: "rewrite",
      type: "result",
      data: { suggestions, versions },
    });
    return { suggestions, versions };
  } catch (e) {
    emit({
      stage: "rewrite",
      type: "result",
      data: { suggestions: [], versions: [] },
    });
    return { suggestions: [], versions: [] };
  }
}

// ===== 主入口 =====

export interface DeAIPipelineResult {
  fingerprints: Record<Provider, StyleFingerprint | undefined>;
  conflicts: StyleConflict[];
  challenges: StyleChallenge[];
  challengeResponses: StyleChallengeResponse[];
  suggestions: RewriteSuggestion[];
  rewriteVersions: RewriteVersion[];
}

export async function runDeAI(
  originalText: string,
  configs: ModelConfig[],
  emit: Emit,
  signal?: AbortSignal
): Promise<DeAIPipelineResult> {
  const enabledConfigs = configs.filter((c) => c.enabled && c.apiKey);
  if (enabledConfigs.length < 2) {
    emit({ stage: "error", type: "fatal", error: "至少需要启用 2 个模型" });
    return {
      fingerprints: { deepseek: undefined, MiniMax: undefined, zhipu: undefined },
      conflicts: [],
      challenges: [],
      challengeResponses: [],
      suggestions: [],
      rewriteVersions: [],
    };
  }

  const result: DeAIPipelineResult = {
    fingerprints: { deepseek: undefined, MiniMax: undefined, zhipu: undefined },
    conflicts: [],
    challenges: [],
    challengeResponses: [],
    suggestions: [],
    rewriteVersions: [],
  };

  // 阶段 ①:风格指纹
  result.fingerprints = await fingerprintStage(originalText, enabledConfigs, emit, signal);

  // 阶段 ②:交叉比对
  emit({ stage: "compare", type: "start" });
  result.conflicts = compareStage(result.fingerprints);
  emit({ stage: "compare", type: "result", data: result.conflicts });

  // 阶段 ③:互相质询
  emit({ stage: "challenge", type: "start" });
  const debate = await styleChallengeStage(result.conflicts, enabledConfigs, signal);
  result.challenges = debate.challenges;
  result.challengeResponses = debate.responses;
  emit({ stage: "challenge", type: "end" });

  // 阶段 ④:改写建议
  const rewrite = await rewriteStage(originalText, result.conflicts, enabledConfigs[0], emit, signal);
  result.suggestions = rewrite.suggestions;
  result.rewriteVersions = rewrite.versions;

  emit({ stage: "done", type: "ok" });
  return result;
}