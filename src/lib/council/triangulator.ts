import type { EvidenceMatrix, ModelAnswer, Provider, Claim } from "@/types";

// 程序化生成证据矩阵(无 LLM 介入,纯算法)
export function triangulate(answers: Record<Provider, ModelAnswer | undefined>): EvidenceMatrix {
  const strong: EvidenceMatrix["strong"] = [];
  const weak: EvidenceMatrix["weak"] = [];
  const conflicting: EvidenceMatrix["conflicting"] = [];
  const unsupported: EvidenceMatrix["unsupported"] = [];

  // 收集所有 claim,按文本相似度聚类(简单实现:精确匹配 + 长度归一化)
  const claimGroups = new Map<string, { providers: Set<Provider>; claim: Claim; provider: Provider }[]>();

  (Object.entries(answers) as [Provider, ModelAnswer | undefined][]).forEach(([provider, ans]) => {
    if (!ans) return;
    ans.claims.forEach((claim) => {
      const key = normalizeClaim(claim.text);
      if (!claimGroups.has(key)) claimGroups.set(key, []);
      claimGroups.get(key)!.push({ providers: new Set([provider]), claim, provider });
    });
  });

  // 合并相同 key 的 claims
  claimGroups.forEach((items, key) => {
    const allProviders = new Set<Provider>();
    let anyClaim: Claim | null = null;
    items.forEach((item) => {
      allProviders.add(item.provider);
      anyClaim = item.claim;
    });
    const providerList = Array.from(allProviders);

    if (providerList.length >= 2) {
      // 强证据:2+ 模型独立提到
      const ids = items[0].claim.evidenceIds || [];
      strong.push({
        claim: anyClaim!.text,
        providers: providerList,
        evidenceUrls: ids.map((id: number) => `[${id}]`),
        confidence: 0.7 + 0.1 * providerList.length,
      });
    } else if (providerList.length === 1) {
      // 弱证据
      const urls = (items[0].claim.evidenceIds || []).map((id: number) => `[${id}]`);
      weak.push({
        claim: items[0].claim.text,
        providers: providerList,
        evidenceUrls: urls.length > 0 ? urls : [],
      });
    }
  });

  // 冲突检测:同一主题不同说法
  // 简化版:如果多个模型的 answer 都包含"X 个"或具体数字,提取出来对比
  const numericConflicts = detectNumericConflicts(answers);
  conflicting.push(...numericConflicts);

  // 无证据:有 claim 但没引用任何 evidenceIds
  (Object.entries(answers) as [Provider, ModelAnswer | undefined][]).forEach(([provider, ans]) => {
    if (!ans) return;
    ans.claims.forEach((claim) => {
      if ((claim.evidenceIds || []).length === 0) {
        unsupported.push({
          claim: claim.text,
          providers: [provider],
        });
      }
    });
  });

  return { strong, weak, conflicting, unsupported };
}

function normalizeClaim(text: string): string {
  return text
    .replace(/\s+/g, "")
    .replace(/[，。、,.]/g, "")
    .toLowerCase()
    .slice(0, 50); // 取前 50 字符作为粗匹配 key
}

function detectNumericConflicts(answers: Record<Provider, ModelAnswer | undefined>): EvidenceMatrix["conflicting"] {
  const conflicts: EvidenceMatrix["conflicting"] = [];
  const numRegex = /(\d+(?:\.\d+)?)\s*([%万亿千百十个]?)(米|米|岁|年|月|日|个|位|次|倍|层|级|条|人|元|块)?/g;

  // 提取每个模型回答里的"数字 + 单位"
  const extracts: Record<Provider, { text: string; position: number }[]> = {
    deepseek: [],
    MiniMax: [],
    zhipu: [],
  };

  (Object.entries(answers) as [Provider, ModelAnswer | undefined][]).forEach(([provider, ans]) => {
    if (!ans) return;
    let m;
    while ((m = numRegex.exec(ans.answer)) !== null) {
      extracts[provider].push({ text: m[0], position: m.index });
    }
  });

  // 简化版冲突检测:跳过复杂语义对比,demo 阶段足够
  return conflicts;
}

// 一句话总结
export function summarize(matrix: EvidenceMatrix): string {
  const parts: string[] = [];

  if (matrix.strong.length > 0) {
    parts.push(`有 ${matrix.strong.length} 条共识证据`);
  }
  if (matrix.weak.length > 0) {
    parts.push(`${matrix.weak.length} 条单一来源证据`);
  }
  if (matrix.conflicting.length > 0) {
    parts.push(`${matrix.conflicting.length} 条冲突证据`);
  }
  if (matrix.unsupported.length > 0) {
    parts.push(`${matrix.unsupported.length} 条无证据陈述`);
  }

  if (parts.length === 0) {
    return "未找到充分证据,无法做出判断。";
  }

  return `本次合议:${parts.join(", ")}。`;
}