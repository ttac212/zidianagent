# Migration: 20251118_add_version_tables_and_manual_fields

## 目的
补充缺失的版本管理表和人工修订字段

## 变更内容

### 1. 新增表
- `merchant_profile_versions` - 商家档案版本历史
- `merchant_audience_analysis_versions` - 客群分析版本历史

### 2. 新增字段
**MerchantProfile**:
- `manualBrief` (Json) - 人工校对版 Brief
- `manualNotes` (String) - 实地沟通高频问题

**MerchantAudienceAnalysis**:
- `manualMarkdown` (String) - 人工修订报告
- `manualInsights` (Json) - 结构化补充洞察

### 3. User 表字段类型调整
- SQLite 的 INTEGER 类型已支持 64 位整数（BigInt）
- 无需实际修改，保持兼容性

## 执行步骤

### 开发环境（SQLite）
```bash
# 方式1: 使用 Prisma 自动同步（推荐）
pnpm db:push

# 方式2: 手动执行 SQL
sqlite3 prisma/dev.db < prisma/migrations/20251118_add_version_tables_and_manual_fields/migration.sql
```

### 生产环境（PostgreSQL）
```bash
# 1. 生成 Prisma Client
pnpm db:generate

# 2. 执行迁移
pnpm db:migrate deploy
```

## 验证
```bash
# 检查表是否创建成功
npx tsx -e "
import { prisma } from './lib/prisma'
async function check() {
  const profileVersion = await prisma.merchantProfileVersion.findFirst()
  const audienceVersion = await prisma.merchantAudienceAnalysisVersion.findFirst()
  console.log('✅ 版本表已创建')
}
check()
"
```

## 回滚（如需）
```sql
-- 删除新增的表
DROP TABLE IF EXISTS "merchant_profile_versions";
DROP TABLE IF EXISTS "merchant_audience_analysis_versions";

-- 删除新增的字段
ALTER TABLE "merchant_profiles" DROP COLUMN IF EXISTS "manualBrief";
ALTER TABLE "merchant_profiles" DROP COLUMN IF EXISTS "manualNotes";
ALTER TABLE "merchant_audience_analyses" DROP COLUMN IF EXISTS "manualMarkdown";
ALTER TABLE "merchant_audience_analyses" DROP COLUMN IF EXISTS "manualInsights";
```

## 注意事项
- User 表的 BigInt 字段在 SQLite 中使用 INTEGER 存储（兼容 64 位）
- 版本表的 snapshot 字段存储 JSON 字符串
- 所有新增字段都是可选的（nullable），不影响现有数据
