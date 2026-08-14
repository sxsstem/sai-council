import type { ModelAnswer, ModelConfig, EvidenceItem, Claim, Provider } from "@/types";
import { chat, buildSelfSearchPrompt } from "@/lib/llm/client";

const ANSWER_SYSTEM_PROMPT = String.raw`你正在独立回答用户的事实性问题。
请像对待正常提问一样回答,并附上证据/引用来支撑你的关键论据。

要求:
1. 如果你的服务支持联网搜索,请主动联网获取最新信息
2. 每条关键论据后用 [1] [2] 等编号标注
3. 区分"已验证事实"和"推测/常识"
4. 不要隐瞒不确定性 — 不确定的明确说"不确定"

回答完后,在末尾用 JSON 格式列出本次回答引用的来源:

\`\`\`json
{
  "claims": [
    { "text": "关键论据1", "citationIds": [1, 2] },
    { "text": "关键论据2", "citationIds": [3] }
  ]
}
\`\`\``;

export async function answerStage(
  query: string,
  cfg: ModelConfig,
  onDelta?: (text: string) => void,
  signal?: AbortSignal
): Promise<ModelAnswer> {
  const start = Date.now();

  // 决定 prompt:支持原生联网的用标准 prompt,不支持的用"假装联网"prompt
  const supportsNativeSearch =
    (cfg.provider === "deepseek" && cfg.model.includes("reasoner")) ||
    (cfg.provider === "zhipu" && (cfg.model.includes("plus") || cfg.model.includes("4-5")));

  const userPrompt = supportsNativeSearch
    ? query
    : buildSelfSearchPrompt(query);

  const result = await chat(cfg, {
    messages: [
      { role: "system", content: ANSWER_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 2000,
    stream: !!onDelta,
    onDelta,
    signal,
    enableWebSearch: supportsNativeSearch,
  });

  // 提取原生 citations(联网模型会带)
  const citations = result.citations || [];

  // 解析回答末尾的 claims JSON
  let answer = result.text;
  let claims: Claim[] = [];

  // 兼容多种 JSON 包裹方式
  const jsonMatch = answer.match(/```json\s*([\s\S]*?)\s*```/) ||
                     answer.match(/\{[\s\S]*"claims"[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      // 如果 JSON 在 ```json ... ``` 里,answer 去掉那部分
      if (jsonMatch[0].startsWith("```")) {
        answer = answer.replace(jsonMatch[0], "").trim();
      }
      // 兼容两种字段名:citationIds(模型输出的)和 evidenceIds(内部统一)
      claims = (parsed.claims || []).map((c: any) => ({
        text: c.text || "",
        evidenceIds: Array.isArray(c.evidenceIds) ? c.evidenceIds
                    : Array.isArray(c.citationIds) ? c.citationIds
                    : [],
      }));
    } catch {
      // 解析失败,claims 留空(下面会基于原生 citations 重建)
    }
  }

  // 如果模型没产出 claims JSON,但有原生 citations,我们尝试从 answer 里提取
  if (claims.length === 0 && citations.length > 0) {
    // 简化:把每条 citation 当一个 claim
    claims = citations.map((c, i) => ({
      text: c.snippet.slice(0, 100) || c.title,
      evidenceIds: [i + 1],
    }));
  }

  // 转换 citations 为 EvidenceItem(统一格式)
  const evidences: EvidenceItem[] = citations.map((c) => ({
    url: c.url,
    title: c.title,
    snippet: c.snippet,
    sourceType: c.sourceType,
    fetchedAt: Date.now(),
    source: "web" as const,
  }));

  // 如果 claims 里引用了 [1] [2] 这样的编号,但原生 citations 为空,
  // 把 model 自己声明的"假设引用"也算作 evidences(质量低但有)
  if (evidences.length === 0 && claims.length > 0) {
    // 模型回答了,但没真联网 — 走降级路径
    // 让前端能看到"未联网"的标记
  }

  return {
    provider: cfg.provider,
    retrievalQuery: query,
    evidences,
    answer,
    claims,
    answerMs: Date.now() - start,
  };
}

export async function answerAll(
  query: string,
  configs: ModelConfig[],
  onDelta?: (provider: Provider, text: string) => void,
  signal?: AbortSignal
): Promise<Record<Provider, ModelAnswer | undefined>> {
  const out: Record<Provider, ModelAnswer | undefined> = {
    deepseek: [],
    MiniMax: [],
    zhipu: [],
  } as any;

  const tasks = configs.map(async (cfg) => {
    try {
      const answer = await answerStage(
        query,
        cfg,
        onDelta ? (t) => onDelta(cfg.provider, t) : undefined,
        signal
      );
      out[cfg.provider] = answer;
    } catch (e) {
      out[cfg.provider] = undefined;
    }
  });

  await Promise.allSettled(tasks);
  return out;
}