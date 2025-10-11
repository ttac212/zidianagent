# 批次状态 SSE 推送使用指南

## 概述

批次生成系统使用 Server-Sent Events (SSE) 实现实时状态推送，客户端通过 `statusVersion` 实现增量更新和去重。

## 核心机制

### statusVersion 递增

每次批次状态更新，`statusVersion` 自动递增：

```
QUEUED (v1) → RUNNING (v2) → PARTIAL_SUCCESS (v3)
```

### 客户端去重

客户端缓存 `lastStatusVersion`，只处理新版本：

```typescript
if (event.statusVersion <= lastStatusVersion) {
  return // 忽略重复事件
}
lastStatusVersion = event.statusVersion
```

## API 端点

```
GET /api/creative/batches/:batchId/events
```

**认证**：需要 NextAuth session
**权限**：需要对批次所属商家有访问权限

## 事件类型

### 1. batch-status

批次状态更新：

```json
{
  "batchId": "cmgl...",
  "status": "RUNNING",
  "statusVersion": 2,
  "startedAt": "2025-01-15T...",
  "completedAt": null,
  "errorCode": null,
  "errorMessage": null,
  "tokenUsage": null,
  "copyCount": 0,
  "timestamp": "2025-01-15T..."
}
```

### 2. complete

批次完成（SUCCEEDED/PARTIAL_SUCCESS/FAILED）：

```json
{
  "batchId": "cmgl...",
  "finalStatus": "PARTIAL_SUCCESS"
}
```

### 3. error

错误事件：

```json
{
  "message": "批次已被删除"
}
```

### 4. heartbeat

心跳（每30秒）：

```
: heartbeat
```

## 前端使用

### Hook 方式

```typescript
import { useBatchStatusSSE } from '@/hooks/use-batch-status-sse'

function BatchMonitor({ batchId }: { batchId: string }) {
  const { status, isConnected, error } = useBatchStatusSSE({
    batchId,
    enabled: true,
    onStatusUpdate: (event) => {
      console.log('状态更新:', event.status, event.copyCount)
    },
    onComplete: (event) => {
      console.log('批次完成:', event.finalStatus)
    },
    onError: (err) => {
      console.error('SSE 错误:', err)
    }
  })

  return (
    <div>
      {isConnected && <Badge>实时连接</Badge>}
      {status && (
        <div>
          <p>状态: {status.status}</p>
          <p>文案: {status.copyCount}/5</p>
        </div>
      )}
    </div>
  )
}
```

### 原生 EventSource

```typescript
const eventSource = new EventSource(
  `/api/creative/batches/${batchId}/events`
)

let lastStatusVersion = 0

eventSource.addEventListener('batch-status', (e) => {
  const data = JSON.parse(e.data)
  
  if (data.statusVersion <= lastStatusVersion) {
    return // 去重
  }
  
  lastStatusVersion = data.statusVersion
  console.log('状态:', data.status, data.copyCount)
})

eventSource.addEventListener('complete', (e) => {
  const data = JSON.parse(e.data)
  console.log('完成:', data.finalStatus)
  eventSource.close()
})
```

## 状态流转

### 正常流程（5条文案）

```
QUEUED (v1)
  ↓ Worker 开始
RUNNING (v2)
  ↓ 生成完成
SUCCEEDED (v3) - 5/5 文案
  ↓ SSE complete 事件
[连接关闭]
```

### 部分成功（3条文案）

```
QUEUED (v1)
  ↓ Worker 开始
RUNNING (v2)
  ↓ 生成完成
PARTIAL_SUCCESS (v3) - 3/5 文案
  ↓ SSE complete 事件
[连接关闭]
```

### 失败

```
QUEUED (v1)
  ↓ Worker 开始
RUNNING (v2)
  ↓ 错误
FAILED (v3) - 0/5 文案
  ↓ SSE complete 事件
[连接关闭]
```

## 性能特性

- **轮询间隔**：1秒
- **心跳间隔**：30秒
- **自动关闭**：批次完成时
- **去重机制**：statusVersion 客户端缓存

## 测试

运行测试脚本：

```bash
npx tsx scripts/test-batch-sse.ts
```

测试会：
1. 创建测试批次
2. 连接 SSE（模拟监听）
3. 触发 Worker 生成
4. 验证状态流转
5. 验证 statusVersion 递增
6. 验证去重机制

## 错误处理

### 连接失败

- 检查认证 token
- 检查商家访问权限
- 检查批次是否存在

### 事件丢失

- 客户端使用 statusVersion 去重，不会处理重复事件
- 服务器每次推送都包含完整状态，丢失事件不影响最终状态

### 网络中断

- EventSource 会自动重连
- 重连后立即接收最新状态

## 最佳实践

1. **总是检查 statusVersion**
   ```typescript
   if (event.statusVersion <= lastStatusVersion) return
   ```

2. **监听 complete 事件**
   ```typescript
   eventSource.addEventListener('complete', () => {
     eventSource.close() // 避免无效连接
   })
   ```

3. **错误恢复**
   ```typescript
   eventSource.onerror = () => {
     if (eventSource.readyState === EventSource.CLOSED) {
       // 服务器主动关闭，正常
     } else {
       // 网络错误，会自动重连
     }
   }
   ```

4. **清理连接**
   ```typescript
   useEffect(() => {
     return () => {
       eventSource.close()
     }
   }, [])
   ```
