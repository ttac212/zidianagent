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

### creative_batches
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | cuid |
| merchant_id | FK → merchants.id |
| parent_batch_id | FK → self (ON DELETE SET NULL) | 整批再生链路 |
| status | `QUEUED \| RUNNING \| SUCCEEDED \| FAILED \| ARCHIVED` |
| model_id | string default `claude-sonnet-4-5-20250929` |
| status_version | int default 1 | 状态版本号 |
| started_at | DateTime? |
| completed_at | DateTime? |
| triggered_by | string |
| error_code | string? |
| error_message | string? |
| token_usage | JSON? |
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
| sequence | int (1-5) |
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
- 将 5 条结果插入 `creative_copies`（`content_version=1`）、写 `creative_copy_revisions`（source=MODEL）。
- 更新批次状态为 `SUCCEEDED`，填充 `token_usage`。
- 若模型输出不足 5 条，补空位并在 `generation_exceptions` 记录异常，同时将批次标记 `FAILED`。

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
### 进度快照（2025-10-10）
- [x] 数据库迁移（`20240701_add_batch_module/` 正向+回滚脚本）
- [x] Prisma Client schema & 关系修正（含 `PromptAssetAttachment` 双向关联）
- [x] 仓储层：版本乐观重试、批次事务化、父批校验
- [x] Vitest 并发/约束测试：`tests/batch-repositories.test.ts`
- [ ] API / Server Actions（创建批次、列表、详情、再生）
- [ ] Worker 集成 & Claude 调用落地
- [ ] 前端页面（资料面板、批次视图、历史）
- [ ] 运维与清理脚本、异常面板

1. **数据库迁移**
   - 更新 `schema.prisma` 并添加 raw SQL 迁移（建议目录如 `20240701_add_batch_module/`; 包含 forward/backward SQL，明示 CHECK / 部分唯一语句）。
   - 针对 SQLite/Postgres 分别验证迁移执行，确保 rollback 脚本可用。
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

## 未来扩展
- 切换至 Postgres 后可使用原生 partial unique/触发器、JSONB 查询优化。
- 开放生成参数（温度、语气），在 `creative_batches` 中新增字段即可。
- 附件 OCR/摘要可支持图片/PDF 多模态；当前结构已预留 `summary` 与引用关系。
- 引入权限分级、批次导出（CSV/Markdown 打包）等增强功能。

---
此文档作为批量文案生成模块的数据与流程基线，供后续迁移脚本、API 实现、前端开发参考。*** End Patch
