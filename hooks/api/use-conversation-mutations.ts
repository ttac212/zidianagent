/**
 * 对话相关的 Mutation Hooks
 * 使用 TanStack Query 管理异步状态，替代复杂的操作锁机制
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast/toast'
import type { Conversation } from '@/types/chat'
import { conversationApi, conversationKeys } from './use-conversations-query'

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
      await queryClient.cancelQueries({ queryKey: conversationKeys.detail(id) })

      const previousDetail = queryClient.getQueryData<Conversation | undefined>(
        conversationKeys.detail(id)
      )

      if (previousDetail) {
        queryClient.setQueryData(conversationKeys.detail(id), { ...previousDetail, ...updates })
      }

      return { previousDetail }
    },

    onError: (err, { id }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(conversationKeys.detail(id), context.previousDetail)
      }

      toast.error('更新失败，请重试', {
        description: err instanceof Error ? err.message : '未知错误'
      })
    },

    onSuccess: (updatedConversation) => {
      // 立即在所有对话列表缓存中更新对话
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
          if (Array.isArray(oldData)) {
            return oldData.map(conv =>
              conv.id === updatedConversation.id ? { ...conv, ...updatedConversation } : conv
            )
          }
          return oldData
        }
      )

      // 不直接覆盖详情缓存，而是 invalidate 让它重新请求完整数据（包含消息）
      // 避免 PATCH 响应（不含 messages）污染缓存导致消息瞬间消失
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(updatedConversation.id),
        exact: true
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
          if (Array.isArray(oldData)) {
            return oldData.filter(conv => conv.id !== id)
          }
          return oldData
        }
      )

      // 移除详情缓存
      queryClient.removeQueries({ queryKey: conversationKeys.detail(id) })

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
          if (Array.isArray(oldData)) {
            return [newConversation, ...oldData]
          }
          return [newConversation]
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