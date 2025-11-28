/**
 * 聊天中心组件
 * 直接使用 React Query，没有过度包装
 */

"use client"

import React, { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChatHeader } from './chat-header'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { useChatActions } from '@/hooks/use-chat-actions'
import { useConversationQuery, conversationApi, matchesConversationDetailKey } from '@/hooks/api/use-conversations-query'
import { useModelState } from '@/hooks/use-model-state'
import { ALLOWED_MODELS } from '@/lib/ai/models'
import { useChatScroll } from '@/hooks/use-chat-scroll'
import { useChatKeyboard } from '@/hooks/use-chat-keyboard'
import { useChatFocus } from '@/hooks/use-chat-focus'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { PipelineStateProvider } from '@/hooks/use-pipeline-handler'
import { loadChatSettings, saveChatSettings } from '@/lib/utils/settings-storage'
import type {
  Conversation,
  ChatEvent,
  ChatSettings,
  ChatMessage
} from '@/types/chat'
import { useChatState } from '@/hooks/use-chat-state'
import {
  selectSessionError,
  selectIsSessionBusy,
  selectMessages,
  selectComposerInput,
  selectComposerSettings,
  selectComposerEditingTitle,
  selectComposerTempTitle,
  selectHistoryHasMoreBefore,
  selectSyncStatus,
  selectSyncedConversationId,
  selectActiveConversationId
} from '@/lib/chat/chat-state-selectors'
import { toast } from '@/lib/toast/toast'
import * as dt from '@/lib/utils/date-toolkit'
import { CHAT_HISTORY_CONFIG } from '@/lib/config/chat-config'

interface Props {
  conversationId?: string
  onUpdateConversation?: (id: string, updates: Partial<Conversation>) => Promise<void>
  onCreateConversation?: (model?: string) => Promise<Conversation | null>
  onSelectConversation?: (id: string) => void
  onDeleteConversation?: (conversation: Conversation) => void
  prefillMessage?: string
  prefillTitle?: string
  prefillId?: string
}

export function SmartChatCenter({
  conversationId,
  onUpdateConversation,
  onCreateConversation,
  onSelectConversation: _onSelectConversation,
  onDeleteConversation,
  prefillMessage,
  prefillTitle,
  prefillId
}: Props) {
  return (
    <ErrorBoundary fallback={
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <h3 className="text-lg font-semibold mb-2">聊天组件出现了问题</h3>
          <p className="text-muted-foreground mb-4">请尝试刷新页面或创建新对话</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            刷新页面
          </button>
        </div>
      </div>
    }>
      <PipelineStateProvider>
        <SmartChatCenterInternal
          conversationId={conversationId}
          onUpdateConversation={onUpdateConversation}
          onCreateConversation={onCreateConversation}
          onSelectConversation={_onSelectConversation}
          onDeleteConversation={onDeleteConversation}
          prefillMessage={prefillMessage}
          prefillTitle={prefillTitle}
          prefillId={prefillId}
        />
      </PipelineStateProvider>
    </ErrorBoundary>
  )
}

