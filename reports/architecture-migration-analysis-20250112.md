# 创意中心架构迁移深度调研报告

> **调研日期**: 2025-01-12  
> **调研范围**: Schema变更、代码适配、生产影响、推进方案  
> **结论**: ⚠️ **迁移未完成，存在严重的Schema不一致问题**

---

## 📊 核心发现

### 🔴 关键问题：Schema不一致

**实际数据库状态（SQLite dev.db）**:
```sql
-- ❌ 新字段不存在
targetSequence: null (字段不存在于表中)
appendPrompt: null (字段不存在于表中)
copyCount: undefined (只能通过_count.copies获取)

-- ✅ 旧字段可能仍存在（SQLite不支持DROP COLUMN）
metadata: 可能存在但TypeScript已禁止访问
statusVersion: 可能存在但TypeScript已禁止访问
```

**Prisma Schema定义（schema.prisma）**:
```prisma
model CreativeBatch {
  targetSequence Int? // ✅ 已定义
  appendPrompt String? // ✅ 已定义
  // ❌ metadata 已删除
  // ❌ statusVersion 已删除
  // ❌ copyCount 未定义（计算字段）
}
```

**前端/API代码期望**:
```typescript
// ✅ 前端已更新为使用新字段
batch.targetSequence // 期望存在
batch.appendPrompt // 期望存在
batch.copyCount // 期望从 _count.copies 获取
```

---

## 🔍 详细技术分析

### 1. 数据库迁移状态

#### 迁移文件存在
```
✅ prisma/migrations/20250112_remove_redundant_fields/migration.sql
✅ 包含 ADD COLUMN targetSequence 和 appendPrompt 语句
```

#### 但迁移未应用到开发数据库
```bash
# 实际检查结果
$ npx tsx scripts/check-db-schema.ts
📊 批次总数: 3
🔧 新字段状态:
  - targetSequence: ❌ 缺失
  - appendPrompt: ❌ 缺失
  - copyCount: ❌ 缺失 (预期，是计算字段)
```

**原因分析**:
1. ❌ 迁移SQL文件已创建但未执行 `pnpm db:push` 或 `pnpm db:migrate`
2. ❌ SQLite的 `ALTER TABLE` 限制可能导致部分语句跳过（IF NOT EXISTS）
3. ⚠️ Prisma Client与数据库Schema脱节

---

### 2. 代码适配完成度分析

#### ✅ 已完成的适配（前端/API层）

**API响应构造**:
```typescript
// app/api/creative/batches/route.ts:211
copyCount: batch._count.copies  // ✅ 使用计算方式
targetSequence: batch.targetSequence  // ✅ 访问新字段
```

**前端组件**:
```typescript
// components/creative/batch-info-card.tsx:17
targetSequence: number | null  // ✅ 接口定义正确
appendPrompt: string | null    // ✅ 未实际使用但预留

// components/creative/copy-regenerate-dialog.tsx:39
const [appendPrompt, setAppendPrompt] = useState('')  // ✅ 支持用户输入
```

**SSE实时推送**:
```typescript
// hooks/use-batch-status-sse.ts
// ✅ 已改用 updatedAt 替代 statusVersion 去重
```

#### ❌ 未完成的适配

**数据库Schema同步**:
```bash
# 需要执行但未执行
pnpm db:push  # 或 pnpm db:migrate
```

**历史数据回填**（如有必要）:
```typescript
// scripts/backfill-batch-fields.ts
// ⚠️ 脚本存在但因metadata字段已删除无法迁移历史数据
```

---

### 3. 生产环境影响评估

#### 🔴 高风险项

**1. API运行时错误风险**
```typescript
// 当数据库缺少字段时,查询会返回 undefined
batch.targetSequence  // 返回 undefined 而非 null
batch.appendPrompt    // 返回 undefined 而非 null

// ⚠️ 前端类型检查通过,但运行时可能出现 undefined !== null 的逻辑错误
if (batch.targetSequence) {
  // 永远不会进入（undefined 是 falsy）
}
```

**2. Worker生成逻辑错误**
```typescript
// lib/workers/creative-batch-worker.ts
// 如果 appendPrompt 字段不存在于数据库:
const { appendPrompt } = batch  // undefined
if (appendPrompt) {
  userPrompt += `\n\n${appendPrompt}`  // 永远不会执行
}
```

