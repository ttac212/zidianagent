/**
 * 重构后的对话管理Hook - 只负责UI状态协调
 * 数据获取委托给selectors，遵循单一职责原则
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import { DEFAULT_MODEL } from "@/lib/ai/models"
import type { Conversation } from "@/types/chat"
import { STORAGE_KEYS } from "@/lib/storage"

// 直接使用React Query hooks，移除过度抽象的选择器
import { useConversationsSummary } from "@/hooks/api/use-conversations-query"

// 使用mutation hooks
import {
  useCreateConversationMutation,
  useDeleteConversationMutation,
  useUpdateConversationMutation
} from "@/hooks/api/use-conversation-mutations"

// 移除Zustand Store依赖 - 状态管理将本地化

// 移除未使用的localStorage key常量
// const LOCAL_STORAGE_KEY = STORAGE_KEYS.CURRENT_CONVERSATION_ID

/**
 * 简化的对话管理Hook - 直接基于React Query
 * 不再作为UI状态协调器，返回纯粹的数据和操作
 */
export function useConversations(currentConversationId?: string | null) {
  // 数据层 - 不要使用默认空数组！让React Query的错误状态正常传播
  const { data: conversations, isLoading: isQueryLoading, error: queryError, refetch } = useConversationsSummary()

  const currentConversation = currentConversationId && conversations ?
    conversations.find(conv => conv.id === currentConversationId) || null : null

  // 本地状态管理
  const [error, setError] = useState<string | null>(null)

  // Mutations
  const createConversationMutation = useCreateConversationMutation()
  const updateConversationMutation = useUpdateConversationMutation()
  const deleteConversationMutation = useDeleteConversationMutation()

  // 错误处理
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (queryError) {
      const message = queryError instanceof Error ? queryError.message : "加载对话失败"
      setError(message)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryError])

  // 简化的操作函数
  const createConversation = useCallback(async (model: string = DEFAULT_MODEL) => {
    setError(null)
    try {
      const newConversation = await createConversationMutation.mutateAsync(model)
      return newConversation
    } catch (err) {
      const message = err instanceof Error ? err.message : "创建对话失败"
      setError(message)
      return null
    }
  }, [createConversationMutation])

  const updateConversation = useCallback(async (id: string, updates: Partial<Conversation>) => {
    setError(null)
    try {
      return await updateConversationMutation.mutateAsync({ id, updates })
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新对话失败"
      // eslint-disable-next-line react-hooks/exhaustive-deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setError(message)
      throw err
    }
  }, [updateConversationMutation])

  const deleteConversation = useCallback(async (id: string) => {
    setError(null)
    try {
      await deleteConversationMutation.mutateAsync(id)
    } catch (err) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const message = err instanceof Error ? err.message : "删除对话失败"
      setError(message)
      throw err
    }
  }, [deleteConversationMutation])

  const refreshConversations = useCallback(async () => {
    setError(null)
    const result = await refetch()
    if (result.error) {
      const message = result.error instanceof Error ? result.error.message : "刷新对话失败"
      setError(message)
    }
    return result
  }, [refetch])

  return {
    conversations: conversations || [], // 在返回时才提供空数组作为安全默认值
    currentConversation,
    loading: isQueryLoading,
    error,
    createConversation,
    updateConversation,
    deleteConversation,
    refreshConversations,
    // Mutations状态，供UI使用
    isCreating: createConversationMutation.isPending,
    isDeleting: deleteConversationMutation.isPending,
    isUpdating: updateConversationMutation.isPending,
  }
}
