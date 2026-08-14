import type { EvidenceMatrix, ModelConfig } from "@/types";
import { chat } from "@/lib/llm/client";

export interface Recommendation {
  title: string; // 方案名称
  rationale: string; // 推荐理由(基于证据)
  confidence: number; // 0-1
  risks: string[]; // 风险点
  bestFor: string; // 适合什么场景
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  reasoning: string; // 整体决策逻辑
}

export async function generateRecommendations(
  query: string,
  matrix: EvidenceMatrix,
  cfg: ModelConfig,
  signal?: AbortSignal
): Promise<RecommendationResult> {
  const matrixText = JSON.stringify(
    {
      strong: matrix.strong,
      weak: matrix.weak,
      conflicting: matrix.conflicting,
      unsupported: matrix.unsupported,
    },
    null,
    2
  ).slice(0, 3000);

  const prompt = `你是 Council 的综合判断专家。基于用户原始问题和三模型合议后的证据矩阵,生成 2-3 个可执行的推荐方案。

用户原始问题:"""${query.slice(0, 500)}"""

证据矩阵:
${matrixText}

要求:
1. 每个方案必须基于证据矩阵中的具体证据,不能凭空生成
2. 方案要互斥(用户只能选一个)
3. 给出每个方案的置信度(0-1)
4. 指出每个方案的风险
5. 说明每个方案适合什么场景

输出 JSON(不要任何其他文字):
{
  "recommendations": [
    {
      "title": "方案名称(一句话,动词开头)",
      "rationale": "推荐理由(具体引用证据矩阵中的哪些条目)",
      "confidence": 0.85,
      "risks": ["风险点1", "风险点2"],
      "bestFor": "适合什么场景/用户"
    }
  ],
  "reasoning": "整体决策逻辑(为什么这些方案是当前最优)"
}`;

  const result = await chat(cfg, {
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    maxTokens: 1500,
    signal,
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      recommendations: [],
      reasoning: "推荐生成失败,无法解析模型输出。",
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      recommendations: parsed.recommendations || [],
      reasoning: parsed.reasoning || "",
    };
  } catch {
    return {
      recommendations: [],
      reasoning: "推荐生成失败,模型输出无法解析为 JSON。",
    };
  }
}