/**
 * 对话相关的 Mutation Hooks
 * 使用 TanStack Query 管理异步状态，替代复杂的操作锁机制
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast/toast'
import type { Conversation } from '@/types/chat'
import { conversationApi, conversationKeys, matchesConversationDetailKey } from './use-conversations-query'

type CreateConversationPayload = Parameters<typeof conversationApi.createConversation>[0]
type CreateConversationInput = string | (Partial<CreateConversationPayload> & { modelId: string })

/**
 * 更新对话的 Mutation Hook
 * 特性：
 * - 自动防抖（通过 isPending 状态）
 * - 乐观更新
 * - 错误回滚
 * - Toast 反馈
 */

export function useUpdateConversationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Conversation> }) =>
      conversationApi.updateConversation(id, updates),

    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({
        predicate: (query) => matchesConversationDetailKey(query.queryKey, id)
      })

      const previousDetails = queryClient.getQueriesData<Conversation | undefined>({
        predicate: (query) => matchesConversationDetailKey(query.queryKey, id)
      })

      previousDetails.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData(key, { ...data, ...updates })
        }
      })

      return { previousDetails }
    },

    onError: (err, { id }, context) => {
      if (context?.previousDetails) {
        context.previousDetails.forEach(([key, data]) => {
          queryClient.setQueryData(key, data)
        })
      }

      toast.error('更新失败，请重试', {
        description: err instanceof Error ? err.message : '未知错误'
      })
    },

    onSuccess: (updatedConversation) => {
      // 【关键修复】验证API返回值完整性，防止差量响应污染缓存
      // 如果后端只返回PATCH差量（如 { id, model }），不能直接覆盖缓存
      const hasCompleteMetadata = updatedConversation.metadata &&
        (updatedConversation.metadata.messageCount !== undefined ||
         updatedConversation.metadata.lastMessage !== undefined)

      // 立即在所有对话列表缓存中更新对话
      // 修复：使用防御性合并，保留旧缓存中的完整字段（如 lastMessage）
      queryClient.setQueriesData(
        {
          predicate: (query) => {
            const key = query.queryKey
            return Array.isArray(key) &&
                   key[0] === 'conversations' &&
                   key[1] === 'list'
          }
        },
        (oldData: any) => {
          const updateConv = (conv: any) => {
            if (conv.id !== updatedConversation.id) return conv

            // 【防御性合并】如果API返回不完整，保留旧缓存的metadata
            if (!hasCompleteMetadata && conv.metadata) {
              return {
                ...conv,
                ...updatedConversation,
                metadata: {
                  ...conv.metadata,           // 保留旧metadata（包含lastMessage等）
                  ...updatedConversation.metadata, // 覆盖更新字段（如pinned/tags）
                }
              }
            }

            // API返回完整数据，直接合并
            return { ...conv, ...updatedConversation }
          }

          // 处理分页数据结构 { conversations, pagination }
          if (oldData && oldData.conversations && Array.isArray(oldData.conversations)) {
            return {
              ...oldData,
              conversations: oldData.conversations.map(updateConv)
            }
          }
          // 向后兼容：处理纯数组结构（不应该出现）
          if (Array.isArray(oldData)) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[Cache] 检测到纯数组缓存格式，这不应该发生')
            }
            return oldData.map(updateConv)
          }
          return oldData
        }
      )

      // 不直接覆盖详情缓存，而是 invalidate 让它重新请求完整数据（包含消息）
      // 避免 PATCH 响应（不含 messages）污染缓存导致消息瞬间消失
      queryClient.invalidateQueries({
        predicate: (query) => matchesConversationDetailKey(query.queryKey, updatedConversation.id)
      })

      // ✅ 修复：只invalidate详情，不invalidate列表，避免不必要的refetch
    },
  })
}


export function useDeleteConversationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await conversationApi.deleteConversation(id)
      return id
    },

    onSuccess: (id) => {
      // 立即从所有对话列表缓存中移除已删除的对话
      // 修复：使用 predicate 匹配所有 lists 相关的查询（包括 summary）
      queryClient.setQueriesData(
        {
          predicate: (query) => {
            const key = query.queryKey
            return Array.isArray(key) &&
                   key[0] === 'conversations' &&
                   key[1] === 'list'
          }
        },
        (oldData: any) => {
          // 处理分页数据结构 { conversations, pagination }
          if (oldData && oldData.conversations && Array.isArray(oldData.conversations)) {
            return {
              ...oldData,
              conversations: oldData.conversations.filter((conv: any) => conv.id !== id),
              pagination: oldData.pagination ? {
                ...oldData.pagination,
                total: Math.max(0, (oldData.pagination.total || 0) - 1)
              } : undefined
            }
          }
          // 向后兼容：处理纯数组结构（不应该出现）
          if (Array.isArray(oldData)) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[Cache] 检测到纯数组缓存格式，这不应该发生')
            }
            return oldData.filter(conv => conv.id !== id)
          }
          return oldData
        }
      )

      // 移除详情缓存
      queryClient.removeQueries({
        predicate: (query) => matchesConversationDetailKey(query.queryKey, id)
      })

      toast.success('对话已删除')
    },

    onError: (err) => {
      toast.error('删除失败，请重试', {
        description: err instanceof Error ? err.message : '未知错误'
      })
    },
  })
}


export function useCreateConversationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateConversationInput) => {
      const payload: CreateConversationPayload =
        typeof input === 'string'
          ? { modelId: input }
          : {
              modelId: input.modelId,
              title: input.title,
              temperature: input.temperature,
              maxTokens: input.maxTokens,
              contextAware: input.contextAware,
            }

      return conversationApi.createConversation(payload)
    },

    onSuccess: (newConversation) => {
      // 立即将新对话添加到所有对话列表缓存的开头
      // 修复：使用 predicate 匹配所有 lists 相关的查询（包括 summary）
      queryClient.setQueriesData(
        {
          predicate: (query) => {
            const key = query.queryKey
            return Array.isArray(key) &&
                   key[0] === 'conversations' &&
                   key[1] === 'list'
          }
        },
        (oldData: any) => {
          // 处理分页数据结构 { conversations, pagination }
          if (oldData && oldData.conversations && Array.isArray(oldData.conversations)) {
            return {
              ...oldData,
              conversations: [newConversation, ...oldData.conversations],
              pagination: oldData.pagination ? {
                ...oldData.pagination,
                total: (oldData.pagination.total || 0) + 1
              } : undefined
            }
          }
          // 向后兼容：处理纯数组结构（不应该出现）
          if (Array.isArray(oldData)) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[Cache] 检测到纯数组缓存格式，这不应该发生')
            }
            return [newConversation, ...oldData]
          }
          // 空缓存：创建新的分页结构（极少情况，通常在首次创建对话且无初始数据时）
          // 使用默认 limit=20，与 useConversationsSummary 的默认值保持一致
          return {
            conversations: [newConversation],
            pagination: { page: 1, limit: 20, total: 1, pages: 1 }
          }
        }
      )

      // 缓存新对话的详情
      queryClient.setQueryData(
        conversationKeys.detail(newConversation.id),
        newConversation
      )

      // ✅ 修复：移除invalidateQueries，避免不必要的refetch

      toast.success('新对话已创建')
    },

    onError: (err) => {
      toast.error('创建对话失败', {
        description: err instanceof Error ? err.message : '未知错误'
      })
    },
  })
}

export function useConversationMutationStates() {
  const updateMutation = useUpdateConversationMutation()
  const deleteMutation = useDeleteConversationMutation()
  const createMutation = useCreateConversationMutation()
  
  return {
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCreating: createMutation.isPending,
    isAnyPending: updateMutation.isPending || deleteMutation.isPending || createMutation.isPending
  }
}
