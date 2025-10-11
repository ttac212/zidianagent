# 批量文案生成模块方案说明

## 背景与目标
- 为每个商家提供“批量文案生成”独立模块，支持基于分析报告、提示词、选题/对标文案等资料快速生成 5 条短视频文案。
- 生成结果需默认入库，支持复制、编辑、版本追踪、批次历史回看与单条/整批再生成。
- 资料来源可维护多版本，并允许引用附件文本（包含 OCR/摘要结果）而不会污染模型输入。

## 功能需求摘要
- **资料管理**：商家报告、提示词、附件按版本管理；保持每类仅一个活动版本，可追溯历史。
- **生成流程**：选择商家 → 选定报告/提示版本 → 勾选附件/选题/对标文案 → 发起批次 → 异步生成 5 条 Markdown 文案。
- **结果使用**：查看 Markdown 内容、复制、人工编辑、回溯版本、单条或整批再生；历史批次可归档、导出。
- **异常处理**：模型输出违规/为空时提示用户调整输入材料，并记录到异常表供排查。
- **限制**：首版不开放生成参数调节（温度/语气等），附件仅支持文本。

## 系统架构概览
1. **前端页面**
   - 左侧资料面板：商家当前报告/提示版本、历史版本选择、附件/选题管理（含启用开关）。
   - 右侧批次视图：当前批次状态、5 条文案卡片（Markdown 展示、复制、二次编辑、再生按钮）、历史批次列表。
   - 状态更新通过 SSE（可回退轮询）同步。
2. **后端 API / Server Action**
   - 创建批次、列出批次、获取批次详情、更新文案、单条/整批再生、报告/提示/附件 CRUD。
   - 所有批次生成请求进入任务队列，由 Worker 调用 Claude 4.5 并写入数据库。
3. **任务 Worker**
   - 处理批次生成与单条再生，统一记录 token 消耗、异常事件、状态变更。
4. **日志与监控**
   - `generation_exceptions` 记录失败详情；复用现有 token 使用统计或后续扩展仪表盘。

## 数据模型设计

### merchant_prompt_assets
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | cuid | 主键 |
| merchant_id | FK → merchants.id | 商家 |
| type | `REPORT \| PROMPT \| ATTACHMENT` | 资产类型 |
| title | string | 名称 |
| version | int | 版本号（同商家+类型唯一） |
| parent_id | FK → self (ON DELETE SET NULL) | 前一版本 |
| content | text? | 仅 REPORT/PROMPT 允许非空 |
| reference_asset_id | FK → reference_assets.id? | 仅 ATTACHMENT 允许非空 |
| metadata | JSON | 额外信息（附件引用等） |
| is_active | boolean default false | 活动版本标记 |
| created_by | string | 创建人 |
| created_at | DateTime default now | 创建时间 |
| updated_at | DateTime @updatedAt | 更新时间 |

约束：
- `CHECK`：`(type IN ('REPORT','PROMPT') AND content IS NOT NULL AND reference_asset_id IS NULL) OR (type = 'ATTACHMENT' AND content IS NULL AND reference_asset_id IS NOT NULL)`
- `UNIQUE (merchant_id, type, version)`
- **部分唯一**：`CREATE UNIQUE INDEX uniq_active_prompt_asset ON merchant_prompt_assets(merchant_id, type) WHERE is_active = true`

### reference_assets
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | cuid | 主键 |
| merchant_id | FK → merchants.id |
| kind | `TOPIC \| BENCHMARK \| RAW_ATTACHMENT` |
| source_meta | JSON | 来源信息 |
| original_text | text | 原始文本 |
| ocr_text | text? | OCR 结果 |
| summary | text? | 摘要文本 |
| is_default_enabled | boolean default true | 默认勾选 |
| created_by | string |
| created_at | DateTime |
| updated_at | DateTime |

### merchant_members
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | cuid | 主键 |
| merchant_id | FK → merchants.id |
| user_id | FK → users.id |
| role | `OWNER \| EDITOR \| VIEWER` |
| created_at | DateTime default now |
| updated_at | DateTime @updatedAt |

约束：
- `CHECK`：`role` 必须在允许范围
- `UNIQUE (merchant_id, user_id)` 限制单商家单成员唯一
- 索引 `merchant_member_user_idx` 支持按用户查询可访问商家

### creative_batches
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | cuid |
| merchant_id | FK → merchants.id |
| parent_batch_id | FK → self (ON DELETE SET NULL) | 整批再生链路 |
| status | `QUEUED \| RUNNING \| SUCCEEDED \| PARTIAL_SUCCESS \| FAILED \| ARCHIVED` |
| model_id | string default `claude-sonnet-4-5-20250929` |
| status_version | int default 1 | 状态版本号 |
| started_at | DateTime? |
| completed_at | DateTime? |
| triggered_by | string |
| error_code | string? |
| error_message | string? |
| token_usage | JSON? |
| metadata | JSON? | 批次上下文（再生类型、补充提示等） |
| created_at | DateTime default now |
| updated_at | DateTime @updatedAt |
| archived_at | DateTime? |

索引：`(merchant_id, created_at DESC)`、`(status, created_at DESC)`

状态变更需使用 `UPDATE ... SET status = ?, status_version = status_version + 1, updated_at = CURRENT_TIMESTAMP`.

### creative_batch_assets
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | cuid |
| batch_id | FK → creative_batches.id |
| role | `REPORT \| PROMPT \| ATTACHMENT \| TOPIC \| BENCHMARK` |
| prompt_asset_id | FK → merchant_prompt_assets.id? |
| reference_asset_id | FK → reference_assets.id? |
| is_enabled | boolean default true |
| sort_order | int default 0 |

约束：
- `CHECK ( (prompt_asset_id IS NOT NULL) <> (reference_asset_id IS NOT NULL) )`
- `CHECK ( (role IN ('REPORT','PROMPT') AND prompt_asset_id IS NOT NULL) OR (role IN ('ATTACHMENT','TOPIC','BENCHMARK') AND reference_asset_id IS NOT NULL) )`
- 部分唯一：  
  - `CREATE UNIQUE INDEX uniq_batch_report ON creative_batch_assets(batch_id) WHERE role = 'REPORT'`  
  - `CREATE UNIQUE INDEX uniq_batch_prompt ON creative_batch_assets(batch_id) WHERE role = 'PROMPT'`
- 普通索引：`(batch_id, role, sort_order)`

### creative_copies
| 字段 | 类型 |
| --- | --- |
| id | cuid |
| batch_id | FK → creative_batches.id |
| sequence | int (1-5) CHECK 约束已在数据库层强制 |
| markdown_content | text |
| raw_model_output | JSON? |
| user_override | text? |
| state | `DRAFT \| APPROVED \| REJECTED` |
| regenerated_from_id | FK → self (ON DELETE SET NULL) |
| edited_by | string? |
| edited_at | DateTime? |
| content_version | int default 1 |
| created_at | DateTime default now |
| updated_at | DateTime @updatedAt |

索引：`(batch_id, sequence)`、`(regenerated_from_id)`

### creative_copy_revisions
- `copy_id` FK → creative_copies.id
- `version` int，`UNIQUE(copy_id, version)`
- `content` text，`source` (`MODEL`/`USER`)，`note`，`created_by`，`created_at`

### generation_exceptions
- `batch_id` FK → creative_batches.id
- `copy_id` FK → creative_copies.id (可空)
- `error_code`、`error_detail` JSON、`request_payload`、`response_payload`
- `status` (`OPEN`/`ACKNOWLEDGED`/`RESOLVED`)
- `created_at`、`updated_at`
- 索引：`(batch_id, status)`

## 版本号生成策略
1. 在版本创建服务中开启 Prisma 事务。
2. 查询当前 `(merchant_id, type)` 的最大版本：`SELECT COALESCE(MAX(version),0)+1`（SQLite 通过 `prisma.$queryRaw` 实现）。
3. 尝试插入新资产记录（携带 `version` 和潜在 `is_active`）。
4. 若触发唯一约束冲突（P2002），递增版本号并重试，直至成功。
5. 如需将新版本设为活动版本，同一事务内执行：`UPDATE merchant_prompt_assets SET is_active = false WHERE merchant_id=? AND type=? AND is_active = true`，再更新新记录 `is_active = true`。
6. 事务提交后返回最终版本值。
   - 实现层设置默认重试 5 次并记录失败日志，如有需要可扩展 `maxRetries` 覆盖。

未来迁移到 Postgres 时可改为 `GENERATED ALWAYS AS IDENTITY` + `MERCHANT_ID,TYPE` 分区序列，业务逻辑保持兼容。