**3. SSE事件推送数据不完整**
```typescript
// app/api/creative/batches/[batchId]/events/route.ts:109
copyCount: currentBatch._count.copies,  // ✅ 可用（计算字段）
targetSequence: currentBatch.targetSequence,  // ❌ undefined
```

#### ⚠️ 中风险项

**1. SQLite环境限制**
- SQLite不支持 `DROP COLUMN`,旧字段(metadata/statusVersion)可能仍占用存储
- 但TypeScript已禁止访问,不会造成功能问题,仅浪费空间

**2. 测试覆盖不足**
```bash
# 虽然测试通过,但测试环境可能与开发环境不一致
pnpm test:run  # 18/18 passed
# 测试可能使用内存数据库或mock,未发现Schema不一致
```

#### ✅ 低风险项

**1. TypeScript类型安全已就位**
- Schema定义与代码接口匹配
- 编译时能捕获大部分错误

**2. 向后兼容性设计良好**
- `targetSequence: Int?` 允许 null,不强制所有批次必填
- `appendPrompt: String?` 同样可选

---

## 📋 现有数据分析

### 开发环境数据快照

```json
{
  "totalBatches": 3,
  "sampleBatch": {
    "id": "cmglogbuw0006wt8cgzxn5gru",
    "status": "FAILED",
    "targetSequence": null,
    "appendPrompt": null,
    "copyCount": 0,  // ❌ 实际未作为字段存储
    "_count": { "copies": 0 },  // ✅ 需要用这个
    "errorMessage": "The table `main.creative_copies_old` does not exist"
  }
}
```

**关键发现**:
1. ✅ 数据库有3个批次,均为失败状态（非阻塞,测试数据）
2. ❌ 所有批次的 `targetSequence` 和 `appendPrompt` 为 null（因字段不存在）
3. ⚠️ 有Prisma迁移相关错误（`creative_copies_old` 表不存在）

---

## 🎯 根因分析

### 问题根源：迁移流程断裂

**预期流程**:
```
1. 更新 schema.prisma ✅
2. 运行 pnpm db:generate ✅ (生成Prisma Client)
3. 运行 pnpm db:push ❌ (同步到数据库 - 未执行!)
4. 运行测试验证 ✅ (通过但未覆盖Schema一致性)
5. 更新业务代码 ✅
```

**实际情况**:
- Step 3 被跳过,导致代码与数据库脱节
- 测试通过是因为测试环境独立同步或使用mock

### 为何测试没有发现问题

**测试环境的Schema同步机制**:
```typescript
// vitest.config.ts 或测试设置中可能有:
beforeAll(async () => {
  await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS ...`
  // 或者使用内存SQLite + db:push
})
```

**生产代码直接连接的是 `prisma/dev.db`**:
- 这个文件的Schema过时
- 需要手动同步

---

## 💡 推进方案

### 🚀 方案A: 立即修复（推荐）

**适用场景**: 开发环境,数据可丢弃

**步骤**:
```bash
# 1. 备份现有数据库
cp prisma/dev.db prisma/dev.db.backup-20250112

# 2. 重置数据库并同步最新Schema
pnpm db:push --force-reset

# 3. 或者安全同步（保留数据但SQLite限制多）
pnpm db:push --accept-data-loss

# 4. 验证Schema
npx tsx scripts/check-db-schema.ts

# 5. 创建测试数据
npx tsx scripts/create-test-batch.ts

# 6. 运行完整测试
pnpm check
```

**优点**:
- ✅ 彻底解决Schema不一致
- ✅ 清理残留的旧字段
- ✅ 10分钟内完成

**缺点**:
- ⚠️ 丢失开发环境现有的3个批次数据（可接受,都是失败状态）

---

### 🔧 方案B: 渐进式迁移（保守）

**适用场景**: 生产环境或有重要历史数据

**步骤**:

#### Phase 1: Schema同步（零停机）
```bash
# 1. 添加新字段（不删除旧字段）
pnpm db:push

# 2. 验证新字段已创建
npx tsx scripts/check-db-schema.ts

# 3. 回填历史数据（如需要）
npx tsx scripts/backfill-batch-fields.ts --dry-run
npx tsx scripts/backfill-batch-fields.ts
```

#### Phase 2: 数据验证（观察期）
```bash
# 运行集成测试
pnpm test:e2e

# 手动测试关键路径:
# - 创建新批次
# - 单条再生成（带appendPrompt）
# - 整批再生成
# - SSE实时推送
```

#### Phase 3: 清理旧字段（PostgreSQL生产环境）
```sql
-- ⚠️ SQLite跳过此步骤（不支持DROP COLUMN）

-- PostgreSQL:
ALTER TABLE "creative_batches" DROP COLUMN IF EXISTS "metadata";
ALTER TABLE "creative_batches" DROP COLUMN IF EXISTS "statusVersion";
```

**优点**:
- ✅ 保留历史数据
- ✅ 可逐步回滚
- ✅ 适合生产环境

**缺点**:
- ⏳ 需要3-5个工作日完成
- 📝 需要更多文档和监控

---

### 🆚 方案对比

| 维度 | 方案A（立即修复） | 方案B（渐进迁移） |
|------|-------------------|-------------------|
| **耗时** | 10分钟 | 3-5天 |
| **数据丢失风险** | ⚠️ 高（开发环境可接受） | ✅ 低 |
| **操作复杂度** | ✅ 简单 | ⚠️ 复杂 |
| **适用环境** | 开发/测试 | 生产 |
| **回滚难度** | ✅ 简单（恢复备份） | ⚠️ 中等 |
| **Schema一致性** | ✅ 完美 | ⚠️ 阶段性不一致 |

---

## 📝 详细执行计划

### 开发环境（立即执行）- 方案A

```bash
# ===== Step 1: 数据备份 =====
cp prisma/dev.db prisma/dev.db.backup-$(date +%Y%m%d-%H%M%S)

# ===== Step 2: 重置并同步Schema =====
pnpm db:push --force-reset
# 输出应包含:
# ✔ Generated Prisma Client
# ✔ Database reset successful

# ===== Step 3: 验证Schema =====
npx tsx scripts/check-db-schema.ts
# 预期输出:
# 🔧 新字段状态:
#   - targetSequence: ✅ 存在
#   - appendPrompt: ✅ 存在

# ===== Step 4: 创建测试数据 =====
# 如果有测试数据创建脚本
npx tsx scripts/create-test-batch.ts

# 或手动通过API创建
curl -X POST http://localhost:3007/api/creative/batches \
  -H "Content-Type: application/json" \
  -d '{"merchantId":"xxx","assets":[...]}'

# ===== Step 5: 完整测试 =====
pnpm check
# 应输出:
# ✓ ESLint检查通过
# ✓ TypeScript编译通过
# ✓ 单元测试通过

# ===== Step 6: 手动UI验证 =====
pnpm dev
# 访问 http://localhost:3007/creative
# 测试:
# 1. 创建批次
# 2. 查看批次详情（targetSequence/copyCount显示）
# 3. 单条再生成（输入appendPrompt）
# 4. 整批再生成
# 5. SSE实时更新
```

---

### 生产环境（分阶段执行）- 方案B

#### 🔵 Phase 1: 准备阶段（1-2天）

**1.1 环境检查**
```bash
# 检查数据库类型
echo $DATABASE_URL
# 如果是PostgreSQL: ✅ 支持完整迁移
# 如果是SQLite: ⚠️ 无法删除旧字段

# 检查现有数据量
psql $DATABASE_URL -c "
  SELECT 
    COUNT(*) as total_batches,
    COUNT(*) FILTER (WHERE metadata IS NOT NULL) as has_metadata,
    COUNT(*) FILTER (WHERE status IN ('COMPLETED','PARTIAL_SUCCESS')) as successful
  FROM creative_batches;
"
```

**1.2 数据审计**
```bash
# 导出所有使用metadata的批次
npx tsx scripts/export-metadata-batches.ts > reports/metadata-audit.json

# 分析metadata内容
cat reports/metadata-audit.json | jq '.[] | .metadata' | sort | uniq
# 确认是否有业务关键数据需要迁移
```

**1.3 Staging环境全流程测试**
```bash
# 在staging执行完整迁移
pnpm db:migrate deploy
npx tsx scripts/backfill-batch-fields.ts

# 运行回归测试
pnpm test:e2e

# 人工验证
# - 旧批次数据完整性
# - 新批次创建流程
# - API响应格式
```

#### 🟢 Phase 2: 生产部署（半天）

**2.1 数据库备份**
```bash
# PostgreSQL
pg_dump -U postgres -d zhidian_prod -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# 验证备份
pg_restore --list backup_*.dump | head -n 20
```

**2.2 应用迁移**
```bash
# 方式1: Prisma自动迁移（推荐）
pnpm db:migrate deploy

# 方式2: 手动执行SQL（高级）
psql $DATABASE_URL < prisma/migrations/20250112_remove_redundant_fields/migration.sql
```

**2.3 数据回填**
```bash
# 干运行验证
npx tsx scripts/backfill-batch-fields.ts --dry-run | tee reports/backfill-dryrun.log

# 实际执行
npx tsx scripts/backfill-batch-fields.ts | tee reports/backfill-production.log

# 验证结果
tail -n 50 reports/backfill-production.log
```

**2.4 应用部署**
```bash
# 重启应用服务
pm2 reload zhidian-api

# 监控日志
pm2 logs zhidian-api --lines 100
```

#### 🟡 Phase 3: 验证和监控（1-2天）

**3.1 烟雾测试**
```bash
# API健康检查
curl http://localhost:3007/api/creative/batches?merchantId=xxx

# 验证关键字段
curl http://localhost:3007/api/creative/batches?merchantId=xxx | jq '.[0] | {targetSequence, appendPrompt, copyCount}'
```

**3.2 监控指标**
```
关注:
- 批次创建成功率 (期望 >95%)
- Worker生成成功率 (期望 >90%)
- API错误率 (期望 <1%)
- SSE连接稳定性
```

**3.3 回滚预案（如出现问题）**
```bash
# 1. 回滚应用代码
git revert <commit-hash>
pm2 reload zhidian-api

# 2. 回滚数据库（不推荐,数据会丢失）
pg_restore -U postgres -d zhidian_prod -c backup_*.dump

# 3. 或仅回滚Schema（保留新数据）
psql $DATABASE_URL < prisma/migrations/20250112_remove_redundant_fields/rollback.sql
```

---

## 🛡️ 风险缓解措施

### 1. 数据完整性保护

**备份策略**:
```bash
# 开发环境 - 每次迁移前
cp prisma/dev.db "prisma/dev.db.backup-$(date +%Y%m%d-%H%M%S)"

# 生产环境 - 自动化每日备份
0 2 * * * pg_dump -U postgres -d zhidian_prod -F c -f /backups/daily_$(date +\%Y\%m\%d).dump

# 迁移前额外备份
pg_dump -U postgres -d zhidian_prod -F c -f /backups/before_migration_$(date +\%Y\%m\%d).dump
```

### 2. 监控告警

**关键指标**:
```typescript
// 在 API 中添加指标收集
if (!batch.targetSequence && batch.parentBatchId) {
  logger.warn('Missing targetSequence for regeneration batch', { batchId: batch.id })
  // 发送告警到 Sentry/Datadog
}

// 监控copyCount计算失败
if (typeof batch._count?.copies !== 'number') {
  logger.error('copyCount calculation failed', { batchId: batch.id })
}
```

### 3. 降级开关

**功能开关**:
```typescript
// .env.local
FEATURE_USE_NEW_BATCH_FIELDS=true

// 代码中
if (process.env.FEATURE_USE_NEW_BATCH_FIELDS === 'true') {
  // 使用 targetSequence/appendPrompt
} else {
  // 回退到 metadata（如果字段仍存在）
}
```

---

## 📚 相关文档更新

### 需要更新的文档

1. ✅ `MIGRATION_GUIDE.md` - 已存在,需补充实际执行记录
2. ✅ `CREATIVE_CENTER_ARCHITECTURE_FIX.md` - 已存在,架构决策记录
3. ❌ `README.md` - 需添加迁移步骤到"首次设置"章节
4. ❌ `docs/api/creative-batches.md` - 需更新API响应示例
5. ❌ `.env.example` - 需添加功能开关说明

### 文档待办

```markdown
## README.md 补充内容

### 创意中心首次设置（新增）

如果你从旧版本升级，需要同步数据库Schema:

\`\`\`bash
# 1. 备份数据（生产环境）
pg_dump -U postgres -d your_db > backup.sql

# 2. 同步Schema
pnpm db:push  # 开发环境
pnpm db:migrate deploy  # 生产环境

# 3. 验证
npx tsx scripts/check-db-schema.ts
\`\`\`
```

---

## ✅ 推荐行动方案

### 立即执行（今天）

**开发环境**:
```bash
# 1小时内完成
pnpm db:push --force-reset
npx tsx scripts/check-db-schema.ts
pnpm check
# 手动UI验证
```

**理由**:
- ✅ 开发数据库仅3个失败批次,无价值数据
- ✅ 立即修复能避免后续Bug累积
- ✅ 为生产环境迁移提供完整测试环境

### 本周内完成（3天）

**Staging环境**:
```bash
# Day 1: 准备和测试
- 审计现有数据
- 执行迁移脚本
- 回归测试

# Day 2: 验证和文档
- 完整功能验证
- 更新运维文档
- 培训团队成员

# Day 3: 生产准备
- 制定部署计划
- 准备回滚脚本
- 通知相关方
```

### 下周执行（生产环境）

**选择低流量时段**:
```
建议: 周二或周三凌晨2-4点
避免: 周一（可能有积压）、周五（影响周末）
```

---

## 🎓 经验教训

### 本次迁移暴露的流程问题

1. **Schema变更未强制验证**
   - 改进: 在CI/CD中添加 `pnpm db:push --dry-run` 检查
   - 如果Schema不一致,阻止合并PR

2. **测试环境独立性过强**
   - 改进: 测试应连接真实的 `prisma/dev.db`
   - 或在测试前显式检查Schema版本

3. **缺少数据库版本管理**
   - 改进: 在SystemConfig表添加 `schema_version` 字段
   - 应用启动时检查版本匹配

### 建议的CI/CD增强

```yaml
# .github/workflows/pr-check.yml
- name: Check Prisma Schema Sync
  run: |
    pnpm db:generate
    pnpm db:push --dry-run || {
      echo "❌ Prisma schema不同步,运行: pnpm db:push"
      exit 1
    }

- name: Verify Database Schema
  run: |
    npx tsx scripts/check-db-schema.ts
    # 检查关键字段是否存在
```

---

## 📞 支持和联系

如果在迁移过程中遇到问题:

1. **查看日志**: `reports/migration-verification-20250112.md`
2. **运行诊断**: `npx tsx scripts/check-db-schema.ts`
3. **回滚方案**: 见 `MIGRATION_GUIDE.md` 第6节

---

## 附录

### A. 相关命令速查

```bash
# Schema管理
pnpm db:generate          # 生成Prisma Client
pnpm db:push              # 同步Schema（开发）
pnpm db:migrate deploy    # 应用迁移（生产）
pnpm db:studio            # 可视化管理

# 验证
npx tsx scripts/check-db-schema.ts
pnpm type-check
pnpm test:run

# 回滚
cp prisma/dev.db.backup-* prisma/dev.db
```

### B. 关键文件清单

```
架构文档:
├── CREATIVE_CENTER_ARCHITECTURE_FIX.md  (架构决策)
├── MIGRATION_GUIDE.md                   (迁移指南)
└── reports/
    ├── migration-verification-20250112.md  (自动化验证)
    └── architecture-migration-analysis-20250112.md  (本文档)

Schema:
├── prisma/schema.prisma                 (模型定义)
└── prisma/migrations/
    └── 20250112_remove_redundant_fields/  (迁移SQL)

脚本:
├── scripts/check-db-schema.ts           (Schema检查)
├── scripts/backfill-batch-fields.ts     (数据回填)
└── scripts/create-test-batch.ts         (测试数据)

代码:
├── app/api/creative/batches/            (API层)
├── components/creative/                 (UI层)
├── lib/repositories/creative-batch-*    (仓储层)
└── lib/workers/creative-batch-worker.ts (Worker层)
```

---

**报告结束** | 生成时间: 2025-01-12 14:30:00 | 调研人: Claude (Droid AI)