function SmartChatCenterInternal({
  conversationId,
  onUpdateConversation,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
  prefillMessage,
  prefillTitle,
  prefillId
}: Props) {
  const queryClient = useQueryClient()
  const { state, dispatch } = useChatState()
  const streamedResultMessageIds = useRef<Set<string>>(new Set())
  const isFirstMountRef = useRef(true) // 跟踪首次挂载
  const prefillHandledRef = useRef(false)
  const { selectedModel: currentModel, setSelectedModel } = useModelState()
  const detailParams = React.useMemo(() => ({ take: CHAT_HISTORY_CONFIG.initialWindow }), [])

  const sessionError = selectSessionError(state)
  const isSessionBusy = selectIsSessionBusy(state)
  const messages = selectMessages(state)
  const composerInput = selectComposerInput(state)
  const composerSettings = selectComposerSettings(state)
  const editingTitle = selectComposerEditingTitle(state)
  const tempTitle = selectComposerTempTitle(state)
  const hasMoreBefore = selectHistoryHasMoreBefore(state)
  const syncStatus = selectSyncStatus(state)
  const syncedConversationId = selectSyncedConversationId(state)
  const activeConversation = selectActiveConversationId(state)
  const isHistoryLoading = syncStatus === 'loading' && messages.length > 0

  // 获取对话数据 - 只在有有效conversationId时启用
  const { data: conversation, isLoading: isConversationLoading, error: conversationError } = useConversationQuery(
    conversationId || '',
    {
      enabled: !!conversationId,
      params: detailParams
    }
  )

  React.useEffect(() => {
    streamedResultMessageIds.current.clear()
  }, [conversationId])

  // 组件挂载时加载保存的设置
  React.useEffect(() => {
    const savedSettings = loadChatSettings()

    if (savedSettings.reasoning_effort !== undefined ||
        savedSettings.reasoning !== undefined) {
      dispatch({
        type: 'SET_SETTINGS',
        payload: savedSettings
      })
    }

    // 标记首次挂载已完成
    setTimeout(() => {
      isFirstMountRef.current = false
    }, 100)
  }, [dispatch]) // 只在挂载时执行一次

  // 监听设置变化，自动保存
  // 注意: 只监听需要持久化的字段,避免保存不必要的设置(如modelId等)
  React.useEffect(() => {
    // 跳过首次挂载时的保存，避免覆盖刚加载的设置
    if (isFirstMountRef.current) {
      return
    }

    // 只有在字段有值时才保存（避免保存undefined覆盖已有设置）
    const hasValidSettings =
      composerSettings.reasoning_effort !== undefined ||
      composerSettings.reasoning !== undefined

    if (hasValidSettings) {
      saveChatSettings(composerSettings)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerSettings.reasoning_effort, composerSettings.reasoning])

  // 对话切换时重置本地状态，等待最新数据同步
  React.useEffect(() => {
    dispatch({
      type: 'SESSION_SET_CONVERSATION',
      payload: { conversationId: conversationId ?? null }
    })

    dispatch({
      type: 'SESSION_SYNC_STATE',
      payload: {
        conversationId: null,
        status: conversationId ? 'loading' : 'synced'
      }
    })

    if (!conversationId) {
      dispatch({ type: 'SESSION_SET_ERROR', payload: null })
    }
  }, [conversationId, dispatch])

  // 当远端对话数据就绪时同步到本地状态
  React.useEffect(() => {
    if (!conversationId || !conversation) {
      return
    }

    const alreadySynced =
      syncStatus === 'synced' && syncedConversationId === conversation.id

    if (alreadySynced) {
      return
    }

    // 若服务端暂未返回消息且本地已有流式/占位消息，避免覆盖导致“空白等待”
    const nextMessages = Array.isArray(conversation.messages) && conversation.messages.length > 0
      ? conversation.messages
      : messages
    dispatch({ type: 'SET_MESSAGES', payload: nextMessages })

    const hasMore = conversation.messagesWindow?.hasMoreBefore ?? false
    const oldestBeforeId = conversation.messagesWindow?.oldestMessageId ?? null
    dispatch({
      type: 'SET_HISTORY_PAGINATION',
      payload: {
        hasMoreBefore: hasMore,
        cursor: oldestBeforeId ? { beforeId: oldestBeforeId } : null
      }
    })

    dispatch({
      type: 'SESSION_SYNC_STATE',
      payload: {
        conversationId: conversation.id,
        status: 'synced'
      }
    })

    // 同步对话模型到当前选择
    // 重要：只有当对话模型在白名单中时才同步，否则使用当前默认模型
    if (conversation.model) {
      // setSelectedModel 内部会验证模型是否在白名单中
      // 如果不在白名单，会静默忽略，保持当前默认模型
      const isValidModel = ALLOWED_MODELS.some(m => m.id === conversation.model)
      if (isValidModel) {
        dispatch({
          type: 'SET_SETTINGS',
          payload: { modelId: conversation.model }
        })
        setSelectedModel(conversation.model)
      } else {
        // 历史对话使用的模型不在当前白名单中，保持默认模型
        console.info(`[ChatCenter] 对话 ${conversation.id} 的模型 ${conversation.model} 不在白名单中，使用默认模型`)
      }
    }
  }, [
    conversationId,
    conversation,
    syncStatus,
    syncedConversationId,
    dispatch,
    setSelectedModel,
    messages
  ])

  // 注意：已移除新对话自动重置推理设置的逻辑
  // 现在默认使用高思考程度，且用户界面已隐藏推理开关
  // 推理设置将保持用户的默认配置（高思考程度）

  // 事件处理函数 - 简化版本，使用统一的UPDATE_MESSAGE_STREAM
  const handleChatEvent = useCallback((event: ChatEvent) => {
    switch (event.type) {
      case 'started': {
        const linkedUserId = event.originUserMessageId ?? event.userMessage.id
        if (event.mode !== 'retry') {
          dispatch({ type: 'ADD_MESSAGE', payload: event.userMessage })
          dispatch({ type: 'SET_INPUT', payload: '' })
        } else if (linkedUserId) {
          const existingUser = messages.find(msg => msg.id === linkedUserId)
          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: {
              id: linkedUserId,
              updates: {
                metadata: {
                  ...(existingUser?.metadata ?? {}),
                  retryCount: event.retryCount
                }
              }
            }
          })
        }

        const pendingMetadata: ChatMessage['metadata'] = {
          model: composerSettings.modelId || currentModel,
          linkedUserMessageId: linkedUserId,
          requestId: event.requestId,
          ...(typeof event.retryCount === 'number' ? { retryCount: event.retryCount } : {}),
          ...(event.retryOfMessageId ? { retryOfMessageId: event.retryOfMessageId } : {}),
          ...(composerSettings.reasoning_effort
            ? { reasoningEffort: composerSettings.reasoning_effort }
            : {})
        }

        if (event.mode === 'retry' && event.retryOfMessageId) {
          const existingMessage = messages.find(msg => msg.id === event.retryOfMessageId)
          dispatch({
            type: 'UPDATE_MESSAGE_STREAM',
            payload: {
              messageId: event.retryOfMessageId,
              content: '',
              status: 'pending',
              metadata: {
                ...(existingMessage?.metadata ?? {}),
                ...pendingMetadata,
                previousContent: existingMessage?.content
              },
              reasoning: ''
            }
          })
        } else {
          const pendingMessage: ChatMessage = {
            id: event.pendingAssistantId,
            role: 'assistant',
            content: '',
            timestamp: dt.timestamp(),
            status: 'pending',
            metadata: pendingMetadata
          }
          dispatch({ type: 'ADD_MESSAGE', payload: pendingMessage })
        }
        break
      }

      case 'chunk':
        // 【阶段4: responding】首个chunk到达，开始流式响应
        dispatch({
          type: 'SESSION_TRANSITION',
          payload: { status: 'streaming' }
        })
        dispatch({
          type: 'UPDATE_MESSAGE_STREAM',
          payload: {
            messageId: event.pendingAssistantId,
            // 支持新的content字段（完整内容）和旧的delta字段（增量）
            content: event.content,
            delta: event.delta,
            status: 'streaming',
            reasoning: event.reasoning
          }
        })
        break

      case 'done': {
        if (messages.some(message => message.id === event.assistantMessage.id)) {
          dispatch({
            type: 'UPDATE_MESSAGE_STREAM',
            payload: {
              messageId: event.assistantMessage.id,
              content: event.assistantMessage.content,
              status: 'completed',
              metadata: {
                ...(event.assistantMessage.metadata ?? {}),
                previousContent: undefined
              },
              reasoning: event.assistantMessage.reasoning
            }
          })
        } else {
          dispatch({ type: 'ADD_MESSAGE', payload: event.assistantMessage })
        }

        streamedResultMessageIds.current.delete(event.assistantMessage.id)

        dispatch({
          type: 'SESSION_TRANSITION',
          payload: { status: 'done' }
        })
        dispatch({ type: 'SESSION_SET_ERROR', payload: null })
        break
      }

      case 'error': {
        const targetMessage = messages.find(msg => msg.id === event.pendingAssistantId)
        if (event.fallbackMessage) {
          dispatch({
            type: 'UPDATE_MESSAGE_STREAM',
            payload: {
              messageId: event.pendingAssistantId,
              content: event.fallbackMessage.content,
              status: 'error',
              metadata: {
                ...(event.fallbackMessage.metadata ?? {}),
                error: event.error
              }
            }
          })
        } else if (targetMessage) {
          dispatch({
            type: 'UPDATE_MESSAGE_STREAM',
            payload: {
              messageId: event.pendingAssistantId,
              content: targetMessage.metadata?.previousContent ?? targetMessage.content,
              status: 'error',
              metadata: {
                ...(targetMessage.metadata ?? {}),
                error: event.error
              }
            }
          })
        } else {
          dispatch({
            type: 'REMOVE_MESSAGE',
            payload: { messageId: event.pendingAssistantId }
          })
        }

        dispatch({ type: 'SESSION_SET_ERROR', payload: event.error })
        break
      }

      case 'warn':
        toast.warning(event.message, {
          duration: 6000,
          description: '消息生成成功，但保存时遇到问题'
        })
        break

      case 'pipeline:update': {
        const role = event.targetMessageId === event.pendingAssistantId ? 'progress' : 'result'
        const exists = messages.some(message => message.id === event.targetMessageId)

        if (!exists) {
          const placeholderMetadata: ChatMessage['metadata'] = {
            pipelineStateId: event.pipelineStateId,
            pipelineSource: event.source,
            pipelineRole: role,
            ...(role === 'progress' && event.linkedMessageId ? { pipelineLinkedMessageId: event.linkedMessageId } : {}),
            ...(role === 'result' ? { pipelineLinkedMessageId: event.pendingAssistantId } : {}),
            ...(event.error ? { error: event.error } : {})
          }

          const placeholder: ChatMessage = {
            id: event.targetMessageId,
            role: 'assistant',
            content: '',
            timestamp: dt.timestamp(),
            status: event.status,
            metadata: placeholderMetadata
          }
          dispatch({ type: 'ADD_MESSAGE', payload: placeholder })
          if (role === 'result') {
            streamedResultMessageIds.current.add(event.targetMessageId)
          }
        }

        dispatch({
          type: 'UPDATE_PIPELINE_STATE',
          payload: {
            messageId: event.targetMessageId,
            pipelineStateId: event.pipelineStateId,
            source: event.source,
            role,
            status: event.status,
            error: event.error ?? null,
            linkedMessageId: role === 'progress' ? event.linkedMessageId : event.pendingAssistantId
          }
        })

        dispatch({
          type: 'UPDATE_MESSAGE_STREAM',
          payload: {
            messageId: event.targetMessageId,
            status: event.status,
            metadata: event.error ? { error: event.error } : undefined
          }
        })
        break
      }

      case 'pipeline:result-stream': {
        const messageId = event.targetMessageId

        if (!messages.some(message => message.id === messageId)) {
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              id: messageId,
              role: 'assistant',
              content: '',
              timestamp: dt.timestamp(),
              status: 'streaming',
              metadata: {
                pipelineStateId: event.pipelineStateId,
                pipelineRole: 'result',
                pipelineLinkedMessageId: event.pendingAssistantId
              }
            }
          })
          streamedResultMessageIds.current.add(messageId)
        }

        dispatch({
          type: 'UPDATE_PIPELINE_STATE',
          payload: {
            messageId,
            pipelineStateId: event.pipelineStateId,
            role: 'result',
            linkedMessageId: event.pendingAssistantId
          }
        })

        dispatch({
          type: 'UPDATE_MESSAGE_STREAM',
          payload: {
            messageId,
            ...(event.append ? { delta: event.chunk } : { content: event.chunk }),
            status: 'streaming'
          }
        })
        break
      }

      case 'pipeline:result-finalize': {
        const messageId = event.targetMessageId

        if (!messages.some(message => message.id === messageId)) {
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              id: messageId,
              role: 'assistant',
              content: '',
              timestamp: dt.timestamp(),
              status: 'pending',
              metadata: {
                pipelineStateId: event.pipelineStateId,
                pipelineRole: 'result',
                pipelineLinkedMessageId: event.pendingAssistantId
              }
            }
          })
        }

        dispatch({
          type: 'UPDATE_PIPELINE_STATE',
          payload: {
            messageId,
            pipelineStateId: event.pipelineStateId,
            role: 'result',
            status: event.status,
            linkedMessageId: event.pendingAssistantId
          }
        })

        dispatch({
          type: 'UPDATE_MESSAGE_STREAM',
          payload: {
            messageId,
            content: event.content,
            status: event.status,
            metadata: event.metadata
          }
        })

        streamedResultMessageIds.current.delete(messageId)
        break
      }

      case 'pipeline:result-error': {
        const messageId = event.targetMessageId

        if (!messages.some(message => message.id === messageId)) {
          dispatch({
            type: 'ADD_MESSAGE',
            payload: {
              id: messageId,
              role: 'assistant',
              content: '',
              timestamp: dt.timestamp(),
              status: 'error',
              metadata: {
                pipelineStateId: event.pipelineStateId,
                pipelineRole: 'result',
                pipelineLinkedMessageId: event.pendingAssistantId,
                error: event.error
              }
            }
          })
        }

        dispatch({
          type: 'UPDATE_PIPELINE_STATE',
          payload: {
            messageId,
            pipelineStateId: event.pipelineStateId,
            role: 'result',
            status: 'error',
            error: event.error,
            linkedMessageId: event.pendingAssistantId
          }
        })

        dispatch({
          type: 'UPDATE_MESSAGE_STREAM',
          payload: {
            messageId,
            status: 'error',
            content: event.error,
            metadata: { error: event.error }
          }
        })

        streamedResultMessageIds.current.delete(messageId)
        break
      }
    }
  }, [composerSettings, currentModel, dispatch, messages])

  const handleLoadOlderMessages = useCallback(async () => {
    if (!conversation?.id) return
    if (syncStatus === 'loading') return
    if (!conversation.messagesWindow?.hasMoreBefore && !hasMoreBefore) return

    const oldestMessage = messages[0]
    if (!oldestMessage) return

    const targetConversationId = conversation.id

    dispatch({
      type: 'SESSION_SYNC_STATE',
      payload: {
        conversationId: syncedConversationId ?? targetConversationId,
        status: 'loading'
      }
    })

    try {
      const older = await conversationApi.fetchConversation(targetConversationId, {
        take: CHAT_HISTORY_CONFIG.initialWindow,
        beforeId: oldestMessage.id
      })

      if (older?.messages?.length) {
        dispatch({ type: 'PREPEND_MESSAGES', payload: older.messages })
      }

      if (older?.messagesWindow) {
        const { hasMoreBefore: moreBefore = false, oldestMessageId = null } = older.messagesWindow
        dispatch({
          type: 'SET_HISTORY_PAGINATION',
          payload: {
            hasMoreBefore: moreBefore,
            cursor: oldestMessageId ? { beforeId: oldestMessageId } : null
          }
        })
      }

      queryClient.setQueriesData(
        {
          predicate: (query) => matchesConversationDetailKey(query.queryKey, targetConversationId)
        },
        (oldData: Conversation | null | undefined) => {
          if (!oldData) return oldData
          if (!older) return oldData

          const existingMessages = oldData.messages || []
          const existingIds = new Set(existingMessages.map(msg => msg.id))
          const prefix = (older.messages || []).filter(msg => !existingIds.has(msg.id))
          const mergedMessages = prefix.length > 0 ? [...prefix, ...existingMessages] : existingMessages

          const nextWindow = older.messagesWindow || oldData.messagesWindow
            ? {
                size: mergedMessages.length,
                hasMoreBefore: older.messagesWindow?.hasMoreBefore ?? oldData.messagesWindow?.hasMoreBefore ?? false,
                oldestMessageId: older.messagesWindow?.oldestMessageId ?? oldData.messagesWindow?.oldestMessageId ?? (mergedMessages[0]?.id ?? null),
                newestMessageId: oldData.messagesWindow?.newestMessageId ?? (mergedMessages[mergedMessages.length - 1]?.id ?? null),
                request: {
                  take: oldData.messagesWindow?.request?.take ?? older.messagesWindow?.request?.take ?? null,
                  beforeId: older.messagesWindow?.request?.beforeId ?? oldData.messagesWindow?.request?.beforeId ?? null
                }
              }
            : undefined

          return {
            ...oldData,
            messages: mergedMessages,
            messagesWindow: nextWindow,
            metadata: {
              ...oldData.metadata,
              messageCount: older.messageCount ?? oldData.metadata?.messageCount ?? mergedMessages.length
            }
          }
        }
      )

      if (conversation?.id === targetConversationId) {
        dispatch({
          type: 'SESSION_SYNC_STATE',
          payload: {
            conversationId: targetConversationId,
            status: 'synced'
          }
        })
      }
    } catch (_error) {
      console.error('Failed to load older messages:', _error)
      toast.error('加载历史消息失败', { description: '请稍后重试' })
      if (conversation?.id === targetConversationId) {
        dispatch({
          type: 'SESSION_SYNC_STATE',
          payload: {
            conversationId: targetConversationId,
            status: 'error'
          }
        })
      }
    }
  }, [
    conversation,
    syncStatus,
    hasMoreBefore,
    messages,
    syncedConversationId,
    dispatch,
    queryClient
  ])

  // 聊天操作 - 使用事件协议，优先使用用户选择的模型
  // 动态获取conversationId，避免新创建的对话消息丢失
  const { sendMessage, stopGeneration, retryMessage } = useChatActions({
    conversationId: conversation?.id,
    onEvent: handleChatEvent,
    messages,
    model: composerSettings.modelId || currentModel,
    settings: composerSettings
  })

  // 自动发送对齐预填消息
  // 当 prefillMessage 变化时重置处理标记，允许多次推送
  useEffect(() => {
    if (prefillMessage || prefillId) {
      prefillHandledRef.current = false
    }
  }, [prefillMessage, prefillId])

  useEffect(() => {
    if (!prefillMessage || prefillHandledRef.current) return

    // 使用 currentModel 作为 fallback，确保总有可用模型
    const effectiveModel = composerSettings.modelId || currentModel
    if (!effectiveModel) {
      toast.warning('请先选择模型', { description: '选择好模型后，系统才会自动发送对齐提示' })
      return
    }

    // dev 下 StrictMode 会二次 mount，使用完整的 message + title 作为唯一标识
    // 这样同一商家的不同次推送（不同时间戳）不会被阻止
    const markerSource = prefillId ?? `${prefillMessage.slice(0, 32)}-${prefillTitle || ''}`
    const prefillMarker = typeof window !== 'undefined'
      ? `prefill-sent-${markerSource}`
      : null
    if (prefillMarker) {
      const status = window.sessionStorage.getItem(prefillMarker)
      if (status === 'sent' || status === 'pending') {
        prefillHandledRef.current = true
        return
      }
      window.sessionStorage.setItem(prefillMarker, 'pending')
    }

    // 防止消息流触发的状态更新导致重复执行预填
    prefillHandledRef.current = true

    const run = async () => {
      let targetConversationId = conversation?.id ?? activeConversation
      try {
        // 每次推送都创建新对话，这是用户期望的行为
        if (onCreateConversation) {
          const newConversation = await onCreateConversation(effectiveModel)
          targetConversationId = newConversation?.id ?? null
          if (newConversation?.id && onSelectConversation) {
            onSelectConversation(newConversation.id)
          }
        }
        if (!targetConversationId) {
          toast.error('无法自动对齐：对话未就绪')
          if (prefillMarker) {
            window.sessionStorage.removeItem(prefillMarker)
          }
          prefillHandledRef.current = false
          return
        }
        await sendMessage(prefillMessage, targetConversationId)
        if (prefillTitle && onUpdateConversation) {
          onUpdateConversation(targetConversationId, { title: prefillTitle }).catch(() => {})
        }
        if (prefillMarker) {
          window.sessionStorage.setItem(prefillMarker, 'sent')
        }
        toast.success('已自动发送对齐信息', {
          description: '系统已根据商家档案生成对齐提示'
        })
      } catch (e) {
        console.error('prefill failed', e)
        if (prefillMarker) {
          window.sessionStorage.removeItem(prefillMarker)
        }
        prefillHandledRef.current = false
        toast.error('自动发送失败', {
          description: '请手动粘贴对齐信息或刷新页面重试'
        })
      }
    }

    run()
  }, [
    prefillMessage,
    prefillTitle,
    prefillId,
    conversation?.id,
    activeConversation,
    onCreateConversation,
    onSelectConversation,
    onUpdateConversation,
    sendMessage,
    composerSettings.modelId,
    currentModel
  ])

  // 停止生成的处理 - 确保重置全局状态
  const handleStopGeneration = useCallback(() => {
    stopGeneration()
    // 立即重置全局聊天状态，确保用户可以继续对话
    dispatch({
      type: 'SESSION_TRANSITION',
      payload: { status: 'done' }
    })
    dispatch({ type: 'SESSION_SET_ERROR', payload: null })
  }, [stopGeneration, dispatch])

  const handleSend = useCallback(async () => {
    if (isSessionBusy) return

    const trimmedInput = composerInput.trim()
    if (!trimmedInput) {
      return
    }

    dispatch({
      type: 'SESSION_TRANSITION',
      payload: { status: 'preparing' }
    })

    let targetConversationId = conversation?.id ?? activeConversation
    if (!targetConversationId && onCreateConversation) {
      try {
        const newConversation = await onCreateConversation(composerSettings.modelId || currentModel)
        targetConversationId = newConversation?.id ?? null
        if (!targetConversationId) {
          toast.error('创建对话失败，请重试')
          dispatch({
            type: 'SESSION_TRANSITION',
            payload: { status: 'idle' }
          })
          return
        }
        if (onSelectConversation) {
          onSelectConversation(targetConversationId)
        }
        // 注意：已移除新对话重置推理设置的逻辑，保持默认高思考程度
      } catch (_error) {
        toast.error('创建对话失败，请重试')
        dispatch({
          type: 'SESSION_TRANSITION',
          payload: { status: 'idle' }
        })
        return
      }
    }

    if (!targetConversationId) {
      toast.error('无法发送消息：对话未就绪')
      dispatch({
        type: 'SESSION_TRANSITION',
        payload: { status: 'idle' }
      })
      return
    }

    dispatch({ type: 'SESSION_SET_ERROR', payload: null })

    const message = trimmedInput
    dispatch({ type: 'SET_INPUT', payload: '' })

    dispatch({
      type: 'SESSION_TRANSITION',
      payload: { status: 'requesting' }
    })

    sendMessage(message, targetConversationId)
  }, [
    composerInput,
    isSessionBusy,
    composerSettings.modelId,
    conversation?.id,
    activeConversation,
    onCreateConversation,
    onSelectConversation,
    currentModel,
    sendMessage,
    dispatch
  ])

  const handleRetryMessage = useCallback((messageId: string) => {
    if (!messageId) return
    retryMessage(messageId).catch((error) => {
      console.error('retry message failed', error)
    })
  }, [retryMessage])

  // 标题编辑相关处理
  const handleEditTitle = useCallback(() => {
    if (conversation?.title) {
      dispatch({ type: 'SET_EDITING_TITLE', payload: true })
      dispatch({ type: 'SET_TEMP_TITLE', payload: conversation.title })
    }
  }, [conversation?.title, dispatch])

  const handleTitleChange = useCallback((title: string) => {
    dispatch({ type: 'SET_TEMP_TITLE', payload: title })
  }, [dispatch])

  const handleTitleSubmit = useCallback(async () => {
    if (tempTitle.trim() && conversation?.id && onUpdateConversation) {
      try {
        await onUpdateConversation(conversation.id, { title: tempTitle.trim() })
        // 成功后才关闭编辑状态
        dispatch({ type: 'SET_EDITING_TITLE', payload: false })
        dispatch({ type: 'SET_TEMP_TITLE', payload: '' })
      } catch (error) {
        console.error('Failed to update conversation title:', error)
        toast.error('标题更新失败，请重试')
        // 发生错误时不关闭编辑状态，让用户可以重试
      }
    } else {
      // 如果没有内容或条件不满足，直接关闭编辑状态
      dispatch({ type: 'SET_EDITING_TITLE', payload: false })
      dispatch({ type: 'SET_TEMP_TITLE', payload: '' })
    }
  }, [tempTitle, conversation?.id, onUpdateConversation, dispatch])

  const handleCancelEdit = useCallback(() => {
    // 取消编辑，不保存更改
    dispatch({ type: 'SET_EDITING_TITLE', payload: false })
    dispatch({ type: 'SET_TEMP_TITLE', payload: '' })
  }, [dispatch])

  // 删除对话处理 - 传递整个对话对象给父组件
  const handleDeleteConversation = useCallback(() => {
    if (conversation && onDeleteConversation) {
      onDeleteConversation(conversation)
    }
  }, [conversation, onDeleteConversation])

  // 模型切换处理 - 同步到 useModelState 并持久化到后端
  const handleSettingsChange = useCallback(async (settings: Partial<ChatSettings>) => {
    dispatch({ type: 'SET_SETTINGS', payload: settings })

    // 同步模型选择到 useModelState
    if (settings.modelId) {
      setSelectedModel(settings.modelId)

      // 注意：已移除模型切换时自动调整推理强度的逻辑
      // 现在默认始终保持高思考程度，用户可通过设置手动调整
      // 推理功能不再与模型的:thinking后缀绑定

      // 如果是在现有对话中切换模型，持久化到后端
      if (conversationId && onUpdateConversation) {
        try {
          await onUpdateConversation(conversationId, {
            model: settings.modelId
          })
        } catch (error) {
          console.error('Failed to update conversation model:', error)
          toast.error('模型切换失败，设置未保存')

          // 【关键修复】失败时读取最新的React Query缓存或当前conversation
          // 避免使用闭包中的陈年快照导致回滚到旧会话模型
          const latestConversation = queryClient.getQueryData<Conversation>(
            ['conversations', 'detail', conversationId]
          )
          const fallbackModel = latestConversation?.model || conversation?.model

          if (fallbackModel) {
            setSelectedModel(fallbackModel)
            dispatch({ type: 'SET_SETTINGS', payload: { modelId: fallbackModel } })
          }
        }
      }
    }
  }, [setSelectedModel, conversationId, onUpdateConversation, conversation, queryClient, dispatch])

  // 滚动管理
  const { scrollAreaRef, scrollToBottom: _scrollToBottom } = useChatScroll({
    messages,
    isLoading: isSessionBusy
  })

  // 焦点管理
  const { textareaRef, focusInput } = useChatFocus({
    isLoading: isSessionBusy,
    autoFocus: true
  })

  // 键盘快捷键
  const { handleKeyboardShortcuts } = useChatKeyboard({
    state,
    onSendMessage: () => handleSend(),
    onStopGeneration: handleStopGeneration,
    onCreateConversation,
    onFocusInput: focusInput,
    textareaRef
  })

  // 注册全局键盘快捷键
  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts)
    return () => document.removeEventListener('keydown', handleKeyboardShortcuts)
  }, [handleKeyboardShortcuts])

  // 处理对话加载状态
  if (conversationId && isConversationLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">正在加载对话历史...</p>
        </div>
      </div>
    )
  }

  // 处理对话不存在的情况
  if (conversationId && conversationError) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center p-8">
          <h3 className="text-lg font-semibold mb-2">无法加载对话</h3>
          <p className="text-muted-foreground mb-4">
            {conversationError instanceof Error ? conversationError.message : '对话可能已被删除或不存在'}
          </p>
          <button
            onClick={() => onCreateConversation?.()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            创建新对话
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        conversation={conversation || undefined}
        editingTitle={editingTitle}
        tempTitle={tempTitle}
        isLoading={isSessionBusy}
        onCreateConversation={onCreateConversation}
        onEditTitle={handleEditTitle}
        onTitleChange={handleTitleChange}
        onTitleSubmit={handleTitleSubmit}
        onCancelEdit={handleCancelEdit}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* 消息区域 - 使用 flex-1 占据剩余空间，避免挤占整个高度 */}
      <div className="flex-1 min-h-0">
        <ChatMessages
          ref={scrollAreaRef}
          messages={messages}
          isLoading={isSessionBusy && messages.length === 0}
          error={sessionError}
          onRetryMessage={handleRetryMessage}
          onLoadMore={hasMoreBefore ? handleLoadOlderMessages : undefined}
          hasMoreBefore={hasMoreBefore}
          isLoadingMore={isHistoryLoading}
        />
      </div>

      <ChatInput
        ref={textareaRef}
        input={composerInput}
        isLoading={isSessionBusy}
        settings={composerSettings}
        onInputChange={(value) => dispatch({ type: 'SET_INPUT', payload: value })}
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        onStop={handleStopGeneration}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  )
}
