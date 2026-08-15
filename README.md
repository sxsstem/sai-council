# Sai Council · 多模型合议

> 让多个国产大模型组成"陪审团",对每个问题独立判断、互相质询、带证据链地给你结论。

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org)

> **由 [小赛AI](https://github.com/sxsstem) 维护** · 青少年首个 AI 绿色引擎及创意社区

Sai Council 是一个本地优先的 AI 工具,核心理念不是"综合多模型答案",而是**让多个模型的差异暴露给你看**。

## 两个工作流

| 工作流 | 用途 | 适合人群 |
|---|---|---|
| **事实核查** | 多个模型独立联网检索 → 互相质询 → 证据矩阵 → 推荐方案 | 创作者核查引用、研究者查证、记者核实事实 |
| **去 AI 味** | 找出文本里的 AI 标志性表达 → 互相质询 → 改写建议 | 小红书 / 公众号 / 自媒体 / 课程文案 |

## 关键特性

- **多模型合议机制**:DeepSeek / MiniMax / 智谱 GLM 三家国产模型,各自独立联网检索,互相质询对方论据
- **过程全透明**:5 阶段(分类 → 检索 → 作答 → 质询 → 矩阵)逐步可见,不输出"最终综合答案"
- **证据矩阵可视化**:把多模型结论分四档——强证据 / 弱证据 / 冲突 / 无证据
- **推荐方案生成**:基于证据矩阵给出 2-3 个候选方案,带置信度、风险、适用场景
- **本地历史库**:每次合议自动保存,可随时加载回看
- **文件上传**:支持 PDF / TXT / MD / HTML,作为核查/审计的输入
- **导出 HTML**:单页自包含报告,双击就能打开和分享

## 技术栈

- **前端**:Next.js 14 + TypeScript + Tailwind + shadcn/ui
- **后端**:Next.js Route Handlers(Node.js runtime)
- **流式通信**:Server-Sent Events (SSE)
- **状态管理**:Zustand + persist(配置存 localStorage)
- **LLM 客户端**:自写 OpenAI 兼容适配器,无框架依赖
- **文件解析**:pdf-parse(PDF) + cheerio(HTML) + 原生读取(TXT/MD)

## 快速开始

### 前置要求

- Node.js 18+
- 至少 2 个国产大模型 API Key(DeepSeek / MiniMax / 智谱)

### 安装

```bash
git clone https://github.com/sxsstem/sai-council.git
cd council
npm install
```

### 启动

```bash
npm run dev
# 打开 http://localhost:3010
```

### 配置

1. 访问 `/settings`
2. 填写至少 2 个模型的 API Key
3. 测试连接 —— 通过后自动启用
4. 回到主页,开始合议

### 模型选择

| 厂商 | 推荐模型 | 联网支持 |
|---|---|---|
| DeepSeek | `deepseek-reasoner` | ✅ 原生 |
| 智谱 GLM | `glm-4-plus` 或更新 | ✅ 原生 |
| MiniMax | `MiniMax-Text-01` | ⚠️ 走 prompt 降级 |

> **重要**:DeepSeek 的 `deepseek-chat` 模型**不支持**联网搜索,务必使用 `deepseek-reasoner`。

## 架构

```
src/
├── app/
│   ├── page.tsx              # 主页(2 tab + 输入 + 文件上传 + 侧栏)
│   ├── settings/page.tsx     # 模型配置
│   └── api/
│       ├── council/          # 事实核查 SSE
│       ├── deai/             # 去 AI 味 SSE
│       ├── upload/           # 文件上传
│       ├── test-model/       # 测试模型连通性
│       └── cleanup/          # 清理临时文件
├── components/                # UI 组件
│   ├── QueryInput.tsx
│   ├── FileUploader.tsx
│   ├── HistorySidebar.tsx
│   ├── DebatePanel.tsx       # 微信群聊式质询
│   ├── EvidenceMatrixPanel.tsx
│   ├── RecommendationPanel.tsx
│   └── DeAIResult.tsx
├── lib/
│   ├── llm/                  # OpenAI 兼容 LLM 客户端
│   ├── council/              # 5 阶段 pipeline
│   │   ├── pipeline.ts        # 事实核查主流程
│   │   ├── classifier.ts      # ① 任务分类
│   │   ├── answer_stage.ts    # ② ③ 各家原生联网回答
│   │   ├── debate_stage.ts    # ④ 互相质询
│   │   ├── triangulator.ts    # ⑤ 证据矩阵
│   │   ├── recommendation.ts  # 推荐方案
│   │   └── deai_pipeline.ts   # 去 AI 味 5 阶段
│   ├── files/                 # 文件解析
│   ├── retrieval/             # 旧版检索(已弃用,保留接口)
│   └── export/                # HTML 报告导出
├── store/                     # Zustand stores
└── types/                     # 全栈共享类型
```

## 5 阶段流程(事实核查)

```
用户输入
   ↓
① 分类    任务类型判断(只跑 fact_check)
   ↓
② 检索    3 家模型各自原生联网搜证据
   ↓
③ 作答    3 家基于各自证据回答
   ↓
④ 质询    A 找 B 的漏洞 / B 找 C 的漏洞 · 回应
   ↓
⑤ 矩阵    程序化生成 strong/weak/conflicting/unsupported
   ↓
⑥ 推荐    基于矩阵生成 2-3 个方案 + 置信度 + 风险
```

## 5 阶段流程(去 AI 味)

```
用户粘贴文本
   ↓
① 指纹    3 家各自识别 AI 味表达
   ↓
② 比对    共识度:高 / 中 / 低
   ↓
③ 质询    "这真的算 AI 味吗?" 互相辩论
   ↓
④ 改写    每个 AI 味生成"保守/适中/激进"替换
   ↓
⑤ 整体    输出 2-3 个完整改写版本
```

## 声明

Sai Council 通过多模型独立判断 + 证据对账 / 风格审计,辅助用户决策,不保证消除所有幻觉。
对于投资、学术、新闻等高风险场景,仍需人工复核。

## License

MIT © [小赛AI](https://github.com/sxsstem) — 详见 [LICENSE](LICENSE) 文件。

## 关于小赛AI

小赛AI 是面向青少年的首个 AI 绿色引擎及创意社区。我们致力于让下一代在 AI 时代更有创造力、更负责任地使用技术。

Sai Council 是小赛AI 工具矩阵中的一员,后续会有更多开源项目。

---

## 贡献

欢迎 PR、Issue、Feedback。任何形式都欢迎。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)。