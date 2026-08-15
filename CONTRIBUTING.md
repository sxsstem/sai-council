# 贡献指南

感谢你考虑为 Council 做出贡献!

## 🐛 报告 Bug

请到 [Issues](../../issues) 提交,包含:

- 复现步骤
- 期望行为
- 实际行为
- 截图(如有)
- 浏览器 / Node 版本

## 💡 提出新功能

同样在 [Issues](../../issues) 提交,标注 `enhancement` 标签。

描述:
- 这个功能解决什么问题?
- 你的建议方案是什么?
- 是否有替代方案?

## 🔧 提交 Pull Request

### 开发流程

1. Fork 这个仓库
2. 创建 feature branch: `git checkout -b feat/your-feature`
3. 提交你的改动: `git commit -m "feat: add your feature"`
4. 推送到你的 fork: `git push origin feat/your-feature`
5. 在 GitHub 上提交 Pull Request

### 提交规范

我们用 [Conventional Commits](https://www.conventionalcommits.org/):

| 类型 | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档改动 |
| `style` | 代码格式(不影响功能) |
| `refactor` | 重构 |
| `test` | 测试 |
| `chore` | 构建 / 工具链 |

### 代码规范

- TypeScript strict mode
- 遵循现有代码风格(tailwind / React function components)
- 改动要有对应的类型定义
- 关键改动更新 README

### 测试

PR 前请确保:
- `npm run build` 通过
- 手动测试主要工作流(事实核查 + 去 AI 味)
- 没引入新的 console.log

## 🤝 Code of Conduct

请保持友善和专业。我们欢迎所有背景的贡献者。

## 📞 联系方式

- GitHub Issues(首选)
- 邮箱:jamesfan@example.com(占位,待补)

---

由 [小赛AI](https://github.com/your-org) 维护 · 青少年首个 AI 绿色引擎及创意社区