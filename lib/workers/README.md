# Creative Batch Worker

## 失败策略原则

**Never break userspace** - 永远不要因为"不完美"就扔掉用户的数据。

### 状态定义

- **SUCCEEDED**: 生成了完整的 5 条文案
- **PARTIAL_SUCCESS**: 生成了 1-4 条文案（部分成功）
- **FAILED**: 生成了 0 条文案（完全失败）

### 为什么需要 PARTIAL_SUCCESS？

**错误场景**（旧设计）：
```
用户请求生成 5 条文案
→ Claude 生成了 3 条高质量文案
→ 第 4、5 条因为 token 限制失败
→ 旧 Worker：标记整批 FAILED，扔掉 3 条文案
→ 用户什么都没得到，浪费了 token 和时间
```

**正确场景**（新设计）：
```
用户请求生成 5 条文案
→ Claude 生成了 3 条高质量文案
→ 第 4、5 条失败
→ 新 Worker：标记 PARTIAL_SUCCESS，保存 3 条文案
→ 用户得到 3 条文案，可以：
   - 使用这 3 条
   - 单独重新生成缺失的 2 条
   - 或整批重新生成
```

### 实现要点

1. **永远保存已生成的内容**
   ```typescript
   if (copiesGenerated > 0) {
     await saveCopies(batchId, copies)
     status = PARTIAL_SUCCESS
   }
   ```

2. **记录异常但不阻止使用**
   ```typescript
   if (copiesGenerated < 5) {
     await recordException(batchId, ...)
     // 但不改变 status 为 FAILED
   }
   ```

3. **前端显示清晰状态**
   - SUCCEEDED: "生成完成 (5/5)"
   - PARTIAL_SUCCESS: "部分生成 (3/5)" + "重新生成剩余"按钮
   - FAILED: "生成失败，请重试"

## 集成方式

### 任务队列（推荐）

```typescript
// API 创建批次后推送任务
await queue.push({
  type: 'creative-batch',
  batchId: batch.id
})

// Worker 消费任务
queue.process('creative-batch', async (job) => {
  await processBatch(job.data)
})
```

### 直接调用（简单）

```typescript
import { processBatch } from '@/lib/workers/creative-batch-worker'

// 创建批次后直接调用
const batch = await createBatchWithAssets(...)
await processBatch({ batchId: batch.id })
```

## 实现状态

- [x] 实现实际的 Claude API 调用
- [x] 提示词构建逻辑（系统提示 + 用户提示）
- [x] 内容解析逻辑（支持格式化和容错解析）
- [x] 测试验证（生成 3/5 条，PARTIAL_SUCCESS）
- [ ] 添加重试逻辑（网络失败等）
- [ ] 实现 SSE 推送（实时状态更新）
- [ ] 单条再生成支持
- [ ] 整批再生成支持（读取 metadata 中的 appendPrompt）

## 测试

运行测试脚本：
```bash
npx tsx scripts/test-batch-worker.ts
```

测试会：
1. 创建测试商家和素材
2. 创建生成批次
3. 调用 Worker 生成文案
4. 验证 PARTIAL_SUCCESS 逻辑
5. 验证 sequence 约束
6. 验证异常记录

**测试结果（2025-01-15）**：
- ✅ 生成 3/5 条文案
- ✅ 状态：PARTIAL_SUCCESS
- ✅ Token: 2828 (prompt: 1328, completion: 1500)
- ✅ sequence 范围验证通过
