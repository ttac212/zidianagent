# 安全修复计划

## 零、重要说明
- 当前代码存在阻断上线的功能安全隐患，必须优先完成修补，再讨论迭代需求或新功能。
- 项目仍处于初期测试阶段，禁止使用真实 API key 进行任何测试或压测；请使用模拟凭证或环境变量注入的测试 key，并在测试记录中注明来源。

## 一、关键风险总览
| 编号 | 风险摘要 | 风险类型 | 影响级别 | 当前状态 | 优先级 | 责任人 | 预计完成 | 关联模块 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | 模型选择状态未与全局同步，刷新后会话落回默认模型 | 状态一致性 | 高 | 未开始 | P0 | 待指派 | 2025-10-02 | app/workspace/page.tsx | 影响所有新会话 |
| R2 | Token 配额更新非原子，导致突破月度限额 | 资源滥用 | 严重 | 未开始 | P0 | 待指派 | 2025-10-03 | app/api/chat/route.ts 等 | 造成潜在成本失控 |
| R3 | 会话列表 API 缺少限流与分页保护，易触发 DoS | 可用性 | 严重 | 未开始 | P0 | 待指派 | 2025-10-03 | app/api/conversations/route.ts | 可能拖垮数据库与前端 |

> 状态取值建议：未开始 / 进行中 / 代码评审 / 待验证 / 已完成。需要时可附加百分比。

## 二、风险详解、验证与完成定义

### R1 模型状态不同步
- **根因**：`selectedModel` 通过 `useState(() => localStorage...)` 取得初始值，没有订阅全局 `useModelState` 的更新或 `storage` 事件。
- **影响范围**：工作台切换模型、新建会话、刷新后继续会话的用户体验。
- **完成判定**：
  - [ ] 切换模型后刷新页面，当前标签页与新标签页保持一致模型。
  - [ ] 新会话创建时沿用最新选择的模型，数据库 `modelId` 与 UI 展示一致。
  - [ ] 关闭后重新打开页面，模型选择从单一来源加载，无闪烁或回退。
- **开发任务**：
  - [ ] 重构 `useModelState`，去除页面内的冗余 `useState` 初始化。
  - [ ] 实现 `getCurrentModel()` 辅助方法，集中管理默认模型选择。
  - [ ] 监听 `storage` 事件，保持多标签页同步（必要时降级为轮询）。
- **测试检查**：
  1. 浏览器多标签实验：标签 A 切换模型后，标签 B 在 1s 内同步。
  2. 新建会话后检查数据库条目 `conversations.modelId`。
  3. 单元测试覆盖：`useModelState` 钩子在 `storage` 事件触发时能更新。
- **监控指标**：
  - UI 端埋点：模型切换成功率 >= 99%。
  - 日志：`model-desync` 级别告警为 0。
- **阻塞/依赖**：需要前端全局状态管理方案确认（Redux/Context）。

### R2 Token 原子配额
- **根因**：当前将请求 Token 使用量追加到聚合表，再写回用户表，期间缺少数据库级原子约束。
- **影响范围**：发起大量请求的付费用户、成本控制、滥用风控。
- **完成判定**：
  - [ ] 新增的 `QuotaManager.reserveTokens` 在并发 50 下无超额写入。
  - [ ] 请求失败时 `releaseTokens` 能回滚预留额度。
  - [ ] 月度额度耗尽后返回 429，并记录审计日志。
- **开发任务**：
  - [ ] 新建 `lib/security/quota-manager.ts`，实现原子更新与审计日志。
  - [ ] `/api/chat` 接口按 `reserve → 调用模型 → commit/release` 流程改造。
  - [ ] 增加 `ENABLE_ATOMIC_QUOTA` 环境变量开关及配置校验。
  - [ ] 编写并发单测（Vitest）验证乐观锁/事务。
- **测试检查**：
  1. 单元测试：模拟 20 并发请求，确认只允许额度内请求成功。
  2. 集成测试：校验 429 返回结构、错误码、`Retry-After` 头。
  3. 压测脚本：30 秒内持续请求，观察数据库 `currentMonthUsage`。
- **监控指标**：
  - Prometheus 指标 `quota_reserve_failures` < 1 次/天。
  - 日志：记录 `userId`、`requestedTokens`、`reason`。
- **阻塞/依赖**：需要 DBA 确认数据库事务隔离级别；可能依赖 Redis 备份策略。

### R3 会话列表 DoS
- **根因**：`limit` 参数缺少上限校验，`includeMessages` 会一次性读取所有消息。
- **影响范围**：会话列表页面、数据库 CPU/IO、Node Worker 内存。
- **完成判定**：
  - [ ] `limit` 超出范围返回 400，`includeMessages=true` 时强制小页大小。
  - [ ] 默认响应仅包含 `lastMessage`，历史消息通过详情接口按需获取。
  - [ ] 新增速率限制，超过阈值返回 429 并记录審计日志。
- **开发任务**：
  - [ ] 新增参数校验层，定义 `limit` 区间 1-50。
  - [ ] `includeMessages=true` 时设置 `take<=100` 并限制为最近消息。
  - [ ] 引入 `RateLimitMiddleware.general` 针对 `/api/conversations`。
  - [ ] 调整 Prisma 查询，使用 `select`/`include` 减少冗余字段。
  - [ ] 更新前端请求逻辑，改为分页/懒加载。
- **测试检查**：
  1. 单元测试覆盖参数校验：`limit=0/1000` 等返回 400。
  2. 集成测试验证 `includeMessages=true` 响应数据体积受控。
  3. 压测：以 20 req/s 请求列表，接口保持 < 80ms 且无内存飙升。
- **监控指标**：
  - Prometheus `conversations_rate_limited_total`。
  - APM 慢查询告警（> 200ms）降低至 0。
- **阻塞/依赖**：需后端同意引入速率限制器；前端分页设计同步。

## 三、阶段任务拆解（WBS）
| 阶段 | 子任务 | 负责人 | 输出物 | 状态 | 预计完成 | 实际完成 | 依赖/备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phase 1 | 搭建 `QuotaManager` 基础能力与并发测试 | 待指派 | `lib/security/quota-manager.ts`、并发用例 | 未开始 | 2025-09-30 | - | 需确认数据库事务方案 |
| Phase 1 | `/api/chat` 接口引入原子配额流程 | 待指派 | 更新后的接口代码、错误码文档 | 未开始 | 2025-10-01 | - | 依赖 `QuotaManager` |
| Phase 1 | `/api/conversations` 参数校验与分页限制 | 待指派 | 参数校验逻辑、Prisma 查询优化 | 未开始 | 2025-10-01 | - | - |
| Phase 1 | 增加 Rate Limit 与监控指标 | 待指派 | 新增中间件、Prometheus 指标 | 未开始 | 2025-10-02 | - | - |
| Phase 2 | 前端 `useModelState` 重构与存储同步 | 待指派 | 更新后的 `app/workspace/page.tsx` | 未开始 | 2025-10-02 | - | 需确认状态管理策略 |
| Phase 2 | 跨标签页同步与回归测试 | 待指派 | 浏览器兼容性验证记录 | 未开始 | 2025-10-02 | - | - |
| Phase 3 | 回归测试（单测、集成、E2E） | QA | 测试报告、缺陷单 | 未开始 | 2025-10-03 | - | 覆盖三大风险点 |
| Phase 3 | 监控/告警验证 + 回滚预案演练 | SRE | 监控大盘截图、回滚脚本 | 未开始 | 2025-10-03 | - | 与运维同步窗口 |

## 四、关键里程碑与检查点
- 2025-09-29：更新安全修复文档，明确 WBS 与验收标准（完成）。
- 2025-09-30：Phase 1 代码进入评审，完成并发/限流能力验证。
- 2025-10-02：Phase 2 前端改造合并，准备全链路回归。
- 2025-10-03：完成 Phase 3 验收，准备上线窗口。
- 上线前：确认监控阈值、回滚脚本、应急联系人。

## 五、验收标准与测试计划
| 编号 | 场景 | 验证方式 | 责任人 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| T1 | 模型切换后刷新保持一致 | 手工 + 单元测试 | QA/前端 | 未开始 | 涉及多标签页 |
| T2 | 配额原子性并发测试 | 自动化（Vitest + 脚本） | 后端 | 未开始 | 需要 20+ 并发模拟 |
| T3 | 配额耗尽提示与日志 | 手工 + 日志审计 | 后端 | 未开始 | 检查 `audit_logs` 表 |
| T4 | 会话列表参数越界 | 自动化（API 测试） | QA | 未开始 | 校验 400、429 响应体 |
| T5 | 压测性能指标 | 压测平台 + APM | SRE | 未开始 | `/api/chat` P95 < 20ms |
| T6 | 回滚演练 | 手工脚本 | SRE | 未开始 | 验证特性开关生效 |

> 测试阶段严禁使用真实 API key；所有脚本需指明使用的测试凭证及隔离环境。

## 六、监控与回滚策略
- 新增指标：`quota_reserve_failures`、`conversations_rate_limited_total`、`model_desync_events`。
- 告警阈值：连续 5 分钟 > 0 触发 PagerDuty。
- 日志字段：`requestId`、`userId`、`modelId`、`requestedTokens`。
- 回滚方案：
  1. 通过 `ENABLE_ATOMIC_QUOTA=false` 关闭新配额逻辑（短期缓解）。
  2. `/api/conversations` 恢复旧逻辑前需保留参数校验，避免再次开放 DoS。
  3. 前端回滚保留 `useModelState` 新接口，必要时仅恢复引用方式。
- 灰度策略：先对内部团队启用 10%，监控 30 分钟后逐步放量。

## 七、沟通与依赖
- 产品：确认模型切换体验与 UI 提示文案。
- DBA：确认事务隔离级别、索引是否满足配额更新。
- SRE：设置监控、告警，以及上线窗口。
- 安全：评估速率限制规则是否影响合法用户。
- 文档：同步更新 `/docs/security/quota.md`、Release Note。

## 八、进度日志
- [x] 2025-09-29 15:12 更新安全修复计划文档，补充进度字段与验证标准（记录人：Codex AI）。
- [x] 2025-09-29 16:00 新增测试限制及阻断上线说明，整理最新洞察（记录人：Codex AI）。
- [ ] 2025-09-30 10:00 Phase 1 开发任务启动会议（记录人：待指派）。
- [ ] 2025-10-01 18:00 Phase 1 代码提交完成并进入评审（记录人：待指派）。
- [ ] 2025-10-03 12:00 Phase 3 验收与回滚演练完成（记录人：待指派）。

> 更新日志说明：请在事件完成后勾选，并补充实际产出链接或缺陷单。

## 九、附录
- 相关代码入口：`app/workspace/page.tsx`、`app/api/chat/route.ts`、`app/api/conversations/route.ts`
- 新增文件规划：`lib/security/quota-manager.ts`、`tests/api/chat/quota.test.ts`
- 监控仪表板：Grafana `Security/SLO` 面板（待创建）
- 参考脚本：`scripts/loadtest/chat_quota.ts`（待编写）

## 十、最新洞察与改进建议
- **关键洞察**：
  - 工作区模型状态在 localStorage 与 React 状态之间缺少单一事实来源，`app/workspace/page.tsx` 只读取一次快照导致新会话沿用旧模型。
  - 配额限流逻辑散落多处，缺乏原子性保障，并发场景下依赖“调用顺序正确”，容易失效。
  - `/api/chat` 的月度配额检查与持久化分离，多个并发请求能同时通过；`/api/conversations` 缺少请求上限，容易拖垮后端。
- **Linus 式方案**：
  1. 将模型状态收束为单一来源：统一使用 `useModelState` 的 setter/订阅，删除只读 `useState`。
  2. 将配额校验改为数据库事务中的条件更新，或使用 `UsageStats` 表进行原子计数。
  3. 为会话列表 API 设置硬性上限与白名单参数，默认 `limit<=50`，`includeMessages` 自带独立限制，拒绝超量请求。
  4. 修复后对 `/api/chat` 进行并发压测、对 `/api/conversations` 做高并发拉取，验证不再突破或拖垮服务。
- **品味评分**：凑合——思路务实，但关键路径缺乏稳健性，需要补齐原子性与限流控制。
- **致命问题定位**：
  - `app/workspace/page.tsx:57` / `app/workspace/page.tsx:145` / `app/workspace/page.tsx:171`：`const [selectedModel] = useState(...)` 仅获取初始模型，新会话始终使用旧值。
  - `app/api/chat/route.ts:62-119`：月度 token 限额检查在事务外完成，多个并发请求共享旧值，导致配额被突破。
  - `app/api/conversations/route.ts:24-47`：`limit` 与 `includeMessages` 缺少上限，恶意请求可一次取万级数据，触发 DoS。
- **改进方向**：
  - 使用真正响应式的模型状态（复用 `useModelState` setter/订阅或监听 `storage` 事件）。
  - 将 `/api/chat` 配额检查改成原子操作：在数据库事务中完成读写，或使用 `updateMany` 条件更新一次扣减。
  - 为 `/api/conversations` 增加硬性参数限制、错误返回及分页校验，防止 Prisma 查询被滥用。
