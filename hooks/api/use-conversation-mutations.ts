/**
 * 对话相关的 Mutation Hooks
 * 使用 TanStack Query 管理异步状态，替代复杂的操作锁机制
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
    
    // 乐观更新
    onMutate: async ({ id, updates }) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: conversationKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: conversationKeys.lists() })
      
      // 保存之前的数据用于回滚
      const previousDetail = queryClient.getQueryData(conversationKeys.detail(id))
      const previousList = queryClient.getQueryData(conversationKeys.lists())
      
      // 乐观更新缓存
      queryClient.setQueryData(conversationKeys.detail(id), (old: any) => {
        if (!old) return old
        return { ...old, ...updates }
      })
      
      queryClient.setQueryData(conversationKeys.lists(), (old: any) => {
        if (!old) return old
        return old.map((conv: Conversation) =>
          conv.id === id ? { ...conv, ...updates } : conv
        )
      })
      
      return { previousDetail, previousList }
    },
    
    // 错误时回滚
    onError: (err, { id }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(conversationKeys.detail(id), context.previousDetail)
      }
      if (context?.previousList) {
        queryClient.setQueryData(conversationKeys.lists(), context.previousList)
      }
      
      toast.error('更新失败，请重试', {
        description: err instanceof Error ? err.message : '未知错误'
      })
    },
    
    // 成功后重新验证数据
    onSuccess: (data, { id }) => {
      // 可选：显示成功提示（根据需求决定是否显示）
      // toast.success('更新成功')
      
      // 重新验证以确保数据同步
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id) })
    }
  })
}

/**
 * 删除对话的 Mutation Hook
 */
export function useDeleteConversationMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      await conversationApi.deleteConversation(id)
      return id
    },
    
    // 乐观删除
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: conversationKeys.lists() })
      
      const previousList = queryClient.getQueryData(conversationKeys.lists())
      
      queryClient.setQueryData(conversationKeys.lists(), (old: any) => {
        if (!old) return old
        return old.filter((conv: Conversation) => conv.id !== id)
      })
      
      return { previousList }
    },
    
    onError: (err, _id, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(conversationKeys.lists(), context.previousList)
      }
      
      toast.error('删除失败，请重试', {
        description: err instanceof Error ? err.message : '未知错误'
      })
    },
    
    onSuccess: (id) => {
      // 清除详情缓存
      queryClient.removeQueries({ queryKey: conversationKeys.detail(id) })
      toast.success('对话已删除')
    }
  })
}

/**
 * 创建对话的 Mutation Hook
 */
export function useCreateConversationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateConversationInput) => {
      const payload: CreateConversationPayload = typeof input === 'string'
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
      // 更新会话列表缓存
      queryClient.setQueryData<Conversation[]>(conversationKeys.lists(), (old) => {
        if (!old) return [newConversation]
        const withoutDup = old.filter(conv => conv.id !== newConversation.id)
        return [newConversation, ...withoutDup]
      })

      // 写入会话详情缓存
      queryClient.setQueryData(
        conversationKeys.detail(newConversation.id),
        newConversation
      )

      toast.success('�¶Ի��Ѵ���')
    },

    onError: (err) => {
      toast.error('�����Ի�ʧ��', {
        description: err instanceof Error ? err.message : 'δ֪����'
      })
    }
  })
}


/**
 * 获取所有 mutation 的加载状态
 */
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