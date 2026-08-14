// ===== 模型 / 厂商 =====

export type Provider = "deepseek" | "MiniMax" | "zhipu";

export const PROVIDER_META: Record<Provider, { name: string; color: string; soft: string }> = {
  deepseek: { name: "DeepSeek", color: "#1d4ed8", soft: "#eff6ff" },
  MiniMax: { name: "MiniMax", color: "#7c3aed", soft: "#f5f3ff" },
  zhipu: { name: "智谱 GLM", color: "#0d9488", soft: "#f0fdfa" },
};

// ===== 模型配置(用户填写,存 localStorage) =====

export interface ModelConfig {
  provider: Provider;
  apiKey: string;
  model: string; // 如 "deepseek-chat" / "MiniMax-Text-01" / "glm-4-plus"
  baseUrl?: string; // 留空走默认
  enabled: boolean;
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  deepseek: "deepseek-chat",
  MiniMax: "MiniMax-Text-01",
  zhipu: "glm-4-plus",
};

export const DEFAULT_BASE_URLS: Record<Provider, string> = {
  deepseek: "https://api.deepseek.com/v1",
  MiniMax: "https://api.MiniMax.chat/v1",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
};

// ===== 检索结果 =====

export type EvidenceSourceType = "百科" | "官网" | "新闻" | "学术" | "UGC" | "营销" | "内部" | "其他";

export interface EvidenceItem {
  url: string;
  title: string;
  snippet: string;
  sourceType: EvidenceSourceType;
  fetchedAt: number; // ms timestamp
  source: "web" | "local";
}

// ===== 模型作答 =====

export interface Claim {
  text: string; // 关键论据文本
  evidenceIds?: number[]; // 引用的 evidence 编号(可选,UI 已做空判断)
}

export interface ModelAnswer {
  provider: Provider;
  retrievalQuery: string;
  evidences: EvidenceItem[];
  answer: string; // 完整回答(流式累积)
  claims: Claim[]; // 解析出来的关键论据
  answerMs: number; // 回答耗时
}

// ===== 互相质询 =====

export interface Challenge {
  from: Provider;
  to: Provider;
  targetClaim: string; // 被质疑的论据文本
  reason: string;
  severity: "low" | "mid" | "high";
  timestamp: number;
}

export interface ChallengeResponse {
  from: Provider; // 被质疑方回应
  to: Provider;
  originalClaim: string;
  response: string; // "已修正,采用 XX 口径"
  timestamp: number;
}

// ===== 阶段 ① 分类 =====

export type QueryType = "fact_check" | "creative" | "code" | "general";

export interface Classification {
  type: QueryType;
  confidence: number;
  reason: string;
}

// ===== 证据矩阵 =====

export interface StrongEvidence {
  claim: string;
  providers: Provider[];
  evidenceUrls: string[];
  confidence: number; // 0-1
}

export interface WeakEvidence {
  claim: string;
  providers: Provider[];
  evidenceUrls: string[];
}

export interface ConflictingEvidence {
  claim: string;
  positions: { provider: Provider; text: string }[];
}

export interface UnsupportedEvidence {
  claim: string;
  providers: Provider[];
}

export interface EvidenceMatrix {
  strong: StrongEvidence[];
  weak: WeakEvidence[];
  conflicting: ConflictingEvidence[];
  unsupported: UnsupportedEvidence[];
}

// 推荐方案
export interface Recommendation {
  title: string;
  rationale: string;
  confidence: number;
  risks: string[];
  bestFor: string;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  reasoning: string;
}

// ===== SSE 事件类型(所有事件可枚举) =====

export type CouncilEvent =
  // 阶段生命周期
  | { stage: "classify"; type: "start" }
  | { stage: "classify"; type: "result"; data: Classification }
  // 检索
  | { stage: "retrieve"; type: "start"; provider: Provider; query: string }
  | { stage: "retrieve"; type: "result"; provider: Provider; evidences: EvidenceItem[]; ms: number }
  | { stage: "retrieve"; type: "error"; provider: Provider; error: string }
  // 作答
  | { stage: "answer"; type: "start"; provider: Provider }
  | { stage: "answer"; type: "delta"; provider: Provider; text: string }
  | { stage: "answer"; type: "result"; provider: Provider; answer: ModelAnswer }
  | { stage: "answer"; type: "error"; provider: Provider; error: string }
  // 质询
  | { stage: "debate"; type: "start" }
  | { stage: "debate"; type: "challenge"; data: Challenge }
  | { stage: "debate"; type: "response"; data: ChallengeResponse }
  | { stage: "debate"; type: "end" }
  // 证据矩阵
  | { stage: "matrix"; type: "start" }
  | { stage: "matrix"; type: "result"; data: EvidenceMatrix }
  // 推荐方案
  | { stage: "recommend"; type: "start" }
  | { stage: "recommend"; type: "delta"; text: string }
  | { stage: "recommend"; type: "result"; data: RecommendationResult }
  // 总结
  | { stage: "summary"; type: "text"; data: string }
  // 错误 / 终止
  | { stage: "error"; type: "fatal"; error: string }
  | { stage: "done"; type: "ok" };

// ===== 完整 Council 会话状态(前端 store 用) =====

export interface CouncilSession {
  query: string;
  startedAt: number;
  classification?: Classification;
  retrieval: Record<Provider, { query: string; evidences: EvidenceItem[]; ms?: number; error?: string } | undefined>;
  answers: Record<Provider, ModelAnswer | undefined>;
  challenges: Challenge[];
  challengeResponses: ChallengeResponse[];
  matrix?: EvidenceMatrix;
  recommendation?: RecommendationResult;
  recommendationStream?: string;
  summary?: string;
  events: CouncilEvent[]; // 全部事件流(用于导出)
  isRunning: boolean;
}

// ===== 导出 HTML 用 =====

export interface CouncilExport {
  query: string;
  startedAt: number;
  finishedAt: number;
  classification?: Classification;
  retrieval: Record<Provider, { query: string; evidences: EvidenceItem[]; ms?: number } | undefined>;
  answers: Record<Provider, ModelAnswer | undefined>;
  challenges: Challenge[];
  challengeResponses: ChallengeResponse[];
  matrix?: EvidenceMatrix;
  recommendation?: RecommendationResult;
  summary?: string;
}

// ===== 工作流模式 =====

export type WorkflowMode = "fact_check" | "deai";

// ===== 去 AI 味:风格指纹 =====

export interface AIFlavorExpression {
  expression: string;
  category: "转折词" | "抽象动词" | "套话" | "结构套路" | "修辞" | "其他";
  severity: "low" | "mid" | "high";
  startOffset: number;
  endOffset: number;
  reason: string;
}

export interface StyleFingerprint {
  provider: Provider;
  originalText: string;
  expressions: AIFlavorExpression[];
  overallScore: number; // 0-100
  analysisMs: number;
}

export interface StyleConflict {
  expression: string;
  category: AIFlavorExpression["category"];
  identifiedBy: Provider[];
  consensusLevel: "high" | "mid" | "low";
}

export interface RewriteSuggestion {
  original: string;
  suggested: string;
  reason: string;
  intensity: "保守" | "适中" | "激进";
}

export interface RewriteVersion {
  label: string;
  text: string;
  rationale: string;
}

export interface StyleChallenge {
  from: Provider;
  to: Provider;
  expression: string;
  reason: string;
  verdict: "agree_ai" | "disagree_ai";
}

export interface StyleChallengeResponse {
  from: Provider;
  to: Provider;
  expression: string;
  response: string;
}

export interface DeAISession {
  originalText: string;
  fingerprints: Record<Provider, StyleFingerprint | undefined>;
  conflicts: StyleConflict[];
  challenges: StyleChallenge[];
  challengeResponses: StyleChallengeResponse[];
  suggestions: RewriteSuggestion[];
  rewriteVersions: RewriteVersion[];
  events: any[];
  isRunning: boolean;
  startedAt: number;
  finishedAt?: number;
}

// ===== 去 AI 味:SSE 事件 =====

export type DeAIEvent =
  | { stage: "fingerprint"; type: "start"; provider: Provider }
  | { stage: "fingerprint"; type: "result"; data: StyleFingerprint }
  | { stage: "fingerprint"; type: "error"; provider: Provider; error: string }
  | { stage: "compare"; type: "start" }
  | { stage: "compare"; type: "result"; data: StyleConflict[] }
  | { stage: "challenge"; type: "start" }
  | { stage: "challenge"; type: "challenge"; data: StyleChallenge }
  | { stage: "challenge"; type: "response"; data: StyleChallengeResponse }
  | { stage: "challenge"; type: "end" }
  | { stage: "rewrite"; type: "start" }
  | { stage: "rewrite"; type: "delta"; text: string }
  | { stage: "rewrite"; type: "result"; data: { suggestions: RewriteSuggestion[]; versions: RewriteVersion[] } }
  | { stage: "done"; type: "ok" }
  | { stage: "error"; type: "fatal"; error: string };

// ===== 历史记录 =====

export interface HistoryItem {
  id: string;
  mode: WorkflowMode;
  title: string;
  preview: string;
  startedAt: number;
  finishedAt: number;
  data: any;
}

// ===== 去 AI 味导出 =====

export interface DeAIExport {
  mode: "deai";
  originalText: string;
  fingerprints: Record<Provider, StyleFingerprint | undefined>;
  conflicts: StyleConflict[];
  suggestions: RewriteSuggestion[];
  rewriteVersions: RewriteVersion[];
  startedAt: number;
  finishedAt: number;
}