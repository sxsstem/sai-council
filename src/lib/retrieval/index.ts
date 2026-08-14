/**
 * 旧:Bocha 统一检索(已弃用)
 *
 * 原因:用同一个搜索引擎给三家模型做"统一检索",会导致:
 * 1. 80% 来源重合 — 失去"多模型独立判断"的差异化
 * 2. 集体幻觉风险 — 同质化对抗
 * 3. 浪费各家模型原生联网能力
 *
 * 新架构:每家模型用各自的原生联网搜索(DeepSeek reasoner / 智谱 GLM-4-Plus / MiniMax 等)
 * 想重新启用 Bocha 时,取消注释即可,但**强烈不建议**。
 */

/*
import type { EvidenceItem, Provider } from "@/types";

export interface RetrievalProvider {
  search(query: string, provider: Provider): Promise<EvidenceItem[]>;
}

function classifySourceType(url: string): EvidenceItem["sourceType"] {
  const u = url.toLowerCase();
  if (u.includes("arxiv") || u.includes("pubmed") || u.includes("scholar") || u.includes("cnki") || u.includes("wanfang")) return "学术";
  if (u.includes("wikipedia") || u.includes("baike.baidu") || u.includes("wiki")) return "百科";
  if (u.includes(".gov") || u.includes("gov.cn")) return "官网";
  if (u.includes("xinhua") || u.includes("people.com") || u.includes("thepaper") || u.includes("reuters") || u.includes("bbc") || u.includes("nytimes") || u.includes("sina") || u.includes("sohu") || u.includes("163.com")) return "新闻";
  if (u.includes("zhihu") || u.includes("weibo") || u.includes("bilibili") || u.includes("xiaohongshu") || u.includes("douban")) return "UGC";
  if (u.includes("mp.weixin") || u.includes("toutiao")) return "营销";
  return "其他";
}

function mapBochaResults(items: any[]): EvidenceItem[] {
  return items.map((item) => ({
    url: item.url || item.link || "",
    title: item.name || item.title || "",
    snippet: item.snippet || item.summary || item.content || "",
    sourceType: classifySourceType(item.url || item.link || ""),
    fetchedAt: Date.now(),
    source: "web" as const,
  }));
}

export class BochaRetrieval implements RetrievalProvider {
  constructor(private apiKey: string) {}
  async search(query: string, provider: Provider): Promise<EvidenceItem[]> {
    const subQueries = this.deriveSubQuery(query, provider);
    const results: EvidenceItem[] = [];
    for (const q of subQueries) {
      try {
        const resp = await fetch("https://api.bochaai.com/v1/web-search", {
          method: "POST",
          headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, summary: true, count: 5, freshness: "noLimit" }),
        });
        if (!resp.ok) continue;
        const json = await resp.json();
        const items = json.data?.webPages?.value || [];
        results.push(...mapBochaResults(items));
      } catch {}
    }
    return results.slice(0, 8);
  }
  private deriveSubQuery(query: string, provider: Provider): string[] {
    const base = query.trim();
    if (provider === "deepseek") return [base, `${base} 维基百科`];
    if (provider === "MiniMax") return [base, `${base} 官方`];
    return [base, `${base} 新闻`];
  }
}
*/
