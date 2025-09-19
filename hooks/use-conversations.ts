"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DEFAULT_MODEL } from "@/lib/ai/models"
import type { ChatMessage, Conversation } from "@/types/chat"
import { LocalStorage, STORAGE_KEYS } from "@/lib/storage"
import { useConversationsQuery, conversationApi } from "@/hooks/api/use-conversations-query"
import {
  useCreateConversationMutation,
  useDeleteConversationMutation,
  useUpdateConversationMutation
} from "@/hooks/api/use-conversation-mutations"
import { useConversationStore } from "@/stores/conversation-store"

const LOCAL_STORAGE_KEY = STORAGE_KEYS.CURRENT_CONVERSATION_ID

export function useConversations() {
  const conversations = useConversationStore(state => state.conversations)
  const currentConversationId = useConversationStore(state => state.currentConversationId)
  const setConversations = useConversationStore(state => state.setConversations)
  const selectConversation = useConversationStore(state => state.selectConversation)
  const updateConversationInStore = useConversationStore(state => state.updateConversation)
  const deleteConversationFromStore = useConversationStore(state => state.deleteConversation)
  const addConversationToStore = useConversationStore(state => state.addConversation)
  const setLoadingState = useConversationStore(state => state.setLoading)
  const setCreatingState = useConversationStore(state => state.setCreating)
  const setUpdatingState = useConversationStore(state => state.setUpdating)
  const setDeletingState = useConversationStore(state => state.setDeleting)
  const setErrorState = useConversationStore(state => state.setError)
  const clearErrorState = useConversationStore(state => state.clearError)
  const error = useConversationStore(state => state.error)
  const isStoreLoading = useConversationStore(state => state.isLoading)

  const createConversationMutation = useCreateConversationMutation()
  const updateConversationMutation = useUpdateConversationMutation()
  const deleteConversationMutation = useDeleteConversationMutation()

  const {
    data: conversationsFromApi,
    isLoading: isQueryLoading,
    isFetching: isQueryFetching,
    error: queryError,
    refetch,
  } = useConversationsQuery({ limit: 100, includeMessages: true })

  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null)
  const [initialPersistedId] = useState<string | null>(() => {
    try {
      return LocalStorage.getItem(LOCAL_STORAGE_KEY, null)
    } catch (err) {
      void err
      return null
    }
  })

  const currentIdRef = useRef<string | null>(currentConversationId)
  useEffect(() => {
    currentIdRef.current = currentConversationId
  }, [currentConversationId])

  const initialisedRef = useRef(false)

  const persistCurrentConversationId = useCallback((conversationId: string | null) => {
    try {
      if (conversationId) {
        LocalStorage.setItem(LOCAL_STORAGE_KEY, conversationId)
      } else {
        LocalStorage.removeItem(LOCAL_STORAGE_KEY)
      }
    } catch (err) {
      void err
    }
  }, [])

  useEffect(() => {
    persistCurrentConversationId(currentConversationId)
  }, [currentConversationId, persistCurrentConversationId])

  useEffect(() => {
    setLoadingState(isQueryLoading || isQueryFetching)
  }, [isQueryLoading, isQueryFetching, setLoadingState])

  useEffect(() => {
    if (queryError) {
      const message = queryError instanceof Error ? queryError.message : "加载对话失败"
      setErrorState(message)
    }
  }, [queryError, setErrorState])

  const fetchConversationDetail = useCallback(async (conversationId: string) => {
    const existing = useConversationStore.getState().conversations.find(conv => conv.id === conversationId)
    if (existing && existing.messages && existing.messages.length > 0) {
      return existing
    }

    setLoadingConversationId(conversationId)
    try {
      const detail = await conversationApi.fetchConversation(conversationId)
      if (detail) {
        const hasConversation = useConversationStore.getState().conversations.some(conv => conv.id === conversationId)
        if (hasConversation) {
          updateConversationInStore(conversationId, detail)
        } else {
          addConversationToStore(detail)
        }
      }
      return detail
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载对话失败"
      setErrorState(message)
      return null
    } finally {
      setLoadingConversationId(null)
    }
  }, [addConversationToStore, setErrorState, updateConversationInStore])

  useEffect(() => {
    if (!conversationsFromApi) {
      return
    }

    setConversations(conversationsFromApi)

    if (conversationsFromApi.length === 0) {
      selectConversation(null)
      initialisedRef.current = true
      return
    }

    let targetConversationId: string | null = currentIdRef.current

    if (!initialisedRef.current) {
      if (initialPersistedId && conversationsFromApi.some(conv => conv.id === initialPersistedId)) {
        targetConversationId = initialPersistedId
      } else if (!targetConversationId) {
        targetConversationId = conversationsFromApi[0]?.id ?? null
      }
    } else if (targetConversationId && !conversationsFromApi.some(conv => conv.id === targetConversationId)) {
      targetConversationId = conversationsFromApi[0]?.id ?? null
    }

    if (targetConversationId && targetConversationId !== currentIdRef.current) {
      selectConversation(targetConversationId)
      void fetchConversationDetail(targetConversationId)
    } else if (targetConversationId) {
      void fetchConversationDetail(targetConversationId)
    }

    initialisedRef.current = true
  }, [conversationsFromApi, fetchConversationDetail, initialPersistedId, selectConversation, setConversations])

  const refreshConversations = useCallback(async () => {
    setLoadingState(true)
    clearErrorState()
    const result = await refetch()
    if (result.error) {
      const message = result.error instanceof Error ? result.error.message : "刷新对话失败"
      setErrorState(message)
    }
    setLoadingState(false)
  }, [clearErrorState, refetch, setErrorState, setLoadingState])

  const createConversation = useCallback(async (model: string = DEFAULT_MODEL) => {
    setCreatingState(true)
    clearErrorState()
    try {
      const newConversation = await createConversationMutation.mutateAsync(model)
      if (!newConversation) {
        setErrorState("创建对话失败")
        return null
      }

      const storeState = useConversationStore.getState()
      const exists = storeState.conversations.some(conv => conv.id === newConversation.id)

      if (!exists) {
        addConversationToStore(newConversation)
      } else {
        updateConversationInStore(newConversation.id, newConversation)
      }

      selectConversation(newConversation.id)
      currentIdRef.current = newConversation.id
      persistCurrentConversationId(newConversation.id)

      if (!newConversation.messages || newConversation.messages.length === 0) {
        await fetchConversationDetail(newConversation.id)
      }

      return newConversation
    } catch (err) {
      const message = err instanceof Error ? err.message : "创建对话失败"
      setErrorState(message)
      return null
    } finally {
      setCreatingState(false)
    }
  }, [addConversationToStore, clearErrorState, createConversationMutation, fetchConversationDetail, persistCurrentConversationId, selectConversation, setCreatingState, setErrorState, updateConversationInStore])

  const updateConversation = useCallback(async (id: string, updates: Partial<Conversation>) => {
    setUpdatingState(true)
    clearErrorState()
    try {
      const updated = await updateConversationMutation.mutateAsync({ id, updates })
      if (updated) {
        updateConversationInStore(id, updated)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新对话失败"
      setErrorState(message)
    } finally {
      setUpdatingState(false)
    }
  }, [clearErrorState, setUpdatingState, setErrorState, updateConversationInStore, updateConversationMutation])

  const updateConversationWithMessages = useCallback(async (id: string, updates: Partial<Conversation>) => {
    if (updates.messages && updates.updatedAt) {
      updateConversationInStore(id, updates)
      return
    }
    await updateConversation(id, updates)
  }, [updateConversation, updateConversationInStore])

  const deleteConversation = useCallback(async (id: string) => {
    setDeletingState(true)
    clearErrorState()
    try {
      await deleteConversationMutation.mutateAsync(id)
      deleteConversationFromStore(id)
      const remaining = useConversationStore.getState().conversations
      const fallback = remaining.length > 0 ? remaining[0].id : null
      selectConversation(fallback)
      currentIdRef.current = fallback
      persistCurrentConversationId(fallback)
      if (fallback) {
        await fetchConversationDetail(fallback)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "删除对话失败"
      setErrorState(message)
    } finally {
      setDeletingState(false)
    }
  }, [clearErrorState, deleteConversationFromStore, deleteConversationMutation, fetchConversationDetail, selectConversation, setDeletingState, setErrorState, persistCurrentConversationId])

  const setCurrentConversation = useCallback(async (conversationId: string | null) => {
    if (conversationId === currentIdRef.current) {
      return
    }
    selectConversation(conversationId)
    currentIdRef.current = conversationId
    persistCurrentConversationId(conversationId)
    clearErrorState()
    if (conversationId) {
      await fetchConversationDetail(conversationId)
    }
  }, [clearErrorState, fetchConversationDetail, persistCurrentConversationId, selectConversation])

  const getCurrentConversation = useCallback(() => {
    const state = useConversationStore.getState()
    return state.currentConversation || state.conversations.find(conv => conv.id === state.currentConversationId) || null
  }, [])

  const updateConversationMessages = useCallback((id: string, messages: ChatMessage[]) => {
    const now = Date.now()
    const totalTokens = messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0)
    updateConversationInStore(id, {
      messages,
      updatedAt: now,
      metadata: {
        ...(useConversationStore.getState().conversations.find(conv => conv.id === id)?.metadata || {}),
        messageCount: messages.length,
        totalTokens,
        lastActivity: now,
      }
    })
  }, [updateConversationInStore])

  const operationLocks = useMemo(() => new Set<string>(), [])
  const pendingOperations = useMemo(() => new Map<string, number>(), [])
  const isOperationLocked = useCallback(() => false, [])
  const getPendingCount = useCallback(() => 0, [])

  const loading = isStoreLoading || isQueryLoading || isQueryFetching

  return {
    conversations,
    currentConversationId,
    loading,
    error,
    loadingConversationId,
    createConversation,
    updateConversation,
    updateConversationWithMessages,
    deleteConversation,
    setCurrentConversation,
    getCurrentConversation,
    updateConversationMessages,
    refreshConversations,
    operationLocks,
    pendingOperations,
    isOperationLocked,
    getPendingCount,
  }
}