## 批次状态更新策略
- 所有状态更新通过 `updateBatchStatus` 服务封装，内容：
  1. 读取当前状态（可选调试记录）。
  2. 执行 `UPDATE creative_batches SET status = ?, status_version = status_version + 1, started_at/completed_at = ?, updated_at = CURRENT_TIMESTAMP, error_code = ?, error_message = ?, token_usage = ? WHERE id = ?`.
  3. 返回新的 `status_version` 提供给 SSE。
- 保证 `status_version` 单调递增，前端可用 `(batchId, statusVersion)` 去重。

## API & 队列契约

### 创建批次 `POST /api/creative/batches`
请求体示例：
```json
{
  "merchantId": "mch_001",
  "assets": [
    { "role": "REPORT", "assetId": "mpr_1001" },
    { "role": "PROMPT", "assetId": "mpr_2006" },
    { "role": "ATTACHMENT", "assetId": "ref_9001", "enabled": true, "sortOrder": 1 },
    { "role": "TOPIC", "assetId": "ref_9002", "enabled": true },
    { "role": "BENCHMARK", "assetId": "ref_9003", "enabled": false }
  ]
}
```
响应示例：
```json
{
  "batchId": "cbt_123",
  "status": "QUEUED",
  "statusVersion": 1,
  "createdAt": "2024-06-30T12:00:00.000Z"
}
```

服务逻辑：
1. 校验商家与资产关系、检查活动版本。
2. 创建 `creative_batches`（status=QUEUED）。
3. 写入 `creative_batch_assets`，`is_enabled` 未指定时默认 true；若 `enabled=false` 也需要写记录供历史回放。
4. 推送任务 `{ batchId }` 到队列。

### Worker 输入
```json
{
  "batchId": "cbt_123",
  "merchantId": "mch_001",
  "materials": {
    "report": { "id": "mpr_1001", "content": "..." },
    "prompt": { "id": "mpr_2006", "content": "..." },
    "attachments": [
      { "id": "ref_9001", "text": "...", "summary": "..." }
    ],
    "topics": [...],
    "benchmarks": [...]
  }
}
```

### Worker 输出
- 将生成的文案插入 `creative_copies`（`content_version=1`）、写 `creative_copy_revisions`（source=MODEL）。
- 根据生成数量决定批次状态：
  - **5 条**：`SUCCEEDED`
  - **1-4 条**：`PARTIAL_SUCCESS`（部分成功，保存已生成内容）
  - **0 条**：`FAILED`
- 填充 `token_usage`。
- 若模型输出不足 5 条，在 `generation_exceptions` 记录详情供调试，但**不影响已生成文案的可用性**。

**失败策略原则**：永远不要因为"少于 5 条"就丢弃已生成的内容。用户拿到 3 条文案总比什么都没有好。

### 单条再生成 `POST /api/creative/copies/{id}/regenerate`
```json
{
  "appendPrompt": "强调优惠信息",
  "editedContent": "用户刚编辑版本",
  "notes": "希望更口语化"
}
```
- 服务创建 `creative_copies` 新行（`regenerated_from_id` 指向原 copy），复制原序号与资产信息。
- 写入 revision（source=USER/NOTE）。
- 触发单条 worker 任务，完成后 SSE 通知。

### 整批再生成 `POST /api/creative/batches/{id}/regenerate`
- 新建批次并设置 `parent_batch_id`，复制上一批启用的资产状态（允许前端修改后提交）。
  - 校验 `parent_batch_id` 必须属于同一商家，否则直接拒绝，避免跨商家串联。
  - 将单条再生的 `appendPrompt`、来源 copy 等信息写入 `creative_batches.metadata`，供后续 worker 拉取。

### 文案级接口 `/api/creative/copies/{id}`
- `GET`：返回文案详情、所属批次状态、全量版本历史；要求调用者具备商家成员身份或管理员角色。
- `PUT`：支持更新 `content` 与 `state`，命中内容时自动生成 `creative_copy_revisions` 记录并递增 `content_version`；请求体可附带 `note`。
- `POST`：单条再生入口，复用原批次资产生成新批次，且将以下上下文写入 `creative_batches.metadata`：
  ```json
  {
    "source": "copy-regenerate",
    "parentCopyId": "ccp_001",
    "appendPrompt": "强调优惠信息",
    "editedContentProvided": true,
    "note": "用户手动修改后再生"
  }
  ```
- 新批次与文案建立 lineage（`parent_batch_id`、`regenerated_from_id`），worker 应读取 `metadata.appendPrompt` 追加到模型提示，SSE 推送也需携带新的 `batchId`。

## SSE / 事件格式
- **批次状态**
```json
{
  "type": "batch-status",
  "batchId": "cbt_123",
  "status": "SUCCEEDED",
  "statusVersion": 3,
  "timestamp": "2024-06-30T12:01:45.302Z",
  "tokenUsage": { "prompt": 5400, "completion": 6100 },
  "errorCode": null
}
```
- **文案更新**
```json
{
  "type": "copy-update",
  "batchId": "cbt_123",
  "copyId": "ccp_01",
  "sequence": 1,
  "state": "DRAFT",
  "contentVersion": 2,
  "timestamp": "2024-06-30T12:10:05.900Z",
  "regeneratedFromId": "ccp_09"
}
```
- 前端通过 `statusVersion` / `contentVersion` 去重，轮询路径重用同一 JSON 结构。

## 并发与测试考虑
- 并发创建版本：使用 Vitest 编写单元测试模拟两个任务同时创建同类资产，验证乐观重试逻辑不会抛出最终错误。
- 并发状态更新：使用 Vitest 模拟多个 Worker 更新同批次的顺序，确认 `status_version` 单调递增且 `updated_at` 正确。
- 数据约束测试：尝试插入不合法数据（缺少 content、双源引用、重复 REPORT/PROMPT）确保数据库层拒绝。
- SQLite / Postgres 兼容：迁移脚本需在 `schema.prisma` 注释 raw SQL 同时在 `migrations/*/steps.sql` 中提供 `CREATE UNIQUE INDEX ... WHERE ...`/`CHECK` 语句；SQLite 需要 `partial index` 支持（已存在，注意语法）。

## 实施步骤
### 进度快照（2025-01-15）
- [x] 数据库迁移（`20240701_add_batch_module/` 正向+回滚脚本）
- [x] Prisma Client schema & 关系修正（含 `PromptAssetAttachment` 双向关联）
- [x] 商家成员表 `merchant_members` + 访问控制 helper
- [x] 仓储层：版本乐观重试、批次事务化、父批校验
- [x] Vitest 并发/约束测试：`tests/batch-repositories.test.ts`
- [x] **数据完整性修复**：
  - [x] 添加 `creative_copies.sequence` CHECK 约束 (1-5)，迁移脚本 `20250115_add_sequence_constraint/`
  - [x] 引入 `PARTIAL_SUCCESS` 状态，修复 Worker 失败策略
  - [x] Schema 更新并添加约束注释
- [x] API / Server Actions
  - [x] 批次创建 / 列表 / 详情 / 整批再生（基于成员表完成多租户隔离）
  - [x] 单条文案再生 / 文案编辑接口
- [x] Worker 框架（`lib/workers/creative-batch-worker.ts`）
  - [x] 实现正确的失败策略（PARTIAL_SUCCESS）
  - [x] Claude API 集成（已实现并测试通过）
  - [x] 提示词构建和解析逻辑
  - [x] SSE 实时推送（已实现并测试通过）
- [x] 前端支持
  - [x] BatchStatusBadge 组件（显示 PARTIAL_SUCCESS 等状态）
  - [x] 批次列表页面（`app/creative/batches/page.tsx`）
  - [x] Badge 组件扩展（添加 success/warning 变体）
  - [x] SSE Hook（`hooks/use-batch-status-sse.ts`）- statusVersion 去重
  - [x] **P0 核心页面和组件**（2025-01-15）：
    - [x] BatchInfoCard - 批次信息卡片
    - [x] CopyCard - 文案卡片（Markdown 预览 + 操作）
    - [x] CopyEditDialog - 文案编辑对话框（双栏编辑器）
    - [x] CopyRegenerateDialog - 单条重新生成对话框
    - [x] 批次详情页面（`/creative/batches/[batchId]`）
    - [x] 单条重新生成 API（`/api/creative/copies/:copyId/regenerate`）
  - [ ] 资料管理面板（P1）
  - [ ] 版本历史查看（P1）
- [x] 运维脚本
  - [x] 商家成员基线同步（`scripts/backfill-merchant-members.ts`）
  - [x] 批次 Worker 测试（`scripts/test-batch-worker.ts`）
  - [x] SSE 推送测试（`scripts/test-batch-sse.ts`）
