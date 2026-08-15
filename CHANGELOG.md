# 更新日志

所有 notable 改动记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
本项目遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.1] - 2026-08-15

### 修复
- 去 AI 味工作流的"改写建议"功能稳定化
  - 即使 conflicts 为空,prompt 强制要求至少 3 条建议 + 3 个版本(保守/适中/激进)
  - JSON 解析鲁棒化:支持 ```json / ```JSON / 裸 JSON / markdown 解释+JSON 多种格式
  - 整体改写版本自动补全:模型输出 2 个版本时,补全第三个的"未生成"占位
- UI 改善
  - suggestions 为空时显示"本次未生成"提示而非隐藏整个面板
  - 整体改写版本 text 为空时显示"此版本未生成"占位
  - Copy 按钮在 text 为空时禁用

## [0.1.0] - 2026-08-15

### 新增
- 多模型合议核心引擎(5 阶段 pipeline)
- 事实核查工作流:任务分类 → 各家原生联网 → 互相质询 → 证据矩阵 → 推荐方案
- 去 AI 味工作流:风格指纹采集 → 交叉比对 → 互相质询 → 改写建议
- 三个国产大模型适配:DeepSeek / MiniMax / 智谱 GLM(OpenAI 兼容)
- 证据矩阵四档分类:强证据 / 弱证据 / 冲突 / 无证据
- 微信群聊式质询界面
- 本地历史案例库(localStorage 持久化)
- 文件上传(PDF / TXT / MD / HTML,单文件 ≤30MB,最多 10 个)
- HTML 报告导出(自包含,双击即可打开)
- 浅色主题 + 键盘快捷键(⌘+K 聚焦、⌘+Enter 启动、Esc 取消)
- Toast 通知系统
- 设置页(模型 API Key 配置 + 连通性测试)

### 技术
- Next.js 14 App Router
- TypeScript strict mode
- SSE(Server-Sent Events)流式通信
- Zustand + persist 本地存储
- 自写 OpenAI 兼容 LLM 客户端(无框架依赖)
- pdf-parse + cheerio 文件解析

[Unreleased]: https://github.com/sxsstem/sai-council/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/sxsstem/sai-council/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/sxsstem/sai-council/releases/tag/v0.1.0