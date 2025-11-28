/**
 * 重构后的对话管理Hook - 只负责UI状态协调
 * 数据获取委托给selectors，遵循单一职责原则
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DEFAULT_MODEL } from "@/lib/ai/models"
import type { Conversation } from "@/types/chat"
import { STORAGE_KEYS } from "@/lib/storage"

// 直接使用React Query hooks，移除过度抽象的选择器
import { useConversationsSummary, conversationApi } from "@/hooks/api/use-conversations-query"

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
 * 支持分页加载，提供 loadMore/hasMore 状态
 */
export function useConversations(currentConversationId?: string | null) {
  // 分页状态
  const [page, setPage] = useState(1)
  const [allConversations, setAllConversations] = useState<Conversation[]>([])
  const [pagination, setPagination] = useState<{
    page: number
    limit: number
    total: number
    pages: number
  } | null>(null)

  // 数据层 - 不要使用默认空数组！让React Query的错误状态正常传播
  const { data, isLoading: isQueryLoading, error: queryError, refetch } = useConversationsSummary({ page, limit: 10 })

  // 更新合并的对话列表
  useEffect(() => {
    if (data) {
      setPagination(data.pagination)

      if (page === 1) {
        // 第一页，直接替换
        setAllConversations(data.conversations)
      } else {
        // 后续页，合并数据（去重）
        setAllConversations(prev => {
          const existingIds = new Set(prev.map(c => c.id))
          const newConversations = data.conversations.filter(c => !existingIds.has(c.id))
          return [...prev, ...newConversations]
        })
      }
    }
  }, [data, page])

  // 确保当前对话在列表中可见
  // 移除 allConversations 依赖避免无限循环
  useEffect(() => {
    if (!currentConversationId) return

    // 使用函数式更新获取最新的 allConversations
    setAllConversations(current => {
      // 如果列表为空，不处理
      if (!current || current.length === 0) return current

      // 检查当前对话是否已存在
      const currentExists = current.some(c => c.id === currentConversationId)
      if (currentExists) return current

      // 当前对话不在列表中，异步获取并添加
      conversationApi.fetchConversation(currentConversationId).then(conv => {
        if (conv) {
          setAllConversations(prev => {
            // 再次检查避免竞态条件导致重复
            if (prev?.some(c => c.id === conv.id)) return prev
            return [conv, ...(prev || [])]
          })
        }
      }).catch(err => {
        console.error('获取当前对话失败:', err)
      })

      // 返回原列表，等待异步操作完成
      return current
    })
  }, [currentConversationId]) // 只依赖 currentConversationId

  const currentConversation = currentConversationId && allConversations ?
    allConversations.find(conv => conv.id === currentConversationId) || null : null

  // 本地状态管理
  const [error, setError] = useState<string | null>(null)
  const lastQueryErrorRef = useRef<string | null>(null)

  // Mutations
  const createConversationMutation = useCreateConversationMutation()
  const updateConversationMutation = useUpdateConversationMutation()
  const deleteConversationMutation = useDeleteConversationMutation()

  // 错误处理
  useEffect(() => {
    if (queryError) {
      const message = queryError instanceof Error ? queryError.message : "加载对话失败"
      lastQueryErrorRef.current = message
      setError(message)
      return
    }

    if (lastQueryErrorRef.current) {
      const previousQueryError = lastQueryErrorRef.current
      lastQueryErrorRef.current = null
      setError((prev) => (prev === previousQueryError ? null : prev))
    }
  }, [queryError])

  // 简化的操作函数
  const createConversation = useCallback(async (model: string = DEFAULT_MODEL) => {
    setError(null)
    try {
      const newConversation = await createConversationMutation.mutateAsync(model)
      // 创建后重置到第一页
      setPage(1)
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
      const result = await updateConversationMutation.mutateAsync({ id, updates })
      // 不需要手动更新本地列表，React Query 缓存更新会触发 useEffect 自动同步
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新对话失败"
      setError(message)
      throw err
    }
  }, [updateConversationMutation])

  const deleteConversation = useCallback(async (id: string) => {
    setError(null)
    try {
      await deleteConversationMutation.mutateAsync(id)
      // 不需要手动更新本地列表，React Query 缓存更新会触发 useEffect 自动同步
    } catch (err) {
      const message = err instanceof Error ? err.message : "删除对话失败"
      setError(message)
      throw err
    }
  }, [deleteConversationMutation])

  const refreshConversations = useCallback(async () => {
    setError(null)
    // 重置到第一页并刷新
    setPage(1)
    setAllConversations([])
    const result = await refetch()
    if (result.error) {
      const message = result.error instanceof Error ? result.error.message : "刷新对话失败"
      setError(message)
    }
    return result
  }, [refetch])

  // 加载更多对话
  const loadMore = useCallback(() => {
    if (pagination && page < pagination.pages) {
      setPage(prev => prev + 1)
    }
  }, [pagination, page])

  // 是否还有更多对话
  const hasMore = pagination ? page < pagination.pages : false

  return {
    conversations: allConversations,
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
    // 分页状态
    loadMore,
    hasMore,
    pagination
  }
}

