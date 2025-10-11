# 商家访问控制修复方案对齐文档

**文档目的**: 在执行修改前，与团队对齐修改方案，确保理解一致  
**创建日期**: 2025-01-XX  
**状态**: 🟡 等待确认

---

## 一、修改概览

### 修改范围
- ✅ **3个文件修改**: 迁移脚本、merchant-access.ts、测试文件
- ✅ **1个文件删除**: 手写的迁移脚本
- ✅ **2个文件新增**: 单元测试、E2E测试
- ⚠️ **0个Breaking Change**: 保持API向后兼容

### 影响评估
- **数据库**: 重新生成迁移，数据结构不变
- **API接口**: 保持兼容，内部实现优化
- **业务逻辑**: 修复bug，不改变业务规则
- **性能**: 查询次数优化（4次→1次）

---

## 二、P0修复详细方案

### P0-1: 重新生成迁移脚本

#### 当前问题
```
❌ prisma/migrations/20240702_add_merchant_members/migration.sql
   - 包含SQLite专有语法（PRAGMA）
   - PostgreSQL执行会直接报错
   - 导致生产部署失败
```

#### 修改方案
```bash
# 步骤1: 删除手写迁移
rm -rf prisma/migrations/20240702_add_merchant_members

# 步骤2: 使用Prisma自动生成
npx prisma migrate dev --name add_merchant_members

# 步骤3: 验证生成的SQL
cat prisma/migrations/*/migration.sql
# 确认：无PRAGMA，无DATETIME，无SQLite特定语法

# 步骤4: 测试SQLite
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate deploy

# 步骤5: 测试PostgreSQL（本地Docker）
docker run --name postgres-test -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD -d -p 5433:5432 postgres:16
DATABASE_URL="<postgres-connection-string>" npx prisma migrate deploy

# 步骤6: 清理测试环境
docker stop postgres-test && docker rm postgres-test
```

#### 预期结果
- ✅ 迁移文件兼容SQLite和PostgreSQL
- ✅ 表结构与schema.prisma完全一致
- ✅ 索引和约束自动创建

#### 风险评估
- **风险等级**: 🟢 低
- **影响范围**: 仅迁移脚本，不影响现有代码
- **回滚方案**: `git checkout prisma/migrations/`

#### 确认问题
- [ ] **Q1**: 是否可以删除旧的迁移目录？
- [ ] **Q2**: 是否需要在预发布环境先测试？
- [ ] **Q3**: 是否需要通知其他开发者同步迁移？

---

### P0-2: 修复ensureMembership异常处理

#### 当前问题
```typescript
❌ 当前代码（lib/auth/merchant-access.ts:9-19）
async function ensureMembership(...) {
  try {
    await prisma.merchantMember.create({ ... })
  } catch (error) {
    // 吞掉所有异常！
  }
}
```

**被隐藏的严重错误**:
- P2003: 外键约束失败（数据损坏）
- P1001: 数据库连接失败（宕机）
- P2024: 连接池超时（高负载）

#### 修改方案

**选项A: 最小修改（推荐）**
```typescript
import { Prisma } from '@prisma/client'

async function ensureMembership(
  userId: string,
  merchantId: string,
  role: MerchantMemberRole = 'EDITOR'
): Promise<void> {
  try {
    await prisma.merchantMember.create({
      data: { merchantId, userId, role }
    })
  } catch (error) {
    // 只捕获唯一约束冲突
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // 成员关系已存在，忽略
        return
      }
      // 其他Prisma错误抛出
      throw new Error(`创建商家成员关系失败: ${error.message}`)
    }
    // 未知错误抛出
    throw error
  }
}
```

**选项B: 完整增强（更安全）**
```typescript
import { Prisma } from '@prisma/client'

async function ensureMembership(
  userId: string,
  merchantId: string,
  role: MerchantMemberRole = 'EDITOR'
): Promise<void> {
  try {
    await prisma.merchantMember.create({
      data: { merchantId, userId, role }
    })
    console.log(`[MerchantAccess] 创建成员: user=${userId}, merchant=${merchantId}`)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // P2002: 唯一约束冲突 - 成员已存在
        console.log(`[MerchantAccess] 成员已存在: user=${userId}, merchant=${merchantId}`)
        return
      }
      
      // 记录其他Prisma错误
      console.error(`[MerchantAccess] Prisma错误 ${error.code}:`, {
        userId,
        merchantId,
        message: error.message,
        meta: error.meta
      })
      throw new Error(`创建商家成员关系失败: ${error.message}`)
    }
    
    // 记录未知错误
    console.error(`[MerchantAccess] 未知错误:`, error)
    throw error
  }
}
```

#### 预期效果
- ✅ 唯一约束冲突仍然被忽略（预期行为）
- ✅ 外键约束失败会抛出错误
- ✅ 数据库连接问题会抛出错误
- ✅ 监控系统可以捕获真实故障

#### 风险评估
- **风险等级**: 🟢 低
- **影响范围**: 仅异常处理逻辑，不改变正常流程
- **回滚方案**: 简单回退代码

#### 确认问题
- [ ] **Q1**: 选择哪个方案？选项A（最小修改）还是选项B（完整增强）？
- [ ] **Q2**: 是否需要接入监控系统（如Sentry）？
- [ ] **Q3**: 日志级别是否合适？（console.log vs logger.info）

---

### P0-3: 添加基础测试覆盖

#### 当前问题
```
❌ 无测试覆盖
   - ensureMembership函数没有测试
   - hasMerchantAccess函数没有测试
   - 修复后无法验证正确性
```

#### 修改方案

**测试文件结构**:
```
tests/
  lib/
    auth/
      merchant-access.test.ts  ← 新建
  api/
    creative/
      batches.test.ts          ← 新建（可选）
```

**测试用例清单**:

```typescript
// tests/lib/auth/merchant-access.test.ts

describe('ensureMembership', () => {
  test('应该成功创建新成员关系', async () => {
    // 测试正常创建流程
  })

  test('应该忽略重复创建（P2002）', async () => {
    // 测试幂等性
  })

  test('应该抛出外键约束错误（P2003）', async () => {
    // 测试无效的merchantId/userId
  })

  test('应该抛出数据库连接错误', async () => {
    // 模拟数据库宕机
  })
})

describe('hasMerchantAccess', () => {
  test('管理员应该有权限', async () => {
    // 测试ADMIN角色
  })

  test('成员应该有权限', async () => {
    // 测试member关系
  })

  test('batch所有者应该有权限', async () => {
    // 测试triggeredBy关系
  })

  test('无关用户不应该有权限', async () => {
    // 测试拒绝访问
  })

  test('应该自动创建成员关系', async () => {
    // 测试副作用（P0修复后可能改变）
  })
})
```

#### 测试框架选择
- ✅ **Vitest**: 项目已配置
- ✅ **Prisma Mock**: 或使用真实测试数据库

#### 覆盖率目标
- **最低要求**: 80%（核心逻辑）
- **理想目标**: 90%（包括边界情况）

#### 风险评估
- **风险等级**: 🟢 低
- **影响范围**: 仅测试代码，不影响生产
- **回滚方案**: 删除测试文件（不推荐）

#### 确认问题
- [ ] **Q1**: 使用Prisma Mock还是真实测试数据库？
- [ ] **Q2**: 覆盖率目标是否合理？
- [ ] **Q3**: 是否需要E2E测试？（可放到P1）

---

## 三、P1优化方案（可选）

### P1-1: 拆分读写操作

#### 当前问题
```typescript
❌ hasMerchantAccess既读又写
   - 函数名暗示只读，但有写操作
   - GET请求产生INSERT
   - 违反HTTP幂等性
```

#### 修改方案

**新增函数**:
```typescript
// 1. 纯读函数
export async function checkMerchantAccess(
  userId: string,
  merchantId: string,
  userRole?: UserRole | string | null
): Promise<{
  hasAccess: boolean
  source: 'admin' | 'member' | 'batch-owner' | 'asset-owner' | null
  needsSync: boolean
}>

// 2. 显式写函数
export async function syncMerchantMembership(
  userId: string,
  merchantId: string,
  role: MerchantMemberRole = 'EDITOR'
): Promise<void>

// 3. 向后兼容函数
export async function hasMerchantAccess(...): Promise<boolean> {
  const result = await checkMerchantAccess(...)
  if (result.hasAccess && result.needsSync) {
    // 异步同步，不阻塞返回
    syncMerchantMembership(...).catch(...)
  }
  return result.hasAccess
}
```

#### 确认问题
- [ ] **Q1**: 是否在P0修复后立即做？还是等一段时间观察？
- [ ] **Q2**: 是否保留hasMerchantAccess向后兼容？
- [ ] **Q3**: 异步同步是否会导致竞态条件？

---

### P1-2: 优化API routes重复查询

#### 当前问题
```typescript
❌ 每个API调用4-5次数据库查询
   - 查询batch → 查询member → 再查batch → 查询asset → 再查batch
   - 性能差，数据库负载高
```

#### 修改方案
```typescript
// 合并为1次查询
const batch = await prisma.creativeBatch.findUnique({
  where: { id: params.batchId },
  include: {
    merchant: {
      include: {
        members: {
          where: { userId: token.sub },
          select: { role: true }
        }
      }
    },
    // ... 其他需要的关联数据
  }
})

// 在内存中检查权限
const hasAccess = 
  token.role === 'ADMIN' ||
  batch.triggeredBy === token.sub ||
  batch.merchant.members.length > 0
```

#### 确认问题
- [ ] **Q1**: 是否需要性能基准测试？
- [ ] **Q2**: 是否所有API routes都需要优化？
- [ ] **Q3**: 优化后是否影响缓存策略？

---

## 四、修改顺序和依赖

### 推荐执行顺序

```
第一阶段（P0 - 必须完成）
├─ 1. P0-1: 重新生成迁移脚本 [1小时]
│  └─ 验证: SQLite + PostgreSQL测试
├─ 2. P0-2: 修复异常处理 [2小时]
│  └─ 验证: 本地测试
└─ 3. P0-3: 添加测试覆盖 [4小时]
   └─ 验证: 覆盖率>80%

第二阶段（P1 - 建议完成）
├─ 4. P1-1: 拆分读写操作 [1天]
│  └─ 依赖: P0全部完成
└─ 5. P1-2: 优化重复查询 [4小时]
   └─ 依赖: P1-1完成

第三阶段（验证和部署）
├─ 6. 集成测试 [4小时]
├─ 7. 预发布环境验证 [1天]
└─ 8. 生产部署 [2小时]
```

### 依赖关系

```
P0-1 (迁移脚本)
  ↓ 无依赖，可独立进行
  
P0-2 (异常处理)
  ↓ 无依赖，可独立进行
  
P0-3 (测试覆盖)
  ↓ 依赖 P0-2（需要测试修复后的代码）
  
P1-1 (拆分读写)
  ↓ 依赖 P0-2, P0-3（需要先修复并测试）
  
P1-2 (优化查询)
  ↓ 依赖 P1-1（新的checkMerchantAccess更容易优化）
```

---

## 五、确认检查清单

### 技术确认
- [ ] 修改方案技术可行性已评估
- [ ] 测试策略已确定
- [ ] 回滚方案已准备
- [ ] 性能影响已评估

### 团队协作确认
- [ ] 相关开发者已知晓修改计划
- [ ] 数据库变更已通知DBA（如适用）
- [ ] 测试团队已准备测试用例
- [ ] 产品团队已知晓功能影响

### 时间和资源确认
- [ ] 修改时间窗口已确定：______
- [ ] 负责人已分配：______
- [ ] 代码审查人已确定：______
- [ ] 测试环境已就绪

### 风险确认
- [ ] P0修复风险可控
- [ ] P1优化可延后（不阻塞部署）
- [ ] 监控和告警已配置
- [ ] 生产部署维护窗口已预约

---

## 六、关键决策点

### 决策1: P0修复范围
**选项**:
- A. 只修复P0-1和P0-2（最小化，2天完成）
- B. 修复全部P0（包括测试，3天完成）
- C. 修复P0+部分P1（完整方案，1周完成）

**建议**: 选项B
**原因**: 测试覆盖是验证修复正确性的必要条件

**你的选择**: [ ]

---

### 决策2: 异常处理方案
**选项**:
- A. 选项A - 最小修改（只改异常捕获）
- B. 选项B - 完整增强（加日志和监控）

**建议**: 选项B
**原因**: 日志和监控有助于问题排查

**你的选择**: [ ]

---

### 决策3: 测试策略
**选项**:
- A. 仅单元测试（快速，但覆盖不全）
- B. 单元测试 + E2E测试（完整，但耗时）
- C. 单元测试 + 手动测试（折中）

**建议**: 选项B
**原因**: E2E测试可以验证完整流程

**你的选择**: [ ]

---

### 决策4: P1优化时机
**选项**:
- A. 与P0一起完成（一次性修复）
- B. P0部署后再做P1（稳健方案）
- C. 暂不做P1（风险规避）

**建议**: 选项B
**原因**: P0是阻塞问题，优先修复；P1可以观察后再优化

**你的选择**: [ ]

---

### 决策5: 部署策略
**选项**:
- A. 直接部署到生产（快速）
- B. 先部署到预发布观察3天（稳健）
- C. 灰度发布（最安全，但复杂）

**建议**: 选项B
**原因**: P0涉及数据库迁移，稳健为上

**你的选择**: [ ]

---

## 七、确认和签字

### 技术负责人确认
- **姓名**: ______
- **日期**: ______
- **签字**: ______
- **备注**: ______

### 项目经理确认
- **姓名**: ______
- **日期**: ______
- **签字**: ______
- **备注**: ______

### 测试负责人确认
- **姓名**: ______
- **日期**: ______
- **签字**: ______
- **备注**: ______

---

## 八、下一步行动

确认完成后，请按以下步骤推进：

1. **创建功能分支**
   ```bash
   git checkout -b fix/merchant-access-critical-issues
   ```

2. **开始P0-1修复**
   - 执行迁移脚本重新生成
   - 验证双平台兼容性

3. **每日站会同步**
   - 报告修改进度
   - 讨论遇到的问题
   - 调整计划（如需要）

4. **修复完成后**
   - 提交PR
   - 代码审查
   - 合并到主分支

5. **部署到预发布**
   - 运行完整测试套件
   - 观察3天
   - 确认无问题后部署到生产

---

**文档状态**: 🟡 等待团队确认和签字  
**预计确认完成时间**: ______  
**预计开始修改时间**: ______
