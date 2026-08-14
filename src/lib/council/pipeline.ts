import type { CouncilEvent, ModelConfig, Provider, Classification, ModelAnswer, Challenge, ChallengeResponse, EvidenceMatrix, RecommendationResult } from "@/types";
import type { EvidenceCitation } from "@/lib/llm/client";
import { classify } from "./classifier";
import { answerAll } from "./answer_stage";
import { challengeStage } from "./debate_stage";
import { triangulate, summarize } from "./triangulator";
import { generateRecommendations } from "./recommendation";

type Emit = (event: CouncilEvent) => void;

export interface PipelineResult {
  classification?: Classification;
  retrieval: Record<Provider, { query: string; evidences: any[]; ms?: number } | undefined>;
  answers: Record<Provider, ModelAnswer | undefined>;
  challenges: Challenge[];
  challengeResponses: ChallengeResponse[];
  supplementaryEvidences: Record<Provider, EvidenceCitation[]>; // 新增:质询阶段的补充证据
  matrix?: EvidenceMatrix;
  recommendation?: RecommendationResult;
  summary?: string;
}

export async function runCouncil(
  query: string,
  configs: ModelConfig[],
  emit: Emit,
  signal?: AbortSignal
): Promise<PipelineResult> {
  const enabledConfigs = configs.filter((c) => c.enabled && c.apiKey);
  if (enabledConfigs.length < 2) {
    emit({ stage: "error", type: "fatal", error: "至少需要启用 2 个模型" });
    return {
      retrieval: { deepseek: undefined, MiniMax: undefined, zhipu: undefined },
      answers: { deepseek: undefined, MiniMax: undefined, zhipu: undefined },
      challenges: [],
      challengeResponses: [],
      supplementaryEvidences: { deepseek: [], MiniMax: [], zhipu: [] },
    };
  }

  const result: PipelineResult = {
    retrieval: { deepseek: undefined, MiniMax: undefined, zhipu: undefined },
    answers: { deepseek: undefined, MiniMax: undefined, zhipu: undefined },
    challenges: [],
    challengeResponses: [],
    supplementaryEvidences: { deepseek: [], MiniMax: [], zhipu: [] },
  };

  // ===== 阶段 ①:分类 =====
  emit({ stage: "classify", type: "start" });
  try {
    const cls = await classify(query, enabledConfigs[0], signal);
    result.classification = cls;
    emit({ stage: "classify", type: "result", data: cls });

    if (cls.type !== "fact_check") {
      emit({
        stage: "summary",
        type: "text",
        data: `这看起来不是事实核查问题(${cls.reason}),Council 不适合处理 ${cls.type} 类问题。建议直接用单一模型对话。`,
      });
      emit({ stage: "done", type: "ok" });
      return result;
    }
  } catch (e) {
    emit({ stage: "error", type: "fatal", error: `分类失败: ${(e as Error).message}` });
    return result;
  }

  // ===== 阶段 ②:各家独立联网作答(取代原来的统一检索) =====
  emit({ stage: "retrieve", type: "start", provider: "deepseek", query });
  emit({ stage: "retrieve", type: "start", provider: "MiniMax", query });
  emit({ stage: "retrieve", type: "start", provider: "zhipu", query });

  const answers = await answerAll(
    query,
    enabledConfigs,
    (provider, text) => {
      emit({ stage: "answer", type: "delta", provider, text });
    },
    signal
  );

  Object.entries(answers).forEach(([provider, ans]) => {
    if (ans) {
      // 把各家原生联网的结果作为"检索结果"上报前端
      emit({
        stage: "retrieve",
        type: "result",
        provider: provider as Provider,
        evidences: ans.evidences,
        ms: ans.answerMs,
      });
      emit({ stage: "answer", type: "result", provider: provider as Provider, answer: ans });
      result.answers[provider as Provider] = ans;
      result.retrieval[provider as Provider] = {
        query,
        evidences: ans.evidences,
        ms: ans.answerMs,
      };
    } else {
      emit({ stage: "answer", type: "error", provider: provider as Provider, error: "回答失败" });
    }
  });

  // ===== 阶段 ③:互相质询(质疑方自己找证据,被质疑方补证据) =====
  emit({ stage: "debate", type: "start" });
  const debate = await challengeStage(answers, enabledConfigs, signal);
  debate.challenges.forEach((c) => emit({ stage: "debate", type: "challenge", data: c }));
  debate.responses.forEach((r) => emit({ stage: "debate", type: "response", data: r }));
  debate.supplementaryEvidences; // 把补充证据也存到 result
  result.supplementaryEvidences = debate.supplementaryEvidences;
  emit({ stage: "debate", type: "end" });
  result.challenges = debate.challenges;
  result.challengeResponses = debate.responses;

  // ===== 阶段 ④:证据矩阵(基于:各家回答 + 补充证据) =====
  // 把补充证据"附加"到每家的回答里,这样证据矩阵能体现质询后的新证据
  const enrichedAnswers: Record<Provider, ModelAnswer | undefined> = { ...answers };
  (Object.entries(debate.supplementaryEvidences) as [Provider, EvidenceCitation[]][]).forEach(
    ([p, evs]) => {
      if (enrichedAnswers[p] && evs.length > 0) {
        enrichedAnswers[p] = {
          ...enrichedAnswers[p]!,
          evidences: [...(enrichedAnswers[p]!.evidences || []), ...evs.map((e) => ({
            url: e.url,
            title: e.title,
            snippet: e.snippet,
            sourceType: e.sourceType,
            fetchedAt: Date.now(),
            source: "web" as const,
          }))],
        };
      }
    }
  );

  emit({ stage: "matrix", type: "start" });
  const matrix = triangulate(enrichedAnswers);
  emit({ stage: "matrix", type: "result", data: matrix });
  result.matrix = matrix;

  const summary = summarize(matrix);
  emit({ stage: "summary", type: "text", data: summary });
  result.summary = summary;

  // ===== 阶段 ⑤:推荐方案 =====
  emit({ stage: "recommend", type: "start" });
  try {
    const recResult = await generateRecommendations(query, matrix, enabledConfigs[0], signal);
    emit({ stage: "recommend", type: "result", data: recResult });
    result.recommendation = recResult;
  } catch (e) {
    emit({
      stage: "recommend",
      type: "result",
      data: {
        recommendations: [],
        reasoning: `推荐生成失败: ${(e as Error).message}`,
      },
    });
  }

  emit({ stage: "done", type: "ok" });
  return result;
}