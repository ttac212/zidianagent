# 批次/文案系统安全漏洞调研报告

**日期**: 2025-01-XX  
**审计人员**: Droid (Factory AI)  
**审计范围**: 创意批次生成系统 (Creative Batch System)  
**风险等级**: 🔴 P0 - 严重安全漏洞

---

## 执行摘要

经过深入代码审查和架构分析，确认批次/文案生成接口存在三个真实的 **P0 级权限与数据完整性漏洞**，必须在生产上线前修复：

1. **仓库层资产归属校验缺失** - 允许跨商家关联任意资产
2. **上层 API 用双循环掩盖底层缺陷** - 复杂且易绕过的校验逻辑
3. **权限函数永久放行已移除成员** - 授权撤销机制失效

**品味评分**: 🟡 凑合 - 代码能跑但结构脆弱，存在致命安全隐患

---

## 漏洞详情

### 🔴 漏洞 1：仓库层不校验资产归属商家

**位置**: `lib/repositories/creative-batch-repository.ts:27-78`

**问题描述**:
`createBatchWithAssets` 函数完全依赖调用方自律来保证资产属于同一商家，仓库层没有任何校验逻辑。

**代码证据**:
```typescript
export async function createBatchWithAssets(input: CreateBatchInput): Promise<CreateBatchResult> {
  const { merchantId, triggeredBy, assets, parentBatchId, modelId, status, metadata } = input

  // ❌ 只校验角色数量，不校验 assetId 是否属于 merchantId
  validateAssetRoles(assets)

  return prisma.$transaction(async tx => {
    // ... 创建批次
    
    const payload = assets.map((asset, index) => ({
      batchId: batch.id,
      role: asset.role,
      promptAssetId: isPromptRole(asset.role) ? asset.assetId : null,
      referenceAssetId: isPromptRole(asset.role) ? null : asset.assetId,
      isEnabled: asset.enabled ?? true,
      sortOrder: asset.sortOrder ?? index
    }))

    // ❌ 直接写入，不检查 assetId 归属
    await tx.creativeBatchAsset.createMany({ data: payload })
  })
}
```

**攻击场景**:
```typescript
// 恶意脚本或被入侵的 API 路径可以：
await createBatchWithAssets({
  merchantId: 'merchant-A',  // 我的商家
  triggeredBy: 'user-X',
  assets: [
    { role: 'REPORT', assetId: 'report-from-merchant-B' },    // ❌ 偷其他商家的报告
    { role: 'PROMPT', assetId: 'prompt-from-merchant-C' },    // ❌ 偷其他商家的提示词
    { role: 'ATTACHMENT', assetId: 'secret-from-merchant-D' } // ❌ 偷其他商家的机密附件
  ]
})
// ✅ 成功创建！数据库现在包含跨商家污染数据
```

**影响范围**:
- ✅ 已知受影响路径：
  - `POST /api/creative/batches` (有上层校验)
  - `POST /api/creative/batches/:id/regenerate` (无校验!)
  - `POST /api/creative/copies/:id` (单条再生，无校验!)
  - 任何直接调用 `createBatchWithAssets` 的脚本
  
- 🔴 **风险**: 一旦污染数据写入数据库，无法自动清理，需要人工数据修复脚本

**数据模型证据**:
```prisma
model CreativeBatchAsset {
  id               String               @id @default(cuid())
  batchId          String
  role             CreativeAssetRole
  promptAssetId    String?              // ❌ 无外键约束到 merchantId
  referenceAssetId String?              // ❌ 无外键约束到 merchantId
  // ...
}
```

数据库 schema 层面也没有 CHECK 约束来保证资产归属。

---

### 🟡 漏洞 2：上层 API 双循环校验掩盖底层缺陷

**位置**: `app/api/creative/batches/route.ts:93-158`

**问题描述**:
上层 API 用复杂的双循环 + 分支逻辑硬校验资产类型和归属，本质是在掩盖仓库层的设计缺陷。

**代码证据**:
```typescript
// ❌ 复杂度：O(n) 过滤 + O(1) 查询 + O(n) 循环校验
// 第一段：校验 prompt 类资产
const promptAssetIds = assetsInput
  .filter(asset => isPromptRole(asset.role))
  .map(asset => asset.assetId)

if (promptAssetIds.length) {
  const promptAssets = await prisma.merchantPromptAsset.findMany({
    where: {
      id: { in: promptAssetIds },
      merchantId  // ✅ 这里才校验归属
    },
    select: { id: true, type: true }
  })

  const promptAssetMap = new Map(promptAssets.map(asset => [asset.id, asset.type]))

  for (const asset of assetsInput.filter(item => isPromptRole(item.role))) {
    const recordType = promptAssetMap.get(asset.assetId)
    if (!recordType) {
      return validationError(`资产 ${asset.assetId} 不属于该商家`)
    }
    if (recordType !== getExpectedPromptType(asset.role)) {
      return validationError(`资产 ${asset.assetId} 类型与角色不匹配`)
    }
  }
}

// ❌ 第二段：几乎一模一样的逻辑校验 reference 类资产
const referenceAssetIds = assetsInput
  .filter(asset => !isPromptRole(asset.role))
  .map(asset => asset.assetId)

if (referenceAssetIds.length) {
  const referenceAssets = await prisma.referenceAsset.findMany({
    where: {
      id: { in: referenceAssetIds },
      merchantId  // ✅ 这里才校验归属
    },
    select: { id: true, kind: true }
  })
  
  // ... 又是一轮循环校验
}
```

**问题分析**:
1. **违反单一职责**: API 层不应该负责数据完整性校验，应该下沉到仓库层
2. **代码重复**: 两段几乎完全重复的逻辑，难以维护
3. **易绕过**: 其他路径（如 `regenerate/route.ts`、单条再生、脚本）可能遗忘添加这个校验

**绕过场景实例**:
`app/api/creative/batches/[batchId]/regenerate/route.ts` 就没有这个校验：

```typescript
export async function POST(request: NextRequest, { params }: { params: { batchId: string } }) {
  // ... 只校验了商家访问权限
  
  const assetInputs = sourceBatch.assets.map(asset => ({
    role: asset.role,
    assetId: asset.promptAssetId ?? asset.referenceAssetId ?? '',
    enabled: asset.isEnabled,
    sortOrder: asset.sortOrder
  }))

  // ❌ 直接调用仓库层，没有校验 assetId 归属！
  const { batch } = await createBatchWithAssets({
    merchantId: sourceBatch.merchantId,
    triggeredBy: token.sub,
    assets: assetInputs,
    parentBatchId: sourceBatch.id
  })
}
```

如果原始批次已经被污染（通过其他漏洞），再生成会继续传播污染数据。

---

### 🔴 漏洞 3：hasMerchantAccess 永久放行已移除成员

**位置**: `lib/auth/merchant-access.ts:30-78`

**问题描述**:
权限检查函数通过历史数据（批次触发人、资产创建人）判断访问权限，导致从 `merchant_members` 移除的用户仍然可以访问商家数据。

**代码证据**:
```typescript
export async function hasMerchantAccess(
  userId: string,
  merchantId: string,
  userRole?: UserRole | string | null
): Promise<boolean> {
  if (userRole === 'ADMIN') {
    return true  // ✅ 管理员永久放行，合理
  }

  // ✅ 正常路径：检查成员表
  const membership = await prisma.merchantMember.findUnique({
    where: { merchantId_userId: { merchantId, userId } }
  })
  if (membership) {
    return true
  }

  // 🔴 漏洞 1：只要触发过批次就永久放行
  const ownsBatch = await prisma.creativeBatch.findFirst({
    where: {
      merchantId,
      triggeredBy: userId  // ❌ 历史数据，无法撤销
    }
  })
  if (ownsBatch) {
    return true  // ❌ 即使已从 merchant_members 移除，仍然放行
  }

  // 🔴 漏洞 2：只要创建过资产就永久放行
  const ownsPromptAsset = await prisma.merchantPromptAsset.findFirst({
    where: {
      merchantId,
      createdBy: userId  // ❌ 历史数据，无法撤销
    }
  })
  return !!ownsPromptAsset  // ❌ 永久授权，无法撤销
}
```

**攻击场景**:
```
时间线：
T1: 用户 Alice 加入商家 A (merchant_members 添加记录)
T2: Alice 创建一个批次 (triggeredBy = 'alice')
T3: Alice 创建一个 prompt 资产 (createdBy = 'alice')
T4: 管理员发现 Alice 泄密，将其移除 (DELETE FROM merchant_members WHERE userId='alice')
T5: Alice 仍然可以访问商家 A！
    - hasMerchantAccess('alice', 'merchant-A') → true (因为 ownsBatch 存在)
    - Alice 可以查看批次列表、创建新批次、编辑文案、再生成等
T6: 数据持续泄漏...
```

**违反原则**:
1. **最小权限原则**: 权限应该是可撤销的
2. **向后兼容预期**: 移除成员应该立即生效
3. **安全默认值**: 应该默认拒绝，而不是默认允许

**修复难度**: 🟢 简单 - 删除历史数据回退逻辑即可

---

## 测试覆盖分析

### 现有测试

**tests/batch-repositories.test.ts**:
- ✅ 测试版本冲突重试
- ✅ 测试父批次归属校验
- ✅ 测试批次状态更新
- ❌ **缺失**: 资产归属校验测试

**tests/api/creative-batches.test.ts**:
- ✅ 测试商家成员边界
- ✅ 测试跨商家父批次拒绝
- ❌ **缺失**: 跨商家资产关联测试
- ❌ **缺失**: hasMerchantAccess 权限撤销测试

### 漏洞未被测试捕获的原因

1. **Mock 层级过高**: 测试 mock 了整个 Prisma 客户端，绕过了真实数据库约束
2. **测试范围不足**: 只测试了"正常拒绝"路径，没有测试"恶意注入"场景
3. **缺少端到端测试**: 没有测试完整的攻击链（创建污染数据 → 权限撤销失效 → 持续访问）

---

## Linus 式修复方案

### 原则
- **删除胜于重构**: 移除过度防御的代码，让底层承担应有职责
- **单一路径**: 所有校验逻辑归一到仓库层，上层只描述业务意图
- **显式授权**: 权限应该完全基于 `merchant_members` + `ADMIN` 角色，移除隐式放行

---

### 修复 1: 仓库层强制校验资产归属

**目标**: 让 `createBatchWithAssets` 在事务内校验所有资产的 `merchantId`

**实现策略**:
```typescript
export async function createBatchWithAssets(input: CreateBatchInput): Promise<CreateBatchResult> {
  const { merchantId, triggeredBy, assets, parentBatchId, modelId, status, metadata } = input

  if (!assets.length) {
    throw new Error('Batch requires at least one asset')
  }

  validateAssetRoles(assets)

  return prisma.$transaction(async tx => {
    // ✅ 新增：在事务内校验资产归属
    await validateAssetOwnership(tx, merchantId, assets)

    // 父批次校验（已存在，保留）
    if (parentBatchId) {
      const existingParent = await tx.creativeBatch.findUnique({
        where: { id: parentBatchId },
        select: { id: true, merchantId: true, parentBatchId: true, status: true }
      })

      if (!existingParent) {
        throw new Error(`Parent batch ${parentBatchId} not found`)
      }

      if (existingParent.merchantId !== merchantId) {
        throw new Error(`Parent batch ${parentBatchId} does not belong to merchant ${merchantId}`)
      }
    }

    // ... 创建批次和资产关联（保持不变）
  })
}

async function validateAssetOwnership(
  tx: Prisma.TransactionClient,
  merchantId: string,
  assets: BatchAssetInput[]
): Promise<void> {
  const promptAssetIds = assets
    .filter(asset => isPromptRole(asset.role))
    .map(asset => asset.assetId)
    .filter(Boolean)

  const referenceAssetIds = assets
    .filter(asset => !isPromptRole(asset.role))
    .map(asset => asset.assetId)
    .filter(Boolean)

  // 批量查询 prompt 类资产
  if (promptAssetIds.length > 0) {
    const promptAssets = await tx.merchantPromptAsset.findMany({
      where: {
        id: { in: promptAssetIds },
        merchantId
      },
      select: { id: true, type: true }
    })

    const foundIds = new Set(promptAssets.map(a => a.id))
    const missingIds = promptAssetIds.filter(id => !foundIds.has(id))
    
    if (missingIds.length > 0) {
      throw new Error(
        `Prompt assets [${missingIds.join(', ')}] do not belong to merchant ${merchantId}`
      )
    }

    // 校验类型匹配
    const assetTypeMap = new Map(promptAssets.map(a => [a.id, a.type]))
    for (const asset of assets.filter(a => isPromptRole(a.role))) {
      const expectedType = getExpectedPromptType(asset.role)
      const actualType = assetTypeMap.get(asset.assetId)
      
      if (actualType !== expectedType) {
        throw new Error(
          `Asset ${asset.assetId} type mismatch: expected ${expectedType}, got ${actualType}`
        )
      }
    }
  }

  // 批量查询 reference 类资产
  if (referenceAssetIds.length > 0) {
    const referenceAssets = await tx.referenceAsset.findMany({
      where: {
        id: { in: referenceAssetIds },
        merchantId
      },
      select: { id: true, kind: true }
    })

    const foundIds = new Set(referenceAssets.map(a => a.id))
    const missingIds = referenceAssetIds.filter(id => !foundIds.has(id))
    
    if (missingIds.length > 0) {
      throw new Error(
        `Reference assets [${missingIds.join(', ')}] do not belong to merchant ${merchantId}`
      )
    }

    // 校验类型匹配
    const assetKindMap = new Map(referenceAssets.map(a => [a.id, a.kind]))
    for (const asset of assets.filter(a => !isPromptRole(a.role))) {
      const expectedKind = getExpectedReferenceKind(asset.role)
      const actualKind = assetKindMap.get(asset.assetId)
      
      if (actualKind !== expectedKind) {
        throw new Error(
          `Asset ${asset.assetId} kind mismatch: expected ${expectedKind}, got ${actualKind}`
        )
      }
    }
  }
}

function getExpectedPromptType(role: CreativeAssetRole): PromptAssetType {
  return role === CreativeAssetRole.REPORT
    ? PromptAssetType.REPORT
    : PromptAssetType.PROMPT
}

function getExpectedReferenceKind(role: CreativeAssetRole): ReferenceKind {
  switch (role) {
    case CreativeAssetRole.ATTACHMENT:
      return ReferenceKind.RAW_ATTACHMENT
    case CreativeAssetRole.TOPIC:
      return ReferenceKind.TOPIC
    case CreativeAssetRole.BENCHMARK:
      return ReferenceKind.BENCHMARK
    default:
      throw new Error(`Unsupported reference role: ${role}`)
  }
}
```

**效果**:
- ✅ 所有调用路径（API、脚本、worker）自动受保护
- ✅ 事务内校验，原子性保证
- ✅ 清晰的错误信息，便于调试
- ✅ 上层 API 可以删除冗余校验逻辑

---

### 修复 2: 上层 API 删除冗余校验

**目标**: 简化 `app/api/creative/batches/route.ts`，移除双循环校验逻辑

**删除的代码** (约 60 行):
```typescript
// ❌ 删除整段 prompt 类资产校验
const promptAssetIds = assetsInput
  .filter(asset => isPromptRole(asset.role))
  .map(asset => asset.assetId)

if (promptAssetIds.length) {
  // ... 大量校验逻辑
}

// ❌ 删除整段 reference 类资产校验
const referenceAssetIds = assetsInput
  .filter(asset => !isPromptRole(asset.role))
  .map(asset => asset.assetId)

if (referenceAssetIds.length) {
  // ... 大量校验逻辑
}
```

**保留的代码**:
```typescript
// ✅ 保留：商家存在性检查（业务逻辑）
const merchant = await prisma.merchant.findUnique({
  where: { id: merchantId },
  select: { id: true }
})
if (!merchant) {
  return notFound('商家不存在')
}

// ✅ 保留：商家访问权限检查（修复后的版本）
const accessible = await hasMerchantAccess(token.sub, merchantId, token.role)
if (!accessible) {
  return notFound('商家不存在或无权访问')
}

// ✅ 保留：父批次存在性检查（业务逻辑）
if (parentBatchId) {
  const parentBatch = await prisma.creativeBatch.findFirst({
    where: { id: parentBatchId, merchantId },
    select: { id: true }
  })
  if (!parentBatch) {
    return notFound('父批次不存在或无权访问')
  }
}

// ✅ 简化：直接调用仓库层，让其处理校验
const { batch } = await createBatchWithAssets({
  merchantId,
  triggeredBy: token.sub,
  assets: assetsInput,
  parentBatchId: parentBatchId ?? null
})
```

**效果**:
- ✅ 删除约 60 行重复代码
- ✅ API 层只关注业务逻辑和权限检查
- ✅ 数据完整性由仓库层统一保证

---

### 修复 3: 收紧 hasMerchantAccess

**目标**: 权限完全基于 `merchant_members` 表 + `ADMIN` 角色，移除历史数据回退

**修改前**:
```typescript
export async function hasMerchantAccess(
  userId: string,
  merchantId: string,
  userRole?: UserRole | string | null
): Promise<boolean> {
  if (!userId || !merchantId) {
    return false
  }

  if (userRole === 'ADMIN') {
    return true
  }

  const membership = await prisma.merchantMember.findUnique({
    where: { merchantId_userId: { merchantId, userId } }
  })
  if (membership) {
    return true
  }

  // 🔴 删除以下历史数据回退逻辑
  const ownsBatch = await prisma.creativeBatch.findFirst({
    where: { merchantId, triggeredBy: userId }
  })
  if (ownsBatch) {
    return true
  }

  const ownsPromptAsset = await prisma.merchantPromptAsset.findFirst({
    where: { merchantId, createdBy: userId }
  })
  return !!ownsPromptAsset
}
```

**修改后**:
```typescript
export async function hasMerchantAccess(
  userId: string,
  merchantId: string,
  userRole?: UserRole | string | null
): Promise<boolean> {
  if (!userId || !merchantId) {
    return false
  }

  // ✅ 管理员永久放行（合理）
  if (userRole === 'ADMIN') {
    return true
  }

  // ✅ 仅基于成员表判断（可撤销）
  const membership = await prisma.merchantMember.findUnique({
    where: {
      merchantId_userId: {
        merchantId,
        userId
      }
    },
    select: { id: true }
  })

  return !!membership
}
```

**迁移策略**:

如果需要保留旧用户访问（兼容性考虑），提供 **显式迁移脚本** 而不是隐式放行：

```typescript
// scripts/backfill-merchant-members.ts（已存在）
// 扫描历史批次和资产，将 triggeredBy/createdBy 添加到 merchant_members
```

在修改权限函数前，运行迁移脚本补齐历史数据，确保合法用户不会被误杀。

**效果**:
- ✅ 权限可撤销（从 merchant_members 删除 → 立即失效）
- ✅ 符合最小权限原则
- ✅ 清晰的授权模型，无隐式规则
- ✅ 向后兼容通过显式迁移脚本实现

---

## 修复优先级

### P0 - 立即修复（上线前必须完成）
1. ✅ **修复 3**: 收紧 `hasMerchantAccess`（最简单，影响最小）
   - 工作量: 0.5 小时
   - 风险: 低（先运行迁移脚本）
   
2. ✅ **修复 1**: 仓库层强制校验资产归属（核心修复）
   - 工作量: 2 小时
   - 风险: 中（需要充分测试）

### P1 - 技术债清理
3. 🟡 **修复 2**: 删除上层 API 冗余校验（可选，但强烈推荐）
   - 工作量: 1 小时
   - 风险: 低（前提是修复 1 已完成）

### P2 - 增强防护
4. 🟢 数据库层增加 CHECK 约束（长期优化）
   - 迁移到 PostgreSQL 后考虑
   - SQLite 对 CHECK 约束支持有限

---

## 测试计划

### 新增单元测试

**tests/batch-repositories.test.ts**:
```typescript
it('rejects when prompt asset does not belong to merchant', async () => {
  await expect(
    createBatchWithAssets({
      merchantId: 'merchant-A',
      triggeredBy: 'user-1',
      assets: [
        { role: 'REPORT', assetId: 'report-from-merchant-B' },  // ❌ 跨商家
        { role: 'PROMPT', assetId: 'prompt-from-merchant-A' }
      ]
    })
  ).rejects.toThrow(/do not belong to merchant/)
})

it('rejects when reference asset does not belong to merchant', async () => {
  await expect(
    createBatchWithAssets({
      merchantId: 'merchant-A',
      triggeredBy: 'user-1',
      assets: [
        { role: 'REPORT', assetId: 'report-A' },
        { role: 'PROMPT', assetId: 'prompt-A' },
        { role: 'ATTACHMENT', assetId: 'attachment-from-merchant-B' }  // ❌ 跨商家
      ]
    })
  ).rejects.toThrow(/do not belong to merchant/)
})

it('rejects when asset type does not match role', async () => {
  await expect(
    createBatchWithAssets({
      merchantId: 'merchant-A',
      triggeredBy: 'user-1',
      assets: [
        { role: 'REPORT', assetId: 'prompt-type-asset' },  // ❌ 类型不匹配
        { role: 'PROMPT', assetId: 'prompt-A' }
      ]
    })
  ).rejects.toThrow(/type mismatch/)
})
```

**tests/lib/auth/merchant-access.test.ts**:
```typescript
it('denies access after removing from merchant_members', async () => {
  // 添加成员
  await prisma.merchantMember.create({
    data: { merchantId: 'merchant-A', userId: 'user-1', role: 'EDITOR' }
  })
  
  expect(await hasMerchantAccess('user-1', 'merchant-A', 'USER')).toBe(true)
  
  // 移除成员
  await prisma.merchantMember.delete({
    where: { merchantId_userId: { merchantId: 'merchant-A', userId: 'user-1' } }
  })
  
  // ✅ 应该立即失效
  expect(await hasMerchantAccess('user-1', 'merchant-A', 'USER')).toBe(false)
})

it('does not grant access based on historical batch creation', async () => {
  // 用户曾触发批次，但不在成员表
  await prisma.creativeBatch.create({
    data: {
      merchantId: 'merchant-A',
      triggeredBy: 'user-1',
      status: 'SUCCEEDED'
    }
  })
  
  // ❌ 应该拒绝（修复后）
  expect(await hasMerchantAccess('user-1', 'merchant-A', 'USER')).toBe(false)
})
```

### E2E 测试场景

**tests/e2e/creative-batch-security.spec.ts** (新建):
```typescript
test('cannot create batch with assets from another merchant', async ({ request }) => {
  // 用户 A 访问商家 A
  const response = await request.post('/api/creative/batches', {
    data: {
      merchantId: 'merchant-A',
      assets: [
        { role: 'REPORT', assetId: 'report-from-merchant-B' },  // ❌ 跨商家
        { role: 'PROMPT', assetId: 'prompt-A' }
      ]
    },
    headers: { cookie: userACookie }
  })
  
  expect(response.status()).toBe(400)  // 或 404
  await expect(response.json()).resolves.toMatchObject({
    error: expect.stringContaining('do not belong')
  })
})

test('removed member cannot access merchant data', async ({ request }) => {
  // 管理员移除成员 A
  await adminRemoveMember('merchant-A', 'user-A')
  
  // 用户 A 尝试访问
  const response = await request.get('/api/creative/batches?merchantId=merchant-A', {
    headers: { cookie: userACookie }
  })
  
  expect(response.status()).toBe(404)
})
```

---

## 数据清理计划

### 检测污染数据

运行诊断脚本检测现有数据库中的跨商家关联：

```typescript
// scripts/detect-cross-merchant-assets.ts
import { prisma } from '@/lib/prisma'

async function detectCrossMerchantAssets() {
  const batches = await prisma.creativeBatch.findMany({
    include: {
      assets: {
        include: {
          promptAsset: { select: { merchantId: true } },
          referenceAsset: { select: { merchantId: true } }
        }
      }
    }
  })

  const violations = []

  for (const batch of batches) {
    for (const asset of batch.assets) {
      const assetMerchantId = 
        asset.promptAsset?.merchantId ?? asset.referenceAsset?.merchantId

      if (assetMerchantId && assetMerchantId !== batch.merchantId) {
        violations.push({
          batchId: batch.id,
          batchMerchant: batch.merchantId,
          assetId: asset.promptAssetId ?? asset.referenceAssetId,
          assetMerchant: assetMerchantId,
          role: asset.role
        })
      }
    }
  }

  console.log(`发现 ${violations.length} 个跨商家资产关联`)
  console.table(violations)

  return violations
}

detectCrossMerchantAssets().catch(console.error)
```

### 清理策略

如果发现污染数据：

1. **低风险**: 批次数量少（< 10 个）
   - 手动审查后删除污染批次
   - `DELETE FROM creative_batches WHERE id IN (...)`

2. **中等风险**: 批次数量中等（10-100 个）
   - 导出污染数据到 CSV
   - 通知相关商家
   - 提供回滚窗口后批量删除

3. **高风险**: 大量污染（> 100 个）
   - 需要数据迁移脚本
   - 尝试修正关联（如果能确定正确的商家）
   - 无法修正的标记为 `ARCHIVED` 状态

---

## 后续监控

### 日志增强

在 `createBatchWithAssets` 中添加审计日志：

```typescript
// 在事务提交后
logger.info('Batch created', {
  batchId: batch.id,
  merchantId,
  triggeredBy,
  assetCount: assets.length,
  promptAssetIds: assets.filter(isPromptRole).map(a => a.assetId),
  referenceAssetIds: assets.filter(a => !isPromptRole(a.role)).map(a => a.assetId),
  parentBatchId
})
```

### 数据库约束（长期）

迁移到 PostgreSQL 后考虑添加：

```sql
-- 触发器：检查资产归属
CREATE OR REPLACE FUNCTION check_asset_merchant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prompt_asset_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM merchant_prompt_assets mpa
      JOIN creative_batches cb ON cb.id = NEW.batch_id
      WHERE mpa.id = NEW.prompt_asset_id AND mpa.merchant_id = cb.merchant_id
    ) THEN
      RAISE EXCEPTION 'Prompt asset does not belong to batch merchant';
    END IF;
  END IF;

  IF NEW.reference_asset_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM reference_assets ra
      JOIN creative_batches cb ON cb.id = NEW.batch_id
      WHERE ra.id = NEW.reference_asset_id AND ra.merchant_id = cb.merchant_id
    ) THEN
      RAISE EXCEPTION 'Reference asset does not belong to batch merchant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_asset_merchant
BEFORE INSERT ON creative_batch_assets
FOR EACH ROW EXECUTE FUNCTION check_asset_merchant();
```

---

## 总结

### 漏洞确认

✅ **漏洞 1 - 仓库层不校验资产归属**: 真实存在，P0 级别  
✅ **漏洞 2 - 上层 API 双循环掩盖缺陷**: 真实存在，设计缺陷  
✅ **漏洞 3 - 权限函数永久放行**: 真实存在，P0 级别  

### 修复路径

1. ✅ 立即运行 `scripts/backfill-merchant-members.ts` 补齐历史数据
2. ✅ 修改 `hasMerchantAccess` 移除历史数据回退逻辑
3. ✅ 在 `createBatchWithAssets` 增加资产归属校验
4. 🟡 删除上层 API 冗余校验（可选）
5. ✅ 编写并运行测试覆盖所有场景
6. ✅ 运行 `detect-cross-merchant-assets.ts` 检测污染数据
7. ✅ 清理污染数据（如有）

### 品味评分（修复后）

🟢 **优秀** - 清晰的职责分离，单一校验路径，可撤销的权限模型

---

**审计完成**  
下一步：执行修复方案
