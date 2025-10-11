# 智点AI平台 - 项目调研进度跟踪（2025-10-11）

## 背景
- 基于《项目深度调研报告》（2025-10-11 复核版）重新梳理关键风险，并对高优先级项进行现场验证。
- 目标：确认紧急问题的现状、补充可执行的整改方案，并列出需要产品/架构决策的事项以便进一步确认。

## 深入调研结论

### P0 级别（立即处理）
| 问题 | 现状验证 | 建议动作 | 预估成本 | 进度状态 / 阻塞点 |
| --- | --- | --- | --- | --- |
| `/api/debug/env` 暴露敏感信息 | 路由已删除（`app/api/debug/env` 目录清理完成），调试脚本已移除引用 | 直接删除路由，改由受控运维工具获取环境信息；同时在 CI 中加入“禁止调试路由”守卫 | 0.5h | ✅ 已完成 —— 路由目录与脚本引用均清理；后续在 CI 中补充守卫 |
| 生产环境危险变量缺乏强制校验 | `validateProductionEnv()` 已实现（支持 `ENV_GUARD_ALLOWLIST` / `ENV_GUARD_ALLOW_RUNTIMES` 豁免），并在 `middleware.ts`、`app/layout.tsx`、`lib/prisma.ts`、API helper 等入口通过 `env-init` 自动执行；新增 `pnpm env:check` 集成到 `deploy:check` | 在应用启动入口新增 `validateProductionEnv()`，检测 `DEV_LOGIN_CODE`、`E2E_BYPASS_AUTH` 等变量，一旦存在即中止启动 | 1h | ✅ 已完成 —— 校验已全局注入，CI/部署前置命令已接入；后续需监控白名单使用 |

### P1 级别（两周内完成）
| 问题 | 现场数据 | 补充说明 | 建议动作 | 进度状态 / 阻塞点 |
| --- | --- | --- | --- | --- |
| TypeScript 编译错误阻塞 CI | `pnpm tsc --noEmit --pretty false` 输出 16 条错误，集中在 `app/creative/merchants/[merchantId]/assets/page.tsx`、`scripts/*`、`tests/*` 等 | 错误类型涵盖枚举不匹配、`string | null` 处理不当、缺少 Vitest 全局类型、`NODE_ENV` 只读等 | 按模块拆分修复，优先解决生产路径（app/scripts）后清理测试文件；同步补上 Vitest 全局类型与 `tsconfig` 配置 | 进行中 —— 需拆分负责人并建立子任务，当前错误仍阻塞 CI |
| API 路由缺少统一速率限制与日志 | 抽样检查显示多个路由仍使用裸 `console.*`，且鉴权/限流逻辑分散 | 已新增 `lib/security/rate-limiter.ts`，但缺乏统一装饰器落地 | 建议编写 `withAuth`/`withRateLimit` 高阶封装，顺带接入结构化日志记录 `requestId`、`userId`、`duration` | 未启动 —— 仅有工具模块，尚未在路由中接入统一封装 |
| JSON 字段缺少 Schema 校验 | `metadata` 等字段仍以 `any` 形式传递 | 创意批次接口已采用 Zod 校验，其余路由仍待迁移 | 引入 Zod/类型包装层，生成编解码器，逐步替换直接访问 | 部分进展 —— 创意模块已使用 Zod，需制定其余路由的迁移计划 |

### P2 级别（一个月内）
- 中间件 `middleware.ts` 仍为多层分支结构，且每次请求都会重新解析 JWT。建议引入 LRU 缓存（30s TTL）并拆出 `withMiddlewareContext` 封装，降低高频接口开销。
- `/api/metrics` 及关联监控逻辑仍处于半成品状态，需要重新设计为消息队列或日志管道，保障失败兜底能力。
- `UserSession` 模型仍未被写入，存在数据陈旧风险。需在“强制下线”与“彻底删除”之间做出选择。

## 执行路线图（建议）
1. **安全兜底（Day 1）** *(当前状态：未开始 — 待删除路由并实现启动校验)*
   - 删除 `/api/debug/env`。
   - 实现 `validateProductionEnv()` 并在应用入口调用。
2. **编译与测试绿灯（Day 2-3）** *(当前状态：进行中 — `tsc` 仍报 16 条错误，需拆分执行人)*
   - 按模块修复 TypeScript 错误，补齐 Vitest 配置。
   - 确定 `tsconfig.test.json` / `setupTests.ts` 方案。
3. **API 基础设施（Day 4-6）** *(当前状态：待启动 — 速率限制封装未落地)*
   - 设计并接入 `withAuth` + `withRateLimit` 装饰器。
   - 替换调试日志为结构化日志（Pino/Winston）。
4. **架构优化（Week 2-3）** *(当前状态：待评估 — 中间件与 `/api/metrics` 尚未动工)*
   - 中间件瘦身与 Token 缓存。
   - JSON Schema 化与 `/api/metrics` 重构。
   - 评估 `UserSession` 取舍方案，并据此实施迁移/清理。

## 近期增量（2025-10-11）
- 创意批次 API (`app/api/creative/batches/route.ts`) 已集成 Zod 参数校验，为后续 JSON Schema 推进提供参考范式。
- 新增 `lib/security/rate-limiter.ts` 模块，提供统一速率限制能力，等待在路由层的封装与接入。
- 新增 `lib/config/env-guard.ts` + `env-init` 模块，配合 `pnpm env:check` 命令实现生产环境危险变量兜底，并支持预览环境白名单豁免。

## 待确认事项
1. **调试接口**：默认方案为直接移除 `/api/debug/env`，若需保留需提供受控环境与访问策略（当前已删除，如需恢复需走变更流程）。
2. **日志方案**：待确定采用 Pino 还是延续自研封装，并确认与现有监控链路的集成方式。
3. **JSON Schema 工具**：当前新增功能倾向使用 Zod，仍需确认是否统一采纳或与 Prisma 类型派生混合使用。
4. **UserSession 处理策略**：是补齐刷新/吊销机制，还是完全转向 JWT + 黑名单（Redis）？需在 Week 2 前定稿。
5. **CI 集成范围**：类型检查、日志守卫、调试路由禁令是否全部进入 `pnpm deploy:check`，以保障持续验证；需额外建立白名单使用审计/告警机制。

## 后续工作建议
- 在完成 P0 项后安排一次 30 分钟同步会议，对 P1/P2 行动方案进行确认并分配负责人。
- 建议为每个动作创建对应 issue，便于跟踪，同时把 TypeScript 修复拆分为多条可并行执行的子任务。
- 将 `scripts/project-health-check.js` 纳入 CI，作为质量基线报警工具，确保后续回归不会再次出现“文档合格但 CI 不通过”的误差。
