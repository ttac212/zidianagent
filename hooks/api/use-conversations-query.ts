/**
 * 对话相关的 React Query hooks
 * 提供缓存、重试和状态管理功能的数据获取
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Conversation, ChatMessage } from '@/types/chat'

// ==================== 查询Keys ====================

export const conversationKeys = {
  // 所有对话相关的查询
  all: ['conversations'] as const,
  // 对话列表
  lists: () => [...conversationKeys.all, 'list'] as const,
  // 单个对话详情
  detail: (id: string) => [...conversationKeys.all, 'detail', id] as const,
  // 对话消息
  messages: (id: string) => [...conversationKeys.all, 'messages', id] as const,
}

// ==================== API响应类型 ====================

interface ApiMessage {
  id: string
  role: string
  content: string
  createdAt: string
  totalTokens?: number
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
  // 过滤掉不支持的角色类型，只保留 user 和 assistant
  const role = msg.role.toLowerCase()
  const validRole = (role === 'user' || role === 'assistant') ? role : 'assistant'

  return {
    id: msg.id,
    role: validRole as 'user' | 'assistant',
    content: msg.content,
    timestamp: new Date(msg.createdAt).getTime(),
    tokens: msg.totalTokens || 0,
    metadata: msg.metadata as any
  }
}

/**
 * 转换API对话为前端对话格式
 */
function transformApiConversation(conv: ApiConversation): Conversation {
  return {
    id: conv.id,
    title: conv.title,
    messages: conv.messages?.map(transformApiMessage) || [],
    model: conv.modelId,
    createdAt: new Date(conv.createdAt).getTime(),
    updatedAt: new Date(conv.updatedAt).getTime(),
    metadata: {
      totalTokens: conv.totalTokens || 0,
      messageCount: conv.messageCount || 0,
      lastActivity: new Date(conv.updatedAt).getTime()
    }
  }
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
      throw new Error('获取对话列表失败: ' + response.status + ' ' + response.statusText)
    }

    const result: ConversationListResponse = await response.json()

    if (!result.success) {
      throw new Error(result.message || '获取对话列表失败')
    }

    // 转换API响应为前端格式
    return result.data.conversations.map(transformApiConversation)
  },

  // 获取单个对话详情
  fetchConversation: async (id: string): Promise<Conversation | null> => {
    const response = await fetch('/api/conversations/' + id + '?includeMessages=true')

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
  return useQuery({
    queryKey: conversationKeys.lists(),
    queryFn: () => conversationApi.fetchConversations(options),
    staleTime: 5 * 60 * 1000, // 5分钟内数据保持新鲜
    gcTime: 10 * 60 * 1000,   // 10分钟后清理缓存
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

/**
 * 获取单个对话详情的查询hook
 */
export function useConversationQuery(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: () => conversationApi.fetchConversation(id),
    enabled: enabled && !!id,
    staleTime: 2 * 60 * 1000, // 2分钟内数据保持新鲜
    gcTime: 5 * 60 * 1000,    // 5分钟后清理缓存
    retry: 1,
  })
}

// ==================== Mutation Hooks ====================

/**
 * 创建对话的mutation hook
 */
export function useCreateConversationMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: conversationApi.createConversation,
    onSuccess: (newConversation) => {
      // 更新对话列表缓存
      queryClient.setQueryData<Conversation[]>(conversationKeys.lists(), (old) => {
        if (!old) return [newConversation]
        return [newConversation, ...old]
      })
      
      // 缓存新对话的详情
      queryClient.setQueryData(
        conversationKeys.detail(newConversation.id),
        newConversation
      )
    },
    onError: (error: Error) => {
      }
  })
}

/**
 * 删除对话的mutation hook
 */
export function useDeleteConversationMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: conversationApi.deleteConversation,
    onSuccess: (_, deletedId) => {
      // 从对话列表缓存中移除
      queryClient.setQueryData<Conversation[]>(conversationKeys.lists(), (old) => {
        if (!old) return []
        return old.filter(conv => conv.id !== deletedId)
      })
      
      // 清除对话详情缓存
      queryClient.removeQueries({ queryKey: conversationKeys.detail(deletedId) })
    },
    onError: (error: Error) => {
      }
  })
}

/**
 * 更新对话的mutation hook
 */
export function useUpdateConversationMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: Partial<Conversation> }) =>
      conversationApi.updateConversation(id, updates),
    onSuccess: (updatedConversation) => {
      // 更新对话列表缓存
      queryClient.setQueryData<Conversation[]>(conversationKeys.lists(), (old) => {
        if (!old) return [updatedConversation]
        return old.map(conv =>
          conv.id === updatedConversation.id ? updatedConversation : conv
        )
      })

      // 更新对话详情缓存
      queryClient.setQueryData(
        conversationKeys.detail(updatedConversation.id),
        updatedConversation
      )
    },
    onError: (error: Error) => {
      }
  })
}

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