- [ ] 运维与清理脚本、异常面板

1. **数据库迁移**
   - 更新 `schema.prisma` 并添加 raw SQL 迁移（建议目录如 `20240701_add_batch_module/`; 包含 forward/backward SQL，明示 CHECK / 部分唯一语句）。
   - 针对 SQLite/Postgres 分别验证迁移执行，确保 rollback 脚本可用。
   - 应用 `20240703_add_batch_metadata` 迁移，向 `creative_batches` 增加 `metadata` 列，用于封装单条再生上下文（appendPrompt、parentCopyId、note 等）。
   - 运行 `scripts/backfill-merchant-members.ts`，根据历史批次触发人补齐 `merchant_members` 基线数据。
2. **数据访问层**
   - 编写 `PromptAssetRepository`、`BatchRepository`、`CopyRepository` 等，封装事务、乐观重试与状态更新。
3. **API / Server Actions**
   - 搭建创建批次、列出批次、获取详情、更新文案、再生成等接口。
4. **Worker**
   - 集成 Claude 4.5 调用、异常捕获、状态回写、SSE 推送。
5. **前端页面**
   - 构建资料面板、批次视图、文案卡片、历史列表。
6. **测试**
   - 单元测试（并发、约束、状态）、集成测试（生成流程、错误处理）、E2E（基础流程）。
7. **运维支持**
   - 提供清理脚本（归档/删除批次）、异常查看页面、调用统计埋点。

### 架构修复记录（2025-01-15）
**问题发现**：
1. `creative_copies.sequence` 缺少数据库约束，可能导致越界值（如 0、999）污染数据
2. 原设计 Worker 失败策略会因为"不足 5 条"就标记 FAILED，丢弃已生成的文案

**修复方案**：
1. 添加 CHECK 约束 `sequence >= 1 AND sequence <= 5`，通过表重建迁移实现（SQLite 限制）
2. 引入 `PARTIAL_SUCCESS` 状态：
   - 5 条 → SUCCEEDED
   - 1-4 条 → PARTIAL_SUCCESS（保存已生成内容）
   - 0 条 → FAILED
3. Worker 实现遵循"Never break userspace"原则，用户拿到部分结果总比什么都没有好

**测试验证**（2025-01-15）：
- ✅ Worker 测试通过：生成 3/5 条文案，正确标记 PARTIAL_SUCCESS
- ✅ sequence 约束验证：数据库拒绝越界值
- ✅ 异常记录：不足 5 条时记录详情但不影响已生成内容
- ✅ Token 统计：正确记录 prompt/completion tokens

**已完成的技术债**：
- ✅ Prisma Client 重新生成
- ✅ Worker Claude API 调用实现
- ✅ 前端 PARTIAL_SUCCESS 状态显示

**SSE 推送验证**（2025-01-15）：
- ✅ 状态流转：QUEUED → RUNNING → PARTIAL_SUCCESS
- ✅ statusVersion 递增：1 → 2 → 3
- ✅ 事件正确接收和去重
- ✅ 完成时自动关闭连接

**商家成员同步**：
- ✅ 脚本完成：`scripts/backfill-merchant-members.ts`
- ✅ 用户有效性验证
- ✅ 自动过滤无效关系
- 📝 生产环境运行：`npx tsx scripts/backfill-merchant-members.ts`

**剩余工作**（低优先级）：
- 资料管理界面（报告、提示词、附件 CRUD）
- 文案详情页面（查看、编辑、版本历史）
- 整批/单条再生成前端界面

### 风险与待办
- 需要补充商家成员数据的初始化/同步脚本，保障老用户能正确访问对应商家。
- 后续测试需覆盖“同商家不同成员共享访问”以及“跨商家拒绝”完整流程，包含 API 与页面端到端用例。

## 未来扩展
- 切换至 Postgres 后可使用原生 partial unique/触发器、JSONB 查询优化。
- 开放生成参数（温度、语气），在 `creative_batches` 中新增字段即可。
- 附件 OCR/摘要可支持图片/PDF 多模态；当前结构已预留 `summary` 与引用关系。
- 引入权限分级、批次导出（CSV/Markdown 打包）等增强功能。

---
此文档作为批量文案生成模块的数据与流程基线，供后续迁移脚本、API 实现、前端开发参考。*** End Patch
