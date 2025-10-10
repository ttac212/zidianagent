/**
 * 对话相关的 React Query hooks
 * 提供缓存、重试和状态管理功能的数据获取
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import type { Conversation, ChatMessage } from '@/types/chat'

// ==================== 查询Keys ====================

export interface ConversationDetailParams {
  take?: number
  beforeId?: string
}

export const conversationKeys = {
  // 所有对话相关的查询
  all: ['conversations'] as const,
  // 对话列表
  lists: () => [...conversationKeys.all, 'list'] as const,
  // 单个对话详情
  detail: (id: string, params?: ConversationDetailParams) => {
    if (!params || (Object.keys(params).length === 0)) {
      return [...conversationKeys.all, 'detail', id] as const
    }
    return [...conversationKeys.all, 'detail', { id, params }] as const
  },
  // 对话消息
  messages: (id: string) => [...conversationKeys.all, 'messages', id] as const,
}

export function matchesConversationDetailKey(queryKey: QueryKey, id: string): boolean {
  if (!Array.isArray(queryKey)) return false
  if (queryKey.length < 3) return false
  if (queryKey[0] !== 'conversations' || queryKey[1] !== 'detail') return false

  const identifier = queryKey[2]

  if (typeof identifier === 'string') {
    return identifier === id
  }

  if (identifier && typeof identifier === 'object' && 'id' in identifier) {
    const record = identifier as { id?: string }
    return record.id === id
  }

  return false
}

// ==================== API响应类型 ====================

interface ApiMessage {
  id: string
  role: string
  content: string
  createdAt: string
  totalTokens?: number
  modelId?: string
  metadata?: Record<string, unknown>
}

interface ApiConversation {
  id: string
  title: string
  modelId: string
  createdAt: string
  updatedAt: string
  messageCount?: number
  totalTokens?: number
  messages?: ApiMessage[]
  lastMessage?: {
    id: string
    role: string
    content: string
    createdAt: string
  } | null
  metadata?: Record<string, unknown>
  messagesWindow?: {
    size: number
    hasMoreBefore: boolean
    oldestMessageId?: string | null
    newestMessageId?: string | null
    request?: {
      take: number | null
      beforeId: string | null
    } | null
  }
}

interface ConversationListResponse {
  success: boolean
  data: {
    conversations: ApiConversation[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
  message?: string
}

interface ConversationDetailResponse {
  success: boolean
  data: ApiConversation
  message?: string
}

interface CreateConversationRequest {
  modelId: string
  title?: string
  temperature?: number
  maxTokens?: number
  contextAware?: boolean
}

interface CreateConversationResponse {
  success: boolean
  data: ApiConversation
  message?: string
}

interface UpdateConversationResponse {
  success: boolean
  data: ApiConversation
  message?: string
}

interface DeleteConversationResponse {
  success: boolean
  message?: string
}

// ==================== 辅助函数 ====================

/**
 * 转换API消息为前端消息格式
 */
function transformApiMessage(msg: ApiMessage): ChatMessage {
  // 保留原始角色类型，UI层决定如何显示
  const role = msg.role.toLowerCase()

  const transformedMessage: ChatMessage = {
    id: msg.id,
    role: role as any, // 保留原始role，前端组件负责渲染处理
    content: msg.content,
    timestamp: new Date(msg.createdAt).getTime(),
    tokens: msg.totalTokens || 0,
    metadata: {
      ...(msg.metadata as any),
      // 将数据库的modelId字段映射到metadata.model，供前端显示组件使用
      ...(msg.modelId && { model: msg.modelId })
    },
    status: 'completed' // API消息默认为已完成状态
  }

  return transformedMessage
}

/**
 * 安全的日期转换函数 - 消除特殊情况
 * @param dateValue 任意日期值
 * @param fallback 失败时的回退值（默认为当前时间）
 * @returns 有效的时间戳
 */
function safeParseTimestamp(dateValue: string | number | Date | undefined | null, fallback?: number): number {
  if (!dateValue) {
    return fallback ?? Date.now()
  }

  const timestamp = new Date(dateValue).getTime()

  // NaN检查 - 统一处理所有无效日期
  if (Number.isNaN(timestamp)) {
    console.warn('⚠️ 无效的日期值:', dateValue, '使用fallback:', fallback ?? Date.now())
    return fallback ?? Date.now()
  }

  return timestamp
}

/**
 * 转换API对话为前端对话格式
 */
function transformApiConversation(conv: ApiConversation): Conversation {
  const transformedConversation: Conversation = {
    id: conv.id,
    title: conv.title,
    messages: conv.messages?.map(transformApiMessage) || [],
    model: conv.modelId,
    createdAt: safeParseTimestamp(conv.createdAt),
    updatedAt: safeParseTimestamp(conv.updatedAt),
    metadata: {
      // 先展开数据库中的 metadata（包含用户自定义字段如 tags、pinned 等）
      ...(conv.metadata && typeof conv.metadata === 'object' ? conv.metadata : {}),
      // 然后用服务端的实时统计字段覆盖（确保统计数据是最新的）
      totalTokens: conv.totalTokens || 0,
      messageCount: conv.messageCount || 0,
      lastActivity: safeParseTimestamp(conv.updatedAt),
      lastMessage: conv.lastMessage ? {
        id: conv.lastMessage.id,
        role: conv.lastMessage.role as 'user' | 'assistant',
        content: conv.lastMessage.content,
        timestamp: safeParseTimestamp(conv.lastMessage.createdAt)
      } : null
    }
  }

  if (conv.messagesWindow) {
    transformedConversation.messagesWindow = {
      size: conv.messagesWindow.size,
      hasMoreBefore: conv.messagesWindow.hasMoreBefore,
      oldestMessageId: conv.messagesWindow.oldestMessageId ?? null,
      newestMessageId: conv.messagesWindow.newestMessageId ?? null,
      request: conv.messagesWindow.request ?? null
    }
  }

  return transformedConversation
}

// ==================== API函数 ====================

export const conversationApi = {
  // 获取对话列表
  fetchConversations: async (params: {
    page?: number
    limit?: number
    includeMessages?: boolean
  } = {}): Promise<Conversation[]> => {
    const { page = 1, limit = 20, includeMessages = false } = params

    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(includeMessages && { includeMessages: 'true' })
    })

    const response = await fetch('/api/conversations?' + searchParams)

    if (!response.ok) {
      // 401未认证 - 重定向到登录页
      if (response.status === 401) {
        console.error('❌ 未认证，需要重新登录')
        // 在客户端环境下重定向
        if (typeof window !== 'undefined') {
          window.location.href = '/login?callbackUrl=' + encodeURIComponent(window.location.pathname)
        }
        throw new Error('未认证，请重新登录')
      }

      throw new Error('获取对话列表失败: ' + response.status + ' ' + response.statusText)
    }

    const result: ConversationListResponse = await response.json()

    if (!result.success) {
      throw new Error(result.message || '获取对话列表失败')
    }

    // 转换API响应为前端格式
    const conversations = result.data.conversations.map(transformApiConversation)

    return conversations
  },

  // 获取单个对话详情
  fetchConversation: async (id: string, params: ConversationDetailParams = {}): Promise<Conversation | null> => {
    const searchParams = new URLSearchParams({
      includeMessages: 'true'
    })

    if (params.take !== undefined) {
      searchParams.set('take', params.take.toString())
    }

    if (params.beforeId) {
      searchParams.set('beforeId', params.beforeId)
    }

    const response = await fetch('/api/conversations/' + id + '?' + searchParams.toString())

    if (!response.ok) {
      if (response.status === 404) {
        return null // 对话不存在
      }
      throw new Error('获取对话详情失败: ' + response.status + ' ' + response.statusText)
    }

    const result: ConversationDetailResponse = await response.json()

    if (!result.success) {
      throw new Error(result.message || '获取对话详情失败')
    }

    // 转换API响应为前端格式
    return transformApiConversation(result.data)
  },

  // 创建新对话
  createConversation: async (request: CreateConversationRequest): Promise<Conversation> => {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: request.title || '新对话',
        modelId: request.modelId,
        temperature: request.temperature || 0.7,
        maxTokens: request.maxTokens || 2000,
        contextAware: request.contextAware ?? true
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to create conversation: ' + response.status + ' ' + response.statusText)
    }
    
    const result: CreateConversationResponse = await response.json()
    
    if (!result.success) {
      throw new Error(result.message || '创建对话失败')
    }

    // 转换API响应为前端格式
    return transformApiConversation(result.data)
  },

  // 删除对话
  deleteConversation: async (id: string): Promise<void> => {
    const response = await fetch('/api/conversations/' + id, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('删除对话失败: ' + response.status + ' ' + response.statusText)
    }

    const result: DeleteConversationResponse = await response.json()

    if (!result.success) {
      throw new Error(result.message || '删除对话失败')
    }
  },

  // 更新对话
  updateConversation: async (id: string, updates: Partial<Conversation>): Promise<Conversation> => {
    const payload: Record<string, unknown> = {}
    if (updates.title !== undefined) payload.title = updates.title
    if (updates.model !== undefined) payload.modelId = updates.model
    if (updates.metadata !== undefined) payload.metadata = updates.metadata
    if (updates.temperature !== undefined) payload.temperature = updates.temperature
    if (updates.maxTokens !== undefined) payload.maxTokens = updates.maxTokens
    if (updates.contextAware !== undefined) payload.contextAware = updates.contextAware

    if (Object.keys(payload).length === 0) {
      const latest = await conversationApi.fetchConversation(id)
      if (!latest) {
        throw new Error('未找到对话')
      }
      return latest
    }

    const response = await fetch('/api/conversations/' + id, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error('更新对话失败: ' + response.status + ' ' + response.statusText)
    }

    const result: UpdateConversationResponse = await response.json()

    if (!result.success) {
      throw new Error(result.message || '更新对话失败')
    }

    // 返回更新后的对话，并同步本地的未接收新消息
    const updatedConv = transformApiConversation(result.data)
    if (updates.messages) {
      updatedConv.messages = updates.messages
      updatedConv.metadata = {
        ...updatedConv.metadata,
        messageCount: updates.messages.length,
        totalTokens: updates.messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0)
      }
    }
    return updatedConv
  }
}

// ==================== Query Hooks ====================

/**
 * 获取对话列表的查询hook
 */
export function useConversationsQuery(options: {
  page?: number
  limit?: number
  includeMessages?: boolean
} = {}) {
  const { page = 1, limit = 20, includeMessages = false } = options

  return useQuery({
    queryKey: [...conversationKeys.lists(), { page, limit, includeMessages }],
    queryFn: () => conversationApi.fetchConversations(options),
    staleTime: 5 * 60 * 1000, // 5分钟内数据保持新鲜
    gcTime: 10 * 60 * 1000,   // 10分钟后清理缓存
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

/**
 * 获取对话摘要列表的专用hook - 轻量级，不包含消息内容
 */
export function useConversationsSummary(options: {
  page?: number
  limit?: number
} = {}) {
  const { page = 1, limit = 20 } = options

  return useQuery({
    queryKey: [...conversationKeys.lists(), 'summary', { page, limit }],
    queryFn: () => conversationApi.fetchConversations({
      page,
      limit,
      includeMessages: false
    }),
    staleTime: 5 * 60 * 1000, // 5分钟内数据保持新鲜
    gcTime: 10 * 60 * 1000,   // 10分钟后清理缓存
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

/**
 * 获取单个对话详情的查询hook
 */
export function useConversationQuery(
  id: string,
  options: { enabled?: boolean; params?: ConversationDetailParams } = {}
) {
  const { enabled = true, params } = options

  return useQuery({
    queryKey: conversationKeys.detail(id, params),
    queryFn: () => conversationApi.fetchConversation(id, params),
    enabled: enabled && !!id,
    staleTime: 2 * 60 * 1000, // 2分钟内数据保持新鲜
    gcTime: 5 * 60 * 1000,    // 5分钟后清理缓存
    retry: 1,
  })
}

// ==================== 已移除重复的Mutation Hooks ====================
//
// 注意：Mutation hooks已迁移到 @/hooks/api/use-conversation-mutations.ts
// 避免重复定义，使用统一的mutation管理

/**
 * 批量无效化对话相关缓存的工具函数
 */
export function useInvalidateConversations() {
  const queryClient = useQueryClient()
  
  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all })
    },
    invalidateList: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    },
    invalidateDetail: (id: string) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id) })
    }
  }
}
