# 智点AI平台 - 5周详细学习计划（续）

> 本文档是《5周详细学习计划.md》的续篇，包含Week 3-5的详细内容

---

# Week 3：前端架构深入（42小时）

## Day 15-17：React Query深入（18小时）

### Day 15：React Query核心概念（6小时）

#### 上午（3小时）：基础概念

**学习内容：**
1. React Query架构
2. 查询（Queries）vs 变更（Mutations）
3. 缓存和失效策略
4. 自动重试和后台刷新

**推荐资源：**
- React Query文档：https://tanstack.com/query/latest/docs/framework/react/overview
- 视频教程：React Query in 100 Seconds

**核心概念：**
```typescript
// React Query的核心思想：服务器状态管理

// 1. 查询（Queries）- 获取数据
const { data, isLoading, error } = useQuery({
  queryKey: ['todos'],              // 唯一标识
  queryFn: () => fetch('/api/todos').then(r => r.json()), // 获取函数
  staleTime: 60000,                 // 1分钟内认为数据新鲜
  gcTime: 300000,                   // 5分钟后清除缓存
  retry: 3,                         // 失败重试3次
  refetchOnWindowFocus: true        // 窗口聚焦时重新获取
})

// 2. 变更（Mutations）- 修改数据
const mutation = useMutation({
  mutationFn: (newTodo) => fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify(newTodo)
  }),
  onSuccess: () => {
    // 使查询缓存失效，触发重新获取
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  }
})

// 3. 缓存管理
queryClient.setQueryData(['todos'], newData)  // 手动更新缓存
queryClient.invalidateQueries(['todos'])      // 使缓存失效
queryClient.removeQueries(['todos'])          // 删除缓存
```

**实践任务：创建简单的React Query示例**
```typescript
// app/learn-react-query/page.tsx

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

interface Todo {
  id: string
  text: string
  completed: boolean
}

export default function LearnReactQueryPage() {
  const [input, setInput] = useState('')
  const queryClient = useQueryClient()

  // 查询todos
  const { data: todos, isLoading, error } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const res = await fetch('/api/todos')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json() as Promise<{ todos: Todo[] }>
    },
    staleTime: 60000 // 1分钟内不会重新请求
  })

  // 添加todo mutation
  const addMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      return res.json()
    },
    onSuccess: () => {
      // 方式1：使缓存失效，触发重新获取
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    }
  })

  // 删除todo mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    }
  })

  const handleAdd = () => {
    if (input.trim()) {
      addMutation.mutate(input)
      setInput('')
    }
  }

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h1>React Query学习</h1>

      <div>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="New todo"
        />
        <button
          onClick={handleAdd}
          disabled={addMutation.isPending}
        >
          {addMutation.isPending ? 'Adding...' : 'Add'}
        </button>
      </div>

      <ul>
        {todos?.todos.map(todo => (
          <li key={todo.id}>
            {todo.text}
            <button
              onClick={() => deleteMutation.mutate(todo.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {/* 调试信息 */}
      <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0' }}>
        <h3>调试信息</h3>
        <p>查询状态: {isLoading ? 'Loading' : 'Success'}</p>
        <p>Todos数量: {todos?.todos.length}</p>
        <p>添加状态: {addMutation.isPending ? 'Pending' : 'Idle'}</p>
      </div>
    </div>
  )
}
```

#### 下午（3小时）：queryKey设计

**核心概念：queryKey是缓存的唯一标识**
```typescript
// queryKey设计原则

// 1. 层级结构
const todoKeys = {
  all: ['todos'],                          // 所有todos相关
  lists: () => [...todoKeys.all, 'list'],  // todos列表
  list: (filters) => [...todoKeys.lists(), filters], // 带过滤的列表
  details: () => [...todoKeys.all, 'detail'], // todo详情
  detail: (id) => [...todoKeys.details(), id]  // 单个todo详情
}

// 使用示例
useQuery({ queryKey: todoKeys.lists(), ... })
useQuery({ queryKey: todoKeys.list({ status: 'active' }), ... })
useQuery({ queryKey: todoKeys.detail('123'), ... })

// 2. 使缓存失效的不同级别
queryClient.invalidateQueries({ queryKey: todoKeys.all })      // 所有todos
queryClient.invalidateQueries({ queryKey: todoKeys.lists() })  // 所有列表
queryClient.invalidateQueries({ queryKey: todoKeys.detail('123') }) // 单个todo
```

**实践任务：设计对话查询的queryKey**
```typescript
// hooks/api/conversation-keys.ts

export const conversationKeys = {
  // 所有对话相关
  all: ['conversations'] as const,

  // 对话列表
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (params?: { limit?: number; offset?: number }) =>
    [...conversationKeys.lists(), params] as const,

  // 对话摘要列表
  summaries: () => [...conversationKeys.lists(), 'summary'] as const,
  summary: (params?: any) =>
    [...conversationKeys.summaries(), params] as const,

  // 对话详情
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) =>
    [...conversationKeys.details(), id] as const,

  // 对话消息
  messages: (conversationId: string) =>
    [...conversationKeys.detail(conversationId), 'messages'] as const
}

// 使用示例
export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.summary(),
    queryFn: () => fetch('/api/conversations').then(r => r.json())
  })
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: () => fetch(`/api/conversations/${id}`).then(r => r.json())
  })
}
```

**验证标准：**
- [ ] 能解释queryKey的作用
- [ ] 能设计层级化的queryKey结构
- [ ] 能理解缓存失效的不同级别

---

### Day 16：乐观更新和缓存同步（6小时）

#### 上午（3小时）：乐观更新

**核心概念：先更新UI，再发送请求**
```typescript
// 乐观更新示例

const toggleMutation = useMutation({
  mutationFn: async (id: string) => {
    await fetch(`/api/todos/${id}/toggle`, { method: 'PATCH' })
  },

  // 乐观更新
  onMutate: async (id) => {
    // 1. 取消正在进行的查询，避免覆盖乐观更新
    await queryClient.cancelQueries({ queryKey: ['todos'] })

    // 2. 保存当前数据快照（用于回滚）
    const previousTodos = queryClient.getQueryData(['todos'])

    // 3. 乐观更新缓存
    queryClient.setQueryData(['todos'], (old: Todo[]) => {
      return old.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    })

    // 4. 返回上下文（用于回滚）
    return { previousTodos }
  },

  // 错误时回滚
  onError: (err, id, context) => {
    if (context?.previousTodos) {
      queryClient.setQueryData(['todos'], context.previousTodos)
    }
  },

  // 成功或失败后都重新获取
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  }
})
```

**实践任务：实现乐观更新的Todo应用**
```typescript
// app/optimistic-todos/page.tsx

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function OptimisticTodosPage() {
  const queryClient = useQueryClient()

  const { data: todos } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const res = await fetch('/api/todos')
      return res.json()
    }
  })

  // 乐观更新：切换完成状态
  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 模拟网络延迟
      await fetch(`/api/todos/${id}/toggle`, { method: 'PATCH' })
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] })
      const previous = queryClient.getQueryData(['todos'])

      // 立即更新UI
      queryClient.setQueryData(['todos'], (old: any) => ({
        ...old,
        todos: old.todos.map((todo: any) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      }))

      return { previous }
    },

    onError: (err, id, context) => {
      // 回滚
      queryClient.setQueryData(['todos'], context?.previous)
      alert('操作失败，已回滚')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    }
  })

  return (
    <div>
      <h1>乐观更新示例</h1>
      <p>点击checkbox，注意UI立即更新（无需等待服务器响应）</p>

      <ul>
        {todos?.todos.map((todo: any) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleMutation.mutate(todo.id)}
            />
            {todo.text}
            {toggleMutation.isPending && toggleMutation.variables === todo.id && (
              <span> (保存中...)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

#### 下午（3小时）：项目中的缓存同步问题

**核心问题：删除对话后刷新页面数据恢复**

**错误示例：**
```typescript
// hooks/api/use-conversation-mutations.ts (错误版本)

const deleteMutation = useMutation({
  mutationFn: async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
  },
  onSuccess: (_, id) => {
    // ❌ 错误：只更新精确匹配的查询
    queryClient.setQueryData(
      { queryKey: ['conversations', 'list'] },
      (old: Conversation[]) => old.filter(c => c.id !== id)
    )
  }
})

// 问题：如果查询Key是 ['conversations', 'list', 'summary', { params }]
// 那么这个更新不会生效，因为Key不匹配
```

**正确示例：使用predicate匹配**
```typescript
// hooks/api/use-conversation-mutations.ts (正确版本)

const deleteMutation = useMutation({
  mutationFn: async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
  },
  onSuccess: (_, id) => {
    // ✅ 正确：使用predicate匹配所有相关查询
    queryClient.setQueriesData(
      {
        predicate: (query) =>
          query.queryKey[0] === 'conversations' &&
          query.queryKey[1] === 'list'
      },
      (old: any) => {
        if (!old?.conversations) return old
        return {
          ...old,
          conversations: old.conversations.filter((c: any) => c.id !== id)
        }
      }
    )

    // 同时使缓存失效
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === 'conversations'
    })
  }
})
```

**实践任务：修复项目中的缓存问题**
```bash
# 打开项目文件
code hooks/api/use-conversation-mutations.ts
```

**任务清单：**
- [ ] 找到所有使用 `setQueryData` 的地方
- [ ] 检查是否使用精确匹配的queryKey
- [ ] 改为使用 `setQueriesData` + `predicate`
- [ ] 测试删除对话后刷新是否还会恢复

**验证标准：**
- [ ] 能解释乐观更新的原理和好处
- [ ] 能实现带回滚的乐观更新
- [ ] 能解释缓存Key不匹配的问题
- [ ] 能使用predicate修复缓存同步问题

---

### Day 17：项目中的React Query实践（6小时）

#### 上午（3小时）：阅读项目查询Hooks

**实践任务：**
```bash
# 打开项目的React Query Hooks
code hooks/api/use-conversations-query.ts
code hooks/api/use-conversation-mutations.ts
```

**详细阅读并添加注释：**
```typescript
// hooks/api/use-conversations-query.ts

import { useQuery } from '@tanstack/react-query'
import { conversationKeys } from './conversation-keys'

// 获取对话列表（摘要模式）
export function useConversations(params?: {
  limit?: number
  offset?: number
}) {
  return useQuery({
    // queryKey包含参数，确保不同参数的查询独立缓存
    queryKey: conversationKeys.summary(params),

    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.offset) searchParams.set('offset', String(params.offset))

      const url = `/api/conversations?${searchParams}`
      const res = await fetch(url)

      if (!res.ok) {
        throw new Error('Failed to fetch conversations')
      }

      return res.json()
    },

    // 配置选项
    staleTime: 60000,           // 1分钟内认为数据新鲜
    gcTime: 300000,             // 5分钟后清除缓存
    refetchOnWindowFocus: true  // 窗口聚焦时重新获取
  })
}

// 获取单个对话详情
export function useConversation(id: string) {
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${id}`)
      if (!res.ok) throw new Error('Failed to fetch conversation')
      return res.json()
    },
    enabled: !!id, // 只有id存在时才执行查询
    staleTime: 30000
  })
}
```

```typescript
// hooks/api/use-conversation-mutations.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { conversationKeys } from './conversation-keys'

// 创建对话
export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      })
      return res.json()
    },

    onSuccess: (newConversation) => {
      // 方式1：使缓存失效，触发重新获取
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })

      // 方式2：直接更新缓存（乐观更新）
      queryClient.setQueriesData(
        {
          predicate: (query) =>
            query.queryKey[0] === 'conversations' &&
            query.queryKey[1] === 'list'
        },
        (old: any) => {
          if (!old?.conversations) return old
          return {
            ...old,
            conversations: [newConversation, ...old.conversations]
          }
        }
      )
    }
  })
}

// 更新对话
export function useUpdateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      return res.json()
    },

    onSuccess: (updated, { id }) => {
      // 更新详情缓存
      queryClient.setQueryData(
        conversationKeys.detail(id),
        updated
      )

      // 更新列表缓存
      queryClient.setQueriesData(
        {
          predicate: (query) =>
            query.queryKey[0] === 'conversations' &&
            query.queryKey[1] === 'list'
        },
        (old: any) => {
          if (!old?.conversations) return old
          return {
            ...old,
            conversations: old.conversations.map((c: any) =>
              c.id === id ? { ...c, ...updated } : c
            )
          }
        }
      )
    }
  })
}

// 删除对话
export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete')
    },

    onSuccess: (_, id) => {
      // 删除详情缓存
      queryClient.removeQueries({
        queryKey: conversationKeys.detail(id)
      })

      // 更新列表缓存（使用predicate）
      queryClient.setQueriesData(
        {
          predicate: (query) =>
            query.queryKey[0] === 'conversations' &&
            query.queryKey[1] === 'list'
        },
        (old: any) => {
          if (!old?.conversations) return old
          return {
            ...old,
            conversations: old.conversations.filter((c: any) => c.id !== id)
          }
        }
      )

      // 使所有对话查询失效
      queryClient.invalidateQueries({
        queryKey: conversationKeys.all
      })
    }
  })
}
```

#### 下午（3小时）：实践测试

**任务1：测试查询缓存**
```typescript
// scripts/test-react-query-cache.tsx

// 创建一个测试页面
// app/test-rq-cache/page.tsx

'use client'

import { useConversations } from '@/hooks/api/use-conversations-query'
import { useQueryClient } from '@tanstack/react-query'

export default function TestCachePage() {
  const { data, isFetching } = useConversations()
  const queryClient = useQueryClient()

  return (
    <div>
      <h1>React Query缓存测试</h1>

      <button onClick={() => queryClient.invalidateQueries()}>
        使所有缓存失效
      </button>

      <button onClick={() => {
        queryClient.setQueryData(['test'], { value: Math.random() })
      }}>
        手动设置缓存
      </button>

      <div>
        <h2>当前状态</h2>
        <p>isFetching: {isFetching ? 'true' : 'false'}</p>
        <p>对话数量: {data?.conversations?.length || 0}</p>
      </div>

      <div>
        <h2>所有缓存</h2>
        <pre>
          {JSON.stringify(
            queryClient.getQueryCache().getAll().map(q => ({
              queryKey: q.queryKey,
              state: q.state.status
            })),
            null,
            2
          )}
        </pre>
      </div>
    </div>
  )
}
```

**任务2：测试mutation和缓存更新**
```bash
# 访问聊天页面
http://localhost:3007/chat

# 测试步骤：
# 1. 创建新对话 - 观察列表是否立即更新
# 2. 删除对话 - 观察列表是否立即更新
# 3. 刷新页面 - 确认删除的对话不会恢复
# 4. 打开开发者工具 - React Query Devtools观察缓存
```

**验证标准：**
- [ ] 能理解项目中queryKey的设计
- [ ] 能理解项目中mutation的缓存更新策略
- [ ] 能使用React Query Devtools调试
- [ ] 能独立修复缓存同步问题

---

## Day 18-20：Reducer状态管理深入（18小时）

### Day 18：项目Reducer架构（6小时）

#### 上午（3小时）：chat-reducer深入

**实践任务：**
```bash
# 打开聊天Reducer
code components/chat/chat-reducer.ts
code types/chat.ts
```

**详细阅读State定义：**
```typescript
// types/chat.ts

// 聊天状态
export interface ChatState {
  // 核心状态
  messages: ChatMessage[]          // 消息列表
  isLoading: boolean               // 是否正在生成响应
  error: string | null             // 错误信息

  // Pipeline状态（抖音链接检测）
  pipelineStatus: PipelineStatus | null
  detectedLinks: DouyinLink[]

  // Session状态（会话管理）
  sessionState: SessionState
}

// 消息状态（新架构）
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'pending' | 'streaming' | 'completed' | 'error'  // ← 状态内联
  reasoning?: string
  createdAt: Date
  metadata?: Record<string, any>
}

// Action类型（联合类型）
export type ChatAction =
  // 发送用户消息
  | {
      type: 'SEND_USER_MESSAGE'
      payload: { message: ChatMessage }
    }
  // 更新流式消息（新架构，统一处理）
  | {
      type: 'UPDATE_MESSAGE_STREAM'
      payload: {
        id: string
        content?: string
        reasoning?: string
        status?: ChatMessage['status']
      }
    }
  // 删除消息
  | {
      type: 'REMOVE_MESSAGE'
      payload: { id: string }
    }
  // 设置错误
  | {
      type: 'SET_ERROR'
      payload: { error: string }
    }
  // ... 其他action类型
```

**详细阅读Reducer实现：**
```typescript
// components/chat/chat-reducer.ts

export function chatReducer(
  state: ChatState,
  action: ChatAction
): ChatState {
  switch (action.type) {
    // 发送用户消息
    case 'SEND_USER_MESSAGE': {
      return {
        ...state,
        messages: [...state.messages, action.payload.message],
        isLoading: true,
        error: null
      }
    }

    // 更新流式消息（新架构）
    case 'UPDATE_MESSAGE_STREAM': {
      const { id, content, reasoning, status } = action.payload

      return {
        ...state,
        messages: state.messages.map(msg => {
          if (msg.id !== id) return msg

          // 更新匹配的消息
          return {
            ...msg,
            ...(content !== undefined && { content: msg.content + content }),
            ...(reasoning !== undefined && {
              reasoning: (msg.reasoning || '') + reasoning
            }),
            ...(status !== undefined && { status })
          }
        }),
        isLoading: status !== 'completed' && status !== 'error'
      }
    }

    // 删除消息
    case 'REMOVE_MESSAGE': {
      return {
        ...state,
        messages: state.messages.filter(msg => msg.id !== action.payload.id)
      }
    }

    // 设置错误
    case 'SET_ERROR': {
      return {
        ...state,
        error: action.payload.error,
        isLoading: false
      }
    }

    default:
      return state
  }
}

// 初始状态
export const initialChatState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
  pipelineStatus: null,
  detectedLinks: [],
  sessionState: 'idle'
}
```

#### 下午（3小时）：理解状态转换

**画出消息状态转换图：**
```
用户发送消息
  ↓
SEND_USER_MESSAGE action
  ├─ 添加用户消息（status: 'completed'）
  └─ isLoading = true
  ↓
前端调用API
  ↓
接收started事件
  ↓
SEND_USER_MESSAGE action
  └─ 添加助手消息（status: 'pending'）
  ↓
接收chunk事件
  ↓
UPDATE_MESSAGE_STREAM action
  ├─ content: 追加内容
  └─ status: 'streaming'
  ↓
继续接收chunk...
  ↓
接收done事件
  ↓
UPDATE_MESSAGE_STREAM action
  ├─ status: 'completed'
  └─ isLoading = false

错误场景：
接收error事件
  ↓
UPDATE_MESSAGE_STREAM action
  ├─ status: 'error'
  ├─ isLoading = false
  └─ error = 错误信息
```

**实践任务：编写Reducer测试**
```typescript
// components/chat/__tests__/chat-reducer.test.ts

import { describe, it, expect } from 'vitest'
import { chatReducer, initialChatState } from '../chat-reducer'
import { ChatMessage } from '@/types/chat'

describe('chatReducer', () => {
  it('应该添加用户消息', () => {
    const userMessage: ChatMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      status: 'completed',
      createdAt: new Date()
    }

    const newState = chatReducer(initialChatState, {
      type: 'SEND_USER_MESSAGE',
      payload: { message: userMessage }
    })

    expect(newState.messages).toHaveLength(1)
    expect(newState.messages[0]).toEqual(userMessage)
    expect(newState.isLoading).toBe(true)
  })

  it('应该更新流式消息内容', () => {
    const initialMessage: ChatMessage = {
      id: 'msg-2',
      role: 'assistant',
      content: 'Hello',
      status: 'streaming',
      createdAt: new Date()
    }

    const stateWithMessage = {
      ...initialChatState,
      messages: [initialMessage]
    }

    const newState = chatReducer(stateWithMessage, {
      type: 'UPDATE_MESSAGE_STREAM',
      payload: {
        id: 'msg-2',
        content: ' World'
      }
    })

    expect(newState.messages[0].content).toBe('Hello World')
    expect(newState.messages[0].status).toBe('streaming')
  })

  it('应该更新消息状态为completed', () => {
    const initialMessage: ChatMessage = {
      id: 'msg-2',
      role: 'assistant',
      content: 'Hello World',
      status: 'streaming',
      createdAt: new Date()
    }

    const stateWithMessage = {
      ...initialChatState,
      messages: [initialMessage],
      isLoading: true
    }

    const newState = chatReducer(stateWithMessage, {
      type: 'UPDATE_MESSAGE_STREAM',
      payload: {
        id: 'msg-2',
        status: 'completed'
      }
    })

    expect(newState.messages[0].status).toBe('completed')
    expect(newState.isLoading).toBe(false)
  })

  it('应该删除消息', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        status: 'completed',
        createdAt: new Date()
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi',
        status: 'completed',
        createdAt: new Date()
      }
    ]

    const stateWithMessages = {
      ...initialChatState,
      messages
    }

    const newState = chatReducer(stateWithMessages, {
      type: 'REMOVE_MESSAGE',
      payload: { id: 'msg-1' }
    })

    expect(newState.messages).toHaveLength(1)
    expect(newState.messages[0].id).toBe('msg-2')
  })
})
```

**运行测试：**
```bash
npx vitest components/chat/__tests__/chat-reducer.test.ts
```

**验证标准：**
- [ ] 能解释ChatState的每个字段的作用
- [ ] 能画出消息状态转换图
- [ ] 能解释为什么使用联合类型定义Action
- [ ] 能编写Reducer的单元测试

---

### Day 19：在组件中使用Reducer（6小时）

#### 上午（3小时）：阅读聊天组件

**实践任务：**
```bash
# 打开聊天组件（使用Reducer的示例）
code app/chat/[id]/page.tsx
code components/chat/smart-chat-center.tsx
```

**理解组件中的Reducer使用：**
```typescript
// 简化的聊天组件示例

'use client'

import { useReducer, useEffect } from 'react'
import { chatReducer, initialChatState } from '@/components/chat/chat-reducer'
import { useChatActions } from '@/hooks/use-chat-actions'

export default function ChatPage({ params }: { params: { id: string } }) {
  // 使用Reducer管理状态
  const [state, dispatch] = useReducer(chatReducer, initialChatState)

  // 使用自定义Hook处理聊天操作
  const { sendMessage, abortMessage } = useChatActions({
    conversationId: params.id,

    // 事件回调：将事件转换为action
    onEvent: (event) => {
      switch (event.type) {
        case 'started':
          // API开始响应：添加pending消息
          dispatch({
            type: 'SEND_USER_MESSAGE',
            payload: {
              message: {
                id: event.messageId,
                role: 'assistant',
                content: '',
                status: 'pending',
                createdAt: new Date()
              }
            }
          })
          break

        case 'chunk':
          // 接收内容chunk：更新流式内容
          dispatch({
            type: 'UPDATE_MESSAGE_STREAM',
            payload: {
              id: event.messageId,
              content: event.content,
              reasoning: event.reasoning,
              status: 'streaming'
            }
          })
          break

        case 'done':
          // 完成：标记为completed
          dispatch({
            type: 'UPDATE_MESSAGE_STREAM',
            payload: {
              id: event.messageId,
              status: 'completed'
            }
          })
          break

        case 'error':
          // 错误：标记为error
          dispatch({
            type: 'UPDATE_MESSAGE_STREAM',
            payload: {
              id: event.messageId,
              status: 'error'
            }
          })
          dispatch({
            type: 'SET_ERROR',
            payload: { error: event.error }
          })
          break
      }
    }
  })

  // 发送消息处理
  const handleSend = async (content: string) => {
    // 1. 添加用户消息
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content,
      status: 'completed' as const,
      createdAt: new Date()
    }

    dispatch({
      type: 'SEND_USER_MESSAGE',
      payload: { message: userMessage }
    })

    // 2. 调用API
    await sendMessage({
      messages: [...state.messages, userMessage],
      modelId: 'claude-3-5-haiku-20241022'
    })
  }

  return (
    <div>
      {/* 消息列表 */}
      <div>
        {state.messages.map(message => (
          <div key={message.id}>
            <strong>{message.role}:</strong> {message.content}
            {message.status === 'streaming' && <span> ▋</span>}
            {message.status === 'error' && <span> ❌</span>}
          </div>
        ))}
      </div>

      {/* 错误提示 */}
      {state.error && <div>错误: {state.error}</div>}

      {/* 输入框 */}
      <input
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleSend(e.currentTarget.value)
            e.currentTarget.value = ''
          }
        }}
        disabled={state.isLoading}
      />

      {/* 中止按钮 */}
      {state.isLoading && (
        <button onClick={abortMessage}>中止</button>
      )}
    </div>
  )
}
```

#### 下午（3小时）：实践练习

**任务1：添加新的Action类型**
```typescript
// 需求：添加"清空所有消息"功能

// 1. 在types/chat.ts中添加Action类型
export type ChatAction =
  | ... // 现有类型
  | {
      type: 'CLEAR_ALL_MESSAGES'
    }

// 2. 在chat-reducer.ts中添加处理
case 'CLEAR_ALL_MESSAGES': {
  return {
    ...state,
    messages: [],
    error: null,
    isLoading: false
  }
}

// 3. 在组件中使用
<button onClick={() => dispatch({ type: 'CLEAR_ALL_MESSAGES' })}>
  清空对话
</button>
```

**任务2：添加消息编辑功能**
```typescript
// 需求：编辑已发送的消息

// 1. 添加Action类型
| {
    type: 'EDIT_MESSAGE'
    payload: {
      id: string
      content: string
    }
  }

// 2. 添加Reducer处理
case 'EDIT_MESSAGE': {
  return {
    ...state,
    messages: state.messages.map(msg =>
      msg.id === action.payload.id
        ? { ...msg, content: action.payload.content }
        : msg
    )
  }
}

// 3. 组件中使用
const [editingId, setEditingId] = useState<string | null>(null)

{message.id === editingId ? (
  <input
    defaultValue={message.content}
    onBlur={(e) => {
      dispatch({
        type: 'EDIT_MESSAGE',
        payload: {
          id: message.id,
          content: e.target.value
        }
      })
      setEditingId(null)
    }}
  />
) : (
  <span onClick={() => setEditingId(message.id)}>
    {message.content}
  </span>
)}
```

**验证标准：**
- [ ] 能理解组件中Reducer的使用模式
- [ ] 能理解事件回调如何转换为action
- [ ] 能独立添加新的action类型
- [ ] 能实现简单的消息操作功能

---

### Day 20：Reducer最佳实践（6小时）

#### 上午（3小时）：Reducer设计原则

**核心原则：**

1. **纯函数**
```typescript
// ✅ 好：纯函数
function reducer(state, action) {
  return { ...state, count: state.count + 1 }
}

// ❌ 坏：修改原对象
function badReducer(state, action) {
  state.count += 1  // 直接修改！
  return state
}
```

2. **不可变更新**
```typescript
// ✅ 好：使用展开运算符
return {
  ...state,
  messages: [...state.messages, newMessage]
}

// ❌ 坏：直接push
state.messages.push(newMessage)
return state
```

3. **原子性Action**
```typescript
// ✅ 好：单一职责
{ type: 'ADD_MESSAGE', payload: { message } }
{ type: 'UPDATE_MESSAGE', payload: { id, content } }

// ❌ 坏：复合操作
{ type: 'ADD_AND_UPDATE', payload: { message1, message2 } }
```

4. **类型安全**
```typescript
// ✅ 好：联合类型
type Action =
  | { type: 'ADD'; payload: number }
  | { type: 'SUBTRACT'; payload: number }

// 编译时检查
function reducer(state: number, action: Action) {
  switch (action.type) {
    case 'ADD':
      return state + action.payload  // ✅ payload是number
    case 'SUBTRACT':
      return state - action.payload
    default:
      return state
  }
}
```

#### 下午（3小时）：性能优化

**优化1：避免不必要的重渲染**
```typescript
// 使用React.memo避免子组件重渲染
const MessageItem = React.memo(({ message }: { message: ChatMessage }) => {
  console.log('MessageItem render:', message.id)
  return (
    <div>
      {message.role}: {message.content}
    </div>
  )
})

// 组件中
{state.messages.map(message => (
  <MessageItem key={message.id} message={message} />
))}
```

**优化2：使用useCallback稳定引用**
```typescript
// ❌ 坏：每次渲染都创建新函数
<button onClick={() => dispatch({ type: 'ADD' })}>Add</button>

// ✅ 好：使用useCallback
const handleAdd = useCallback(() => {
  dispatch({ type: 'ADD' })
}, [])

<button onClick={handleAdd}>Add</button>
```

**优化3：分离状态**
```typescript
// ❌ 坏：所有状态在一个Reducer中
const [state, dispatch] = useReducer(bigReducer, {
  messages: [],
  ui: { theme: 'dark', sidebar: true },
  user: { name: '...', ... },
  settings: { ... }
})

// ✅ 好：按功能分离
const [chatState, chatDispatch] = useReducer(chatReducer, initialChatState)
const [uiState, uiDispatch] = useReducer(uiReducer, initialUIState)
```

**实践任务：性能分析**
```typescript
// 创建性能测试页面
// app/test-reducer-performance/page.tsx

'use client'

import { useReducer, useState, useCallback, memo } from 'react'

// 简单的计数器Reducer
type CounterAction =
  | { type: 'INCREMENT' }
  | { type: 'DECREMENT' }
  | { type: 'RESET' }

function counterReducer(state: number, action: CounterAction): number {
  switch (action.type) {
    case 'INCREMENT':
      return state + 1
    case 'DECREMENT':
      return state - 1
    case 'RESET':
      return 0
    default:
      return state
  }
}

// 未优化的子组件
function SlowComponent({ count }: { count: number }) {
  console.log('SlowComponent render')

  // 模拟慢速计算
  const expensiveCalculation = () => {
    let result = 0
    for (let i = 0; i < 100000000; i++) {
      result += i
    }
    return result
  }

  const result = expensiveCalculation()

  return (
    <div>
      Count: {count}, Result: {result}
    </div>
  )
}

// 优化的子组件
const FastComponent = memo(({ count }: { count: number }) => {
  console.log('FastComponent render')
  return <div>Count: {count}</div>
})

export default function TestPerformancePage() {
  const [count, dispatch] = useReducer(counterReducer, 0)
  const [showSlow, setShowSlow] = useState(false)

  const handleIncrement = useCallback(() => {
    dispatch({ type: 'INCREMENT' })
  }, [])

  return (
    <div>
      <h1>Reducer性能测试</h1>

      <button onClick={handleIncrement}>Increment</button>
      <button onClick={() => dispatch({ type: 'DECREMENT' })}>Decrement</button>
      <button onClick={() => dispatch({ type: 'RESET' })}>Reset</button>

      <p>Count: {count}</p>

      <button onClick={() => setShowSlow(!showSlow)}>
        Toggle {showSlow ? 'Fast' : 'Slow'} Component
      </button>

      {showSlow ? (
        <SlowComponent count={count} />
      ) : (
        <FastComponent count={count} />
      )}

      <p>
        打开控制台查看渲染日志。<br />
        SlowComponent会在每次count变化时重新计算。<br />
        FastComponent使用React.memo，只在count变化时重渲染。
      </p>
    </div>
  )
}
```

**验证标准：**
- [ ] 能解释Reducer的三个原则（纯函数、不可变、确定性）
- [ ] 能识别和修复不正确的Reducer实现
- [ ] 能使用React.memo和useCallback优化性能
- [ ] 能使用React DevTools Profiler分析性能

**Week 3 总结：**
- [ ] 深入掌握React Query的查询和缓存策略
- [ ] 理解乐观更新和缓存同步
- [ ] 完全理解项目的Reducer架构
- [ ] 能优化Reducer的性能

---

# Week 4：高级主题（42小时）

## Day 22-24：SSE流式处理深入（18小时）

### Day 22：SSE解析器详解（6小时）

#### 上午（3小时）：SSE协议深入

**学习内容：**
1. SSE事件格式
2. 跨chunk数据处理
3. UTF-8多字节字符处理
4. 错误恢复

**SSE协议规范：**
```
事件格式：
event: eventType
data: eventData
id: uniqueId
retry: retryTime

[空行表示事件结束]

示例：
event: message
data: {"content":"Hello"}

event: message
data: {"content":" World"}

event: done
data: {}

[空行]
```

**核心问题：跨chunk数据**
```typescript
// 问题：数据可能在chunk边界被截断

// Chunk 1: "data: {\"conte"
// Chunk 2: "nt\":\"Hello\"}\n\n"

// 需要缓存不完整的行，等待下一个chunk
```

**实践任务：**
```bash
# 打开SSE解析器
code lib/utils/sse-parser.ts
```

**详细阅读并添加注释：**
```typescript
// lib/utils/sse-parser.ts

export function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = []
  const lines = chunk.split('\n')

  let currentEvent: Partial<SSEEvent> = {}

  for (const line of lines) {
    // 空行表示事件结束
    if (line.trim() === '') {
      if (currentEvent.data) {
        events.push(currentEvent as SSEEvent)
        currentEvent = {}
      }
      continue
    }

    // 解析字段
    if (line.startsWith('event: ')) {
      currentEvent.event = line.slice(7)
    } else if (line.startsWith('data: ')) {
      const data = line.slice(6)
      try {
        currentEvent.data = JSON.parse(data)
      } catch {
        currentEvent.data = data
      }
    } else if (line.startsWith('id: ')) {
      currentEvent.id = line.slice(4)
    }
  }

  return events
}

// 处理跨chunk数据的高级解析器
export class SSEParser {
  private buffer = ''  // 缓存不完整的行

  parse(chunk: string): SSEEvent[] {
    // 将新chunk追加到buffer
    this.buffer += chunk

    const events: SSEEvent[] = []
    const lines = this.buffer.split('\n')

    // 保留最后一行（可能不完整）
    this.buffer = lines.pop() || ''

    let currentEvent: Partial<SSEEvent> = {}

    for (const line of lines) {
      if (line.trim() === '') {
        if (currentEvent.data) {
          events.push(currentEvent as SSEEvent)
          currentEvent = {}
        }
        continue
      }

      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        try {
          currentEvent.data = JSON.parse(data)
        } catch {
          currentEvent.data = data
        }
      }
    }

    return events
  }

  // 清空buffer
  reset() {
    this.buffer = ''
  }
}
```

#### 下午（3小时）：TransformStream实现

**核心概念：TransformStream**
```typescript
// TransformStream: 转换流数据的管道

const transformStream = new TransformStream({
  // 转换函数
  async transform(chunk, controller) {
    // 处理输入chunk
    const processed = processChunk(chunk)
    // 输出处理后的数据
    controller.enqueue(processed)
  },

  // 流结束时调用
  async flush(controller) {
    // 处理剩余数据
    controller.enqueue(finalData)
  }
})

// 使用
const response = await fetch(url)
const transformedStream = response.body.pipeThrough(transformStream)
```

**实践任务：创建SSE TransformStream**
```typescript
// lib/utils/sse-transform.ts

interface SSETransformOptions {
  onChunk?: (content: string, reasoning?: string) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

export function createSSETransformStream(options: SSETransformOptions) {
  const { onChunk, onComplete, onError } = options
  const parser = new SSEParser()
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new TransformStream({
    // 处理每个chunk
    async transform(chunk, controller) {
      try {
        // 解码chunk
        const text = decoder.decode(chunk, { stream: true })

        // 解析SSE事件
        const events = parser.parse(text)

        for (const event of events) {
          // 处理不同类型的事件
          if (event.data?.type === 'chunk') {
            const { content, reasoning } = event.data

            // 回调
            onChunk?.(content, reasoning)

            // 转发给客户端
            const sseData = `data: ${JSON.stringify(event.data)}\n\n`
            controller.enqueue(encoder.encode(sseData))
          }
          else if (event.data?.type === 'done') {
            onComplete?.()

            const sseData = `data: ${JSON.stringify({ type: 'done' })}\n\n`
            controller.enqueue(encoder.encode(sseData))
          }
          else if (event.data?.type === 'error') {
            onError?.(new Error(event.data.error))

            const sseData = `data: ${JSON.stringify(event.data)}\n\n`
            controller.enqueue(encoder.encode(sseData))
          }
        }
      } catch (error) {
        console.error('[SSE Transform] Error:', error)
        onError?.(error as Error)
      }
    },

    // 流结束时
    async flush(controller) {
      // 处理buffer中剩余的数据
      parser.reset()
      console.log('[SSE Transform] Stream ended')
    }
  })
}
```

**测试TransformStream：**
```typescript
// app/api/test-transform/route.ts

import { createSSETransformStream } from '@/lib/utils/sse-transform'

export async function GET() {
  let totalContent = ''

  // 创建模拟的AI响应流
  const mockStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const messages = ['Hello', ' ', 'World', '!']

      for (const msg of messages) {
        const sse = `data: ${JSON.stringify({ type: 'chunk', content: msg })}\n\n`
        controller.enqueue(encoder.encode(sse))
        await new Promise(r => setTimeout(r, 500))
      }

      const done = `data: ${JSON.stringify({ type: 'done' })}\n\n`
      controller.enqueue(encoder.encode(done))
      controller.close()
    }
  })

  // 应用Transform
  const transformStream = createSSETransformStream({
    onChunk: (content) => {
      totalContent += content
      console.log('[Transform] Chunk:', content)
    },
    onComplete: () => {
      console.log('[Transform] Complete:', totalContent)
    },
    onError: (error) => {
      console.error('[Transform] Error:', error)
    }
  })

  return new Response(
    mockStream.pipeThrough(transformStream),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    }
  )
}
```

**验证标准：**
- [ ] 能解释SSE协议的格式
- [ ] 能解释跨chunk数据处理的必要性
- [ ] 能理解TransformStream的工作原理
- [ ] 能创建简单的SSE TransformStream

---

### Day 23：前端流式处理（6小时）

#### 上午（3小时）：ReadableStream消费

**学习内容：**
1. ReadableStream API
2. 流式读取模式
3. AbortController取消流
4. 错误处理

**核心API：**
```typescript
// 获取ReadableStream
const response = await fetch(url)
const stream = response.body  // ReadableStream

// 获取Reader
const reader = stream.getReader()

// 读取循环
while (true) {
  const { done, value } = await reader.read()

  if (done) {
    console.log('Stream finished')
    break
  }

  // value是Uint8Array，需要解码
  const text = new TextDecoder().decode(value)
  console.log('Received:', text)
}
```

**实践任务：**
```bash
# 打开聊天Actions Hook
code hooks/use-chat-actions.ts
```

**详细阅读流式处理逻辑：**
```typescript
// hooks/use-chat-actions.ts (简化版)

export function useChatActions(options: ChatActionsOptions) {
  const { conversationId, onEvent } = options
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = async (params: SendMessageParams) => {
    const { messages, modelId, settings } = params

    // 创建AbortController（用于取消请求）
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      // 发送请求
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          conversationId,
          modelId,
          settings
        }),
        signal: abortController.signal  // ← 关联AbortController
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      // 获取ReadableStream
      const stream = response.body
      if (!stream) throw new Error('No response body')

      // 获取Reader
      const reader = stream.getReader()
      const decoder = new TextDecoder()

      // 生成消息ID
      const messageId = `assistant-${Date.now()}`

      // 触发started事件
      onEvent?.({ type: 'started', messageId })

      // 流式读取
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log('[Chat] Stream finished')
          break
        }

        // 解码chunk
        const chunk = decoder.decode(value, { stream: true })
        console.log('[Chat] Received chunk:', chunk)

        // 解析SSE事件
        const events = parseSSEChunk(chunk)

        for (const event of events) {
          if (event.data?.type === 'chunk') {
            // 触发chunk事件
            onEvent?.({
              type: 'chunk',
              messageId,
              content: event.data.content,
              reasoning: event.data.reasoning
            })
          }
          else if (event.data?.type === 'done') {
            // 触发done事件
            onEvent?.({ type: 'done', messageId })
          }
          else if (event.data?.type === 'error') {
            // 触发error事件
            onEvent?.({
              type: 'error',
              messageId,
              error: event.data.error
            })
          }
        }
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[Chat] Request aborted')
      } else {
        console.error('[Chat] Error:', error)
        onEvent?.({
          type: 'error',
          messageId: 'error',
          error: error.message
        })
      }
    } finally {
      abortControllerRef.current = null
    }
  }

  // 中止消息
  const abortMessage = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      console.log('[Chat] Aborted by user')
    }
  }

  return {
    sendMessage,
    abortMessage
  }
}
```

#### 下午（3小时）：错误处理和重试

**错误场景：**
1. 网络错误（断网）
2. 服务器错误（500）
3. 流式传输中断
4. 用户主动取消

**实践任务：增强错误处理**
```typescript
// hooks/use-chat-actions-enhanced.ts

export function useChatActionsEnhanced(options: ChatActionsOptions) {
  const { onEvent, maxRetries = 3 } = options
  const [retryCount, setRetryCount] = useState(0)

  const sendMessageWithRetry = async (params: SendMessageParams) => {
    let attempt = 0

    while (attempt < maxRetries) {
      try {
        await sendMessage(params)
        setRetryCount(0)  // 重置重试计数
        return
      } catch (error) {
        attempt++
        console.log(`[Chat] Attempt ${attempt}/${maxRetries} failed`)

        if (attempt >= maxRetries) {
          // 达到最大重试次数
          onEvent?.({
            type: 'error',
            messageId: 'error',
            error: `Failed after ${maxRetries} attempts: ${error.message}`
          })
          throw error
        }

        // 指数退避：1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000
        console.log(`[Chat] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  return {
    sendMessage: sendMessageWithRetry,
    retryCount
  }
}
```

**验证标准：**
- [ ] 能理解ReadableStream的读取循环
- [ ] 能理解AbortController的作用
- [ ] 能实现流式数据的错误处理
- [ ] 能实现带重试的流式请求

---

### Day 24：完整流式聊天实现（6小时）

**综合实践：从零实现简化版聊天**

#### 上午（3小时）：后端实现

```typescript
// app/api/simple-chat/route.ts

import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { message } = await req.json()

  // 创建ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      try {
        // 模拟AI响应（分chunk发送）
        const response = `You said: "${message}". This is a streaming response.`
        const words = response.split(' ')

        for (const word of words) {
          // 发送chunk事件
          const sse = `data: ${JSON.stringify({
            type: 'chunk',
            content: word + ' '
          })}\n\n`

          controller.enqueue(encoder.encode(sse))

          // 模拟延迟
          await new Promise(r => setTimeout(r, 200))
        }

        // 发送done事件
        const done = `data: ${JSON.stringify({ type: 'done' })}\n\n`
        controller.enqueue(encoder.encode(done))

        controller.close()

      } catch (error) {
        // 发送error事件
        const errorSSE = `data: ${JSON.stringify({
          type: 'error',
          error: error.message
        })}\n\n`
        controller.enqueue(encoder.encode(errorSSE))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

#### 下午（3小时）：前端实现

```typescript
// app/simple-chat/page.tsx

'use client'

import { useState, useRef } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'completed' | 'streaming'
}

export default function SimpleChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    // 添加用户消息
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      status: 'completed'
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // 创建AbortController
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // 创建助手消息（streaming状态）
    const assistantId = `assistant-${Date.now()}`
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'streaming'
    }

    setMessages(prev => [...prev, assistantMessage])

    try {
      // 发送请求
      const response = await fetch('/api/simple-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
        signal: abortController.signal
      })

      if (!response.ok) throw new Error('Request failed')

      // 流式读取
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No reader')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })

        // 解析SSE
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'chunk') {
              // 追加内容
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantId
                    ? { ...msg, content: msg.content + data.content }
                    : msg
                )
              )
            }
            else if (data.type === 'done') {
              // 标记为完成
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantId
                    ? { ...msg, status: 'completed' }
                    : msg
                )
              )
            }
            else if (data.type === 'error') {
              throw new Error(data.error)
            }
          }
        }
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Chat error:', error)
        alert('Error: ' + error.message)
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>简单流式聊天</h1>

      {/* 消息列表 */}
      <div style={{
        border: '1px solid #ccc',
        padding: '10px',
        minHeight: '400px',
        marginBottom: '20px'
      }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              marginBottom: '10px',
              padding: '10px',
              background: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
              borderRadius: '4px'
            }}
          >
            <strong>{msg.role}:</strong> {msg.content}
            {msg.status === 'streaming' && <span> ▋</span>}
          </div>
        ))}
      </div>

      {/* 输入区域 */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          disabled={isLoading}
          placeholder="输入消息..."
          style={{ flex: 1, padding: '8px' }}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          style={{ padding: '8px 16px' }}
        >
          {isLoading ? '发送中...' : '发送'}
        </button>
        {isLoading && (
          <button onClick={handleAbort} style={{ padding: '8px 16px' }}>
            中止
          </button>
        )}
      </div>
    </div>
  )
}
```

**测试清单：**
- [ ] 发送消息，观察流式显示
- [ ] 点击中止按钮，确认请求取消
- [ ] 断网测试，观察错误处理
- [ ] 快速连续发送，观察行为

**验证标准：**
- [ ] 能独立实现简单的流式聊天后端
- [ ] 能独立实现简单的流式聊天前端
- [ ] 能处理中止和错误场景
- [ ] 能解释完整的流式通信流程

---

## Day 25-27：并发控制和性能优化（18小时）

### Day 25：原子性操作深入（6小时）

#### 上午（3小时）：竞态条件案例

**核心概念：竞态条件（Race Condition）**

**案例1：经典的银行转账问题**
```typescript
// ❌ 错误：读-修改-写模式

async function transfer(fromId: string, toId: string, amount: number) {
  // 步骤1：读取余额
  const from = await db.user.findUnique({ where: { id: fromId } })
  const to = await db.user.findUnique({ where: { id: toId } })

  // 步骤2：检查余额
  if (from.balance < amount) {
    throw new Error('余额不足')
  }

  // 步骤3：更新余额
  await db.user.update({
    where: { id: fromId },
    data: { balance: from.balance - amount }
  })

  await db.user.update({
    where: { id: toId },
    data: { balance: to.balance + amount }
  })
}

// 问题：如果两个转账请求同时执行
// 请求A: 读取from.balance=1000 → 检查通过 → 更新为500
// 请求B: 读取from.balance=1000 → 检查通过 → 更新为500
// 结果：转账了两次，但余额只减少了一次！
```

**✅ 正确方案1：数据库事务 + 乐观锁**
```typescript
async function transferWithTransaction(
  fromId: string,
  toId: string,
  amount: number
) {
  await prisma.$transaction(async (tx) => {
    // 步骤1：锁定行（SELECT FOR UPDATE）
    const from = await tx.user.findUnique({
      where: { id: fromId }
    })

    if (from.balance < amount) {
      throw new Error('余额不足')
    }

    // 步骤2：原子性更新
    await tx.user.update({
      where: { id: fromId },
      data: { balance: { decrement: amount } }
    })

    await tx.user.update({
      where: { id: toId },
      data: { balance: { increment: amount } }
    })
  })
}
```

**✅ 正确方案2：条件更新**
```typescript
async function transferWithCondition(
  fromId: string,
  toId: string,
  amount: number
) {
  // 直接在WHERE子句中检查条件
  const result = await prisma.user.updateMany({
    where: {
      id: fromId,
      balance: { gte: amount }  // ← 原子性检查
    },
    data: {
      balance: { decrement: amount }
    }
  })

  // 如果count=0，说明余额不足或用户不存在
  if (result.count === 0) {
    throw new Error('余额不足或用户不存在')
  }

  // 更新接收方
  await prisma.user.update({
    where: { id: toId },
    data: { balance: { increment: amount } }
  })
}
```

#### 下午（3小时）：项目配额管理再分析

**实践任务：模拟并发请求**
```typescript
// scripts/test-concurrency.ts

import { quotaManager } from '../lib/security/quota-manager'
import { prisma } from '../lib/prisma'

async function testConcurrentReservations() {
  console.log('=== 并发配额预留测试 ===\n')

  // 创建测试用户（限额1000 tokens）
  const user = await prisma.user.create({
    data: {
      email: 'concurrency-test@test.com',
      displayName: '并发测试',
      monthlyTokenLimit: 1000,
      currentMonthUsage: 0
    }
  })

  console.log('创建测试用户，限额:', user.monthlyTokenLimit)

  // 模拟10个并发请求，每个请求200 tokens
  // 理论上只有5个能成功（5 * 200 = 1000）
  const requests = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    tokens: 200
  }))

  console.log('\n发起10个并发请求，每个200 tokens...')

  const results = await Promise.allSettled(
    requests.map(async (req) => {
      try {
        await quotaManager.reserveTokens(user.id, req.tokens)
        console.log(`✅ 请求${req.id}: 成功预留${req.tokens} tokens`)
        return { success: true, id: req.id }
      } catch (error) {
        console.log(`❌ 请求${req.id}: ${error.message}`)
        return { success: false, id: req.id }
      }
    })
  )

  // 统计结果
  const successful = results.filter(
    r => r.status === 'fulfilled' && r.value.success
  ).length

  const failed = results.filter(
    r => r.status === 'fulfilled' && !r.value.success
  ).length

  console.log('\n结果统计:')
  console.log(`成功: ${successful} 个`)
  console.log(`失败: ${failed} 个`)

  // 检查最终使用量
  const finalUser = await prisma.user.findUnique({ where: { id: user.id } })
  console.log(`\n最终使用量: ${finalUser?.currentMonthUsage}`)
  console.log(`预期: ${successful * 200}`)
  console.log(`一致性: ${finalUser?.currentMonthUsage === successful * 200 ? '✅' : '❌'}`)

  // 清理
  await prisma.user.delete({ where: { id: user.id } })
  console.log('\n测试完成，数据已清理')
}

testConcurrentReservations()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**运行测试：**
```bash
npx tsx scripts/test-concurrency.ts
```

**验证标准：**
- [ ] 能解释竞态条件的危害
- [ ] 能识别代码中的竞态条件
- [ ] 能使用事务或条件更新避免竞态
- [ ] 能通过并发测试验证原子性

---

### Day 26：性能监控和优化（6小时）

#### 上午（3小时）：React性能分析

**工具：React DevTools Profiler**

**实践任务：**
1. 安装React DevTools浏览器扩展
2. 打开聊天页面
3. 开启Profiler录制
4. 发送几条消息
5. 停止录制，分析结果

**关注指标：**
- Commit duration（提交耗时）
- 组件渲染次数
- 渲染耗时最长的组件

**常见性能问题：**

**问题1：不必要的重渲染**
```typescript
// ❌ 坏：每次父组件渲染都会重渲染子组件
function Parent() {
  const [count, setCount] = useState(0)
  const [name, setName] = useState('')

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <input value={name} onChange={e => setName(e.target.value)} />
      <ExpensiveChild />  {/* ← 每次都重渲染！ */}
    </div>
  )
}

// ✅ 好：使用React.memo
const ExpensiveChild = React.memo(() => {
  // 只在props变化时重渲染
  return <div>Expensive calculation...</div>
})
```

**问题2：inline函数创建**
```typescript
// ❌ 坏：每次渲染创建新函数
{messages.map(msg => (
  <MessageItem
    key={msg.id}
    message={msg}
    onDelete={() => handleDelete(msg.id)}  {/* ← 新函数！ */}
  />
))}

// ✅ 好：使用useCallback
const handleDelete = useCallback((id: string) => {
  // delete logic
}, [])

{messages.map(msg => (
  <MessageItem
    key={msg.id}
    message={msg}
    onDelete={handleDelete}
    messageId={msg.id}
  />
))}
```

#### 下午（3小时）：数据库查询优化

**实践任务：分析慢查询**
```typescript
// scripts/analyze-slow-queries.ts

import { prisma } from '../lib/prisma'

async function analyzeQueries() {
  console.log('=== 数据库查询性能分析 ===\n')

  // 创建测试数据
  const user = await prisma.user.create({
    data: { email: 'perf-test@test.com', displayName: '性能测试' }
  })

  // 创建100个对话，每个对话100条消息
  console.log('创建测试数据...')
  for (let i = 0; i < 100; i++) {
    await prisma.conversation.create({
      data: {
        title: `对话${i}`,
        userId: user.id,
        messages: {
          create: Array.from({ length: 100 }, (_, j) => ({
            role: j % 2 === 0 ? 'user' : 'assistant',
            content: `消息${j}`,
            userId: user.id
          }))
        }
      }
    })
  }

  console.log('测试数据创建完成\n')

  // 测试1：获取对话列表（无索引优化）
  console.log('测试1：获取对话列表（按创建时间排序）')
  let start = Date.now()
  await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20
  })
  console.log(`耗时: ${Date.now() - start}ms\n`)

  // 测试2：获取对话列表（使用lastMessageAt索引）
  console.log('测试2：获取对话列表（按lastMessageAt排序）')
  start = Date.now()
  await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { lastMessageAt: 'desc' },
    take: 20
  })
  console.log(`耗时: ${Date.now() - start}ms\n`)

  // 测试3：获取单个对话（包含所有消息）
  console.log('测试3：获取对话详情（包含100条消息）')
  const firstConv = await prisma.conversation.findFirst({
    where: { userId: user.id }
  })
  start = Date.now()
  await prisma.conversation.findUnique({
    where: { id: firstConv!.id },
    include: { messages: true }
  })
  console.log(`耗时: ${Date.now() - start}ms\n`)

  // 测试4：聚合查询（统计token使用）
  console.log('测试4：统计用户总token使用量')
  start = Date.now()
  await prisma.message.aggregate({
    where: { userId: user.id },
    _sum: {
      promptTokens: true,
      completionTokens: true
    }
  })
  console.log(`耗时: ${Date.now() - start}ms\n`)

  // 清理
  await prisma.user.delete({ where: { id: user.id } })
  console.log('测试完成，数据已清理')
}

analyzeQueries()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**优化建议：**
1. 添加索引
2. 避免N+1查询
3. 使用select只选择需要的字段
4. 分页查询大数据集
5. 使用冗余字段避免聚合查询

**验证标准：**
- [ ] 能使用React DevTools Profiler分析性能
- [ ] 能识别不必要的重渲染
- [ ] 能使用React.memo和useCallback优化
- [ ] 能分析和优化数据库查询

---

### Day 27：虚拟滚动和懒加载（6小时）

#### 上午（3小时）：虚拟滚动原理

**核心概念：只渲染可见的DOM**
```
假设有1000条消息：
┌─────────────┐
│   Viewport  │  ← 只渲染可见的20条
├─────────────┤
│ Message 1   │
│ Message 2   │
│ ...         │
│ Message 20  │
├─────────────┤
│  (hidden)   │  ← 980条不渲染
└─────────────┘

优点：
- 减少DOM节点（20个 vs 1000个）
- 提升渲染性能
- 降低内存占用
```

**实践任务：使用react-window**
```bash
# 安装库
pnpm add react-window @types/react-window
```

```typescript
// components/chat/virtual-message-list.tsx

'use client'

import { FixedSizeList as List } from 'react-window'
import { ChatMessage } from '@/types/chat'

interface VirtualMessageListProps {
  messages: ChatMessage[]
  height: number  // viewport高度
  itemHeight: number  // 每条消息高度
}

export function VirtualMessageList({
  messages,
  height,
  itemHeight
}: VirtualMessageListProps) {
  // 渲染单条消息
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const message = messages[index]

    return (
      <div
        style={{
          ...style,
          padding: '10px',
          borderBottom: '1px solid #eee'
        }}
      >
        <strong>{message.role}:</strong> {message.content}
      </div>
    )
  }

  return (
    <List
      height={height}
      itemCount={messages.length}
      itemSize={itemHeight}
      width="100%"
    >
      {Row}
    </List>
  )
}
```

**使用示例：**
```typescript
// app/test-virtual-scroll/page.tsx

'use client'

import { VirtualMessageList } from '@/components/chat/virtual-message-list'
import { ChatMessage } from '@/types/chat'

export default function TestVirtualScrollPage() {
  // 生成1000条测试消息
  const messages: ChatMessage[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `这是第${i + 1}条消息`,
    status: 'completed',
    createdAt: new Date()
  }))

  return (
    <div>
      <h1>虚拟滚动测试（1000条消息）</h1>
      <p>打开DevTools观察DOM节点数量</p>

      <VirtualMessageList
        messages={messages}
        height={600}
        itemHeight={60}
      />
    </div>
  )
}
```

#### 下午（3小时）：懒加载和无限滚动

**实践任务：实现消息懒加载**
```typescript
// hooks/use-infinite-messages.ts

import { useInfiniteQuery } from '@tanstack/react-query'

interface MessagesPage {
  messages: ChatMessage[]
  nextCursor: string | null
}

export function useInfiniteMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],

    queryFn: async ({ pageParam = null }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      params.set('limit', '50')

      const res = await fetch(
        `/api/conversations/${conversationId}/messages?${params}`
      )
      return res.json() as Promise<MessagesPage>
    },

    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null
  })
}
```

**API实现：**
```typescript
// app/api/conversations/[id]/messages/route.ts

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  const limit = parseInt(searchParams.get('limit') || '50')

  const messages = await prisma.message.findMany({
    where: { conversationId: params.id },
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    take: limit,
    orderBy: { createdAt: 'desc' }
  })

  const nextCursor = messages.length === limit
    ? messages[messages.length - 1].id
    : null

  return NextResponse.json({
    messages,
    nextCursor
  })
}
```

**前端组件：**
```typescript
// components/chat/infinite-message-list.tsx

'use client'

import { useInfiniteMessages } from '@/hooks/use-infinite-messages'
import { useEffect, useRef } from 'react'

export function InfiniteMessageList({ conversationId }: { conversationId: string }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteMessages(conversationId)

  const observerRef = useRef<IntersectionObserver>()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // 使用Intersection Observer自动加载更多
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 1.0 }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => observerRef.current?.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // 合并所有页的消息
  const allMessages = data?.pages.flatMap(page => page.messages) || []

  return (
    <div>
      {allMessages.map(message => (
        <div key={message.id}>
          <strong>{message.role}:</strong> {message.content}
        </div>
      ))}

      {/* 加载更多触发器 */}
      <div ref={loadMoreRef} style={{ height: '20px' }}>
        {isFetchingNextPage && <div>加载中...</div>}
        {!hasNextPage && <div>没有更多消息了</div>}
      </div>
    </div>
  )
}
```

**验证标准：**
- [ ] 能解释虚拟滚动的原理
- [ ] 能使用react-window实现虚拟滚动
- [ ] 能实现基于cursor的分页
- [ ] 能使用Intersection Observer实现无限滚动

**Week 4 总结：**
- [ ] 深入理解SSE流式处理
- [ ] 掌握并发控制和原子性操作
- [ ] 能分析和优化性能问题
- [ ] 掌握虚拟滚动和懒加载技术

---

# Week 5：实战项目（42小时）

## Day 29-35：独立开发新功能（42小时）

### 选择以下任务之一独立完成：

#### 任务选项1：消息搜索功能（中等难度）

**需求：**
- 用户可以在对话中搜索消息
- 支持关键词高亮
- 支持快捷键（Ctrl+F）
- 结果分页显示

**技术要点：**
- API路由设计
- 全文搜索（Prisma）
- React Query缓存
- 快捷键处理

**实施步骤：**
1. Day 29：API设计和实现
2. Day 30：前端搜索组件
3. Day 31：关键词高亮
4. Day 32：快捷键和UX优化
5. Day 33：测试和bug修复
6. Day 34：性能优化
7. Day 35：文档和总结

---

#### 任务选项2：消息导出功能（简单）

**需求：**
- 导出对话为Markdown格式
- 导出对话为JSON格式
- 支持选择日期范围
- 下载为文件

**技术要点：**
- 文件生成
- Blob和下载
- 日期选择器
- 格式转换

---

#### 任务选项3：多模型切换（较难）

**需求：**
- 在对话中动态切换模型
- 显示每个模型的使用统计
- 模型配置管理
- 响应速度对比

**技术要点：**
- Provider管理
- 实时统计
- 性能监控
- 配置持久化

---

### 每日学习建议（Day 29-35）

**每天的时间分配：**
- 2小时：需求分析和设计
- 3小时：编码实现
- 1小时：测试和调试

**验证标准：**
- Day 35结束时能完整演示功能
- 代码质量达到生产标准
- 有完整的测试覆盖
- 有清晰的使用文档

---

## 最终总结

**5周学习成果：**
- [ ] 掌握TypeScript、React、Next.js核心技术
- [ ] 深入理解项目架构和设计模式
- [ ] 能独立开发新功能
- [ ] 能优化性能和解决复杂问题

**后续学习方向：**
1. 深入学习系统设计
2. 学习测试驱动开发（TDD）
3. 学习CI/CD和DevOps
4. 贡献开源项目

---

**文档版本**：v1.0
**更新时间**：2025-01-13
**维护者**：项目团队
