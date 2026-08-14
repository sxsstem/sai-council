import type { Classification, ModelConfig } from "@/types";
import { chat } from "@/lib/llm/client";

// 用最快的模型做分类(便宜 + 快)
export async function classify(query: string, cfg: ModelConfig, signal?: AbortSignal): Promise<Classification> {
  const prompt = `你是查询分类器。判断用户输入属于以下哪一类:
- fact_check: 事实核查类(数字、日期、事件真伪、科学常识)
- creative: 创意写作类(文案、故事、诗歌)
- code: 编程类
- general: 一般问答(观点、建议、闲聊)

只输出 JSON,不要任何解释。

用户输入:"""${query.slice(0, 500)}"""

输出 JSON:
{"type": "fact_check|creative|code|general", "confidence": 0-1, "reason": "一句话判断理由"}`;

  const result = await chat(cfg, {
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    maxTokens: 200,
    signal,
  });

  // 解析 JSON(模型可能包了 ```json ... ```)
  const text = result.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { type: "general", confidence: 0.5, reason: "分类失败,默认按一般问题处理" };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      type: parsed.type || "general",
      confidence: parsed.confidence ?? 0.5,
      reason: parsed.reason || "",
    };
  } catch {
    return { type: "general", confidence: 0.5, reason: "分类结果解析失败" };
  }
}