# Repository Guidelines

## 项目结构与模块职责
- `app/` 承载 Next.js App Router 页面、Server Actions 以及 `app/api` 接口。
- `components/`、`lib/`、`hooks/`、`utils/` 封装可复用 UI 与业务逻辑；`stores/` 管理全局状态。
- `prisma/` 保存数据模型与迁移脚本，`scripts/` 管理运维脚本；静态资产置于 `public/`。
- 单元测试集中在 `tests/`，端到端脚本位于 `e2e/`；报告输出到 `playwright-report/` 与 `test-results/`。

## 构建与开发命令
- 初次安装运行 `pnpm i`，开发模式使用 `pnpm dev`，默认端口 3007。
- 产线构建执行 `pnpm build`，随后 `pnpm start` 验证产物；格式检查用 `pnpm lint`。
- 单元测试可按需运行 `pnpm test`、`pnpm test:run` 或 `pnpm test:ui`；端到端测试使用 `pnpm test:e2e` 与 `pnpm test:e2e:ui`，报告通过 `pnpm test:e2e:report` 汇总。
- 数据层相关命令包括 `pnpm db:generate`、`pnpm db:push`、`pnpm db:seed`、`pnpm db:studio`。

## 编码风格与命名
- 全面采用 TypeScript，代码缩进两空格，组件与文件名遵循 kebab-case（如 `components/theme-toggle.tsx`）。
- 明确区分 Next.js Server/Client 组件，避免在 Server 组件内引入浏览器专属 API。
- 使用 ESLint 规则扩展 `next/core-web-vitals`，默认禁止 `console`；临时调试需以 `_` 前缀接收变量。
- 路径别名统一使用 `@/*`，配置定义于 `tsconfig.json` 与 `vitest.config.ts`。

## 测试规范
- 单元与集成测试由 Vitest + `jsdom` 驱动，公共初始化位于 `tests/setup.ts`，测试文件命名为 `*.test.ts`。
- Playwright 负责关键用户路径，测试存放在 `e2e/`，文件命名 `*.spec.ts`，通用工具位于 `e2e/helpers/`。
- 建议在 Pull Request 中展示关键场景截图或 CLI 录屏，并附带最新测试输出摘要。

## 提交与 Pull Request
- 遵循 Conventional Commits：`feat`、`fix`、`docs`、`refactor`、`security`、`chore`、`merge`、`backup`；示例 `feat: add merchant report export`。
- PR 描述需涵盖需求背景、核心改动、风险与回滚策略，关联任务或 issue，并标注 Schema 变化。
- 合并前须通过 `pnpm lint`、`pnpm test`，涉及端到端改动需附上 `pnpm test:e2e:basic` 结果。

## 配置与安全提示
- `.env.example` 是环境变量基线，开发前复制为 `.env` 并使用 `pnpm env:validate` 自检；切换环境可执行 `pnpm env:toggle`。
- 发布前运行 `pnpm security:check:prod && pnpm pre-deploy`，必要时使用 `pnpm build:safe` 或 `pnpm build:prod`。
- 数据脚本请审阅 `prisma/seed.ts`，确认不会覆写生产数据；敏感备份保存在 `backups/` 与 `rollback-backups/`。
