import type { Provider, ModelConfig } from "@/types";
import { DEFAULT_BASE_URLS, DEFAULT_MODELS } from "@/types";

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  /** 是否启用各家模型的原生联网搜索(各家实现方式不同) */
  enableWebSearch?: boolean;
}

interface ChatResult {
  text: string;
  ms: number;
  /** 模型原生返回的引用(各家格式不同,我们尽量标准化) */
  citations: EvidenceCitation[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** 标准化的引用格式(各家模型统一) */
export interface EvidenceCitation {
  url: string;
  title: string;
  snippet: string;
  source: string; // 来源域名 / 来源名称
  sourceType: "百科" | "官网" | "新闻" | "学术" | "UGC" | "营销" | "其他";
}

function resolveEndpoint(cfg: ModelConfig): { url: string; model: string } {
  const base = cfg.baseUrl || DEFAULT_BASE_URLS[cfg.provider];
  const model = cfg.model || DEFAULT_MODELS[cfg.provider];
  return { url: `${base.replace(/\/$/, "")}/chat/completions`, model };
}

/** URL → 来源类型(启发式) */
function classifyUrl(url: string): EvidenceCitation["sourceType"] {
  const u = url.toLowerCase();
  if (u.includes("wikipedia") || u.includes("baike.baidu") || u.includes("wiki")) return "百科";
  if (u.includes("arxiv") || u.includes("pubmed") || u.includes("scholar") || u.includes("cnki")) return "学术";
  if (u.includes(".gov") || u.includes("gov.cn")) return "官网";
  if (u.includes("xinhua") || u.includes("people.com") || u.includes("thepaper") || u.includes("reuters") ||
      u.includes("bbc") || u.includes("nytimes") || u.includes("sina") || u.includes("sohu") || u.includes("163.com")) return "新闻";
  if (u.includes("zhihu") || u.includes("weibo") || u.includes("bilibili") || u.includes("xiaohongshu")) return "UGC";
  if (u.includes("mp.weixin") || u.includes("toutiao")) return "营销";
  return "其他";
}

/**
 * 各家原生联网参数适配:
 * - DeepSeek deepseek-reasoner:tools=[{type:"web_search"}]
 * - DeepSeek deepseek-chat:不支持 function calling,需 search 单独参数(我们用 model=deepseek-chat + prompt 引导)
 * - 智谱 GLM-4-Plus:tools=[{type:"web_search", web_search:{search_result":true}}]
 * - MiniMax:暂用基础 API + 在 prompt 里要求模型"假设自己搜过"
 *
 * 返回 { body, parseCitations }:body 是请求体,parseCitations 用于从响应里抽取引用
 */
function buildWebSearchAdapter(cfg: ModelConfig, enableWebSearch: boolean) {
  if (!enableWebSearch) {
    return {
      body: {},
      parseCitations: (json: any): EvidenceCitation[] => [],
    };
  }

  if (cfg.provider === "deepseek" && cfg.model.includes("reasoner")) {
    return {
      body: {
        tools: [{ type: "web_search" }],
      },
      parseCitations: (json: any): EvidenceCitation[] => {
        // DeepSeek reasoner 把搜索结果放在 message.tool_calls / web_search 返回
        const toolCalls = json.choices?.[0]?.message?.tool_calls || [];
        const citations: EvidenceCitation[] = [];
        for (const tc of toolCalls) {
          const results = JSON.parse(tc.function?.arguments || "{}").results || [];
          for (const r of results) {
            citations.push({
              url: r.url || "",
              title: r.title || "",
              snippet: r.snippet || r.content || "",
              source: r.source || (r.url ? new URL(r.url).hostname : ""),
              sourceType: classifyUrl(r.url || ""),
            });
          }
        }
        return citations;
      },
    };
  }

  if (cfg.provider === "zhipu") {
    return {
      body: {
        tools: [{ type: "web_search", web_search: { search_result: true } }],
      },
      parseCitations: (json: any): EvidenceCitation[] => {
        // 智谱 GLM-4-Plus 把搜索结果放在 message.tool_calls
        const toolCalls = json.choices?.[0]?.message?.tool_calls || [];
        const citations: EvidenceCitation[] = [];
        for (const tc of toolCalls) {
          try {
            const args = typeof tc.function?.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : tc.function?.arguments || {};
            const results = args.search_result || args.results || [];
            for (const r of results) {
              citations.push({
                url: r.url || r.link || "",
                title: r.title || r.name || "",
                snippet: r.snippet || r.content || "",
                source: r.source || (r.url ? new URL(r.url).hostname : ""),
                sourceType: classifyUrl(r.url || r.link || ""),
              });
            }
          } catch {}
        }
        return citations;
      },
    };
  }

  // DeepSeek chat / MiniMax 等不支持原生联网的:在 prompt 里要求模型标注引用
  return {
    body: {},
    parseCitations: (json: any): EvidenceCitation[] => [],
  };
}

async function chat(cfg: ModelConfig, opts: ChatOptions): Promise<ChatResult> {
  const { url, model } = resolveEndpoint(cfg);
  const start = Date.now();

  const adapter = buildWebSearchAdapter(cfg, !!opts.enableWebSearch);

  const body: any = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 2048,
    stream: !!opts.stream,
    ...adapter.body,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`[${cfg.provider}] HTTP ${resp.status}: ${errText.slice(0, 200)}`);
  }

  // 流式(各家流式响应里夹带工具调用结果比较复杂,demo 阶段先简化:流式期间不解析引用,流式结束后再补抓一次)
  if (opts.stream && resp.body) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let lastJson: any = null; // 保留最后一条 JSON 用于解析引用

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;

        try {
          const json = JSON.parse(payload);
          lastJson = json;
          const delta = json.choices?.[0]?.delta?.content || "";
          if (delta) {
            fullText += delta;
            opts.onDelta?.(delta);
          }
        } catch {}
      }
    }

    const citations = lastJson ? adapter.parseCitations(lastJson) : [];
    return { text: fullText, ms: Date.now() - start, citations };
  }

  // 非流式
  const json = await resp.json();
  const text = json.choices?.[0]?.message?.content || "";
  const citations = adapter.parseCitations(json);
  return { text, ms: Date.now() - start, citations, usage: json.usage };
}

async function testConnection(cfg: ModelConfig): Promise<{ ok: boolean; error?: string; ms: number }> {
  const start = Date.now();
  try {
    const result = await chat(cfg, {
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 8,
      temperature: 0,
    });
    return { ok: true, ms: result.ms };
  } catch (e) {
    return { ok: false, error: (e as Error).message, ms: Date.now() - start };
  }
}

export { chat, buildWebSearchAdapter, buildSelfSearchPrompt, testConnection };
export type { ChatOptions, ChatResult, ChatMessage };

/**
 * 让不支持原生联网的模型(DeepSeek chat、MiniMax)在 prompt 里"假装"自己搜了,然后主动给出来源
 * 这是降级方案,但仍然比"完全没有联网"好
 */
function buildSelfSearchPrompt(query: string): string {
  return `请你像平时回答用户那样回答以下问题。
要求:
1. 基于你已有的知识回答,不需要联网(如果你的服务不支持联网)
2. 如果你引用了任何具体事实/数据/日期/引言,请在回答末尾用 JSON 列出引用:

引用格式(JSON 数组):
[
  { "title": "来源标题", "url": "可能的来源 URL(可以基于常识推测)", "snippet": "引用片段" }
]

用户问题:"""${query}"""\n\n回答:`;
}