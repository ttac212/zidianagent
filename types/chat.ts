/**
 * 聊天相关的统一类型定义
 * 用于 SmartChatCenter 组件及其子组件
 */

import type {
  DouyinPipelineProgress,
  DouyinPipelineStep,
  DouyinVideoInfo
} from '@/lib/douyin/pipeline-steps'

import type {
  DouyinCommentsProgress,
  DouyinCommentsPipelineStep,
  DouyinCommentsVideoInfo,
  DouyinCommentsStatistics
} from '@/lib/douyin/comments-pipeline-steps'

import type { PipelinePartialKey } from '@/lib/douyin/schema'

export type PipelineSource = 'douyin-video' | 'douyin-comments'
export type PipelineRole = 'progress' | 'result'
export type PipelineStage = 'progress' | 'info' | 'partial' | 'done' | 'error'

// 消息状态类型
export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'error'

// 基础消息类型
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool' | string // 支持未来扩展
  content: string
  reasoning?: string // 推理内容（ZenMux 推理模型）
  timestamp: number
  tokens?: number
  metadata?: MessageMetadata
  status: MessageStatus // 修复：消息状态为必需字段，默认为 'completed'
}

// 消息元数据
export interface MessageMetadata {
  model?: string
  temperature?: number
  processingTime?: number
  error?: string
  reasoningEffort?: 'low' | 'medium' | 'high'
  requestId?: string
  linkedUserMessageId?: string
  retryCount?: number
  retryOfMessageId?: string
  previousContent?: string
  pipelineStateId?: string
  pipelineSource?: PipelineSource
  pipelineRole?: PipelineRole
  pipelineLinkedMessageId?: string
}

// 对话类型
export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  model: string
  createdAt: number
  updatedAt: number
  messageCount?: number
  temperature?: number
  maxTokens?: number
  contextAware?: boolean
  metadata?: ConversationMetadata
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

// 对话元数据
export interface ConversationMetadata {
  totalTokens?: number
  messageCount?: number
  lastActivity?: number
  tags?: string[]
  lastMessage?: {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
  } | null
}

// 聊天设置
export interface ChatSettings {
  modelId: string
  temperature: number
  contextAware: boolean
  maxTokens?: number
  systemPrompt?: string
  creativeMode?: boolean
  reasoning_effort?: 'low' | 'medium' | 'high'  // ZenMux 推理强度（仅推理模型支持）
  reasoning?: {
    enabled: boolean  // 是否启用推理模式
  }
}

// 新版聊天状态
export type ChatSessionStatus = 'idle' | 'preparing' | 'requesting' | 'streaming' | 'done' | 'error'
export type ChatHistorySyncStatus = 'idle' | 'loading' | 'synced' | 'error'

export interface ChatSessionState {
  conversationId: string | null
  status: ChatSessionStatus
  error: string | null
  sync: {
    conversationId: string | null
    status: ChatHistorySyncStatus
  }
  updatedAt: number | null
}

export interface ChatHistoryState {
  messages: ChatMessage[]
  pagination: {
    hasMoreBefore: boolean
    cursor: {
      beforeId: string | null
    } | null
  }
}

export interface ChatComposerState {
  input: string
  settings: ChatSettings
  editingTitle: boolean
  tempTitle: string
}

export interface ChatState {
  session: ChatSessionState
  history: ChatHistoryState
  composer: ChatComposerState
}

// 聊天操作类型
export type ChatAction =
  // 新 session 状态机
  | { type: 'SESSION_SET_CONVERSATION'; payload: { conversationId: string | null } }
  | { type: 'SESSION_TRANSITION'; payload: { status: ChatSessionStatus; error?: string | null; updatedAt?: number | null; conversationId?: string | null } }
  | { type: 'SESSION_SET_ERROR'; payload: string | null }
  | { type: 'SESSION_SYNC_STATE'; payload: { conversationId: string | null; status: ChatHistorySyncStatus } }
  | { type: 'SESSION_RESET'; payload?: { keepConversation?: boolean; keepComposer?: boolean } }
  // composer 区域
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'SET_SETTINGS'; payload: Partial<ChatSettings> }
  | { type: 'SET_EDITING_TITLE'; payload: boolean }
  | { type: 'SET_TEMP_TITLE'; payload: string }
  // history 区域
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<ChatMessage> } }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'PREPEND_MESSAGES'; payload: ChatMessage[] }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'REMOVE_MESSAGE'; payload: { messageId: string } }
  | { type: 'SET_HISTORY_PAGINATION'; payload: { hasMoreBefore: boolean; cursor?: { beforeId?: string | null } | null } }
  // 兼容旧标志
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_RESPONSE_PHASE'; payload: 'idle' | 'queueing' | 'organizing' | 'requesting' | 'responding' }
  | { type: 'RESET_STATE' }
  // 流式与 Douyin 事件
  | {
      type: 'UPDATE_MESSAGE_STREAM';
      payload: {
        messageId: string;
        content?: string;
        delta?: string;
        status: MessageStatus;
        metadata?: Partial<MessageMetadata>;
        reasoning?: string;
      }
    }
  | {
      type: 'UPDATE_PIPELINE_STATE';
      payload: {
        messageId: string;
        pipelineStateId?: string | null;
        source?: PipelineSource;
        role?: PipelineRole;
        status?: MessageStatus;
        error?: string | null;
        linkedMessageId?: string | null;
      };
    }

// 组件 Props 类型
export interface SmartChatCenterProps {
  conversation?: Conversation
  conversations?: Conversation[]
  selectedModel: string
  selectedText?: string
  editorContextEnabled?: boolean
  editorContent?: string
  onUpdateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>
  onCreateConversation: (model?: string) => Promise<Conversation | null>
  onDeleteConversation: (id: string) => void
  onSelectConversation: (id: string) => void
  onSelectedModelChange?: (modelId: string) => void
}

export interface ChatHeaderProps {
  conversation?: Conversation
  editingTitle: boolean
  tempTitle: string
  isLoading: boolean
  onCreateConversation?: (model?: string) => Promise<Conversation | null>
  onEditTitle: () => void
  onTitleChange: (title: string) => void
  onTitleSubmit: () => void
  onCancelEdit: () => void
  onDeleteConversation?: () => void
}

export interface ChatMessagesProps {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  onCopyMessage?: (messageId: string) => void
  onRetryMessage?: (messageId: string) => void
  onLoadMore?: () => void
  hasMoreBefore?: boolean
  isLoadingMore?: boolean
  // 移除 responsePhase 和 previewContent，状态直接在消息中
}

export interface ChatInputProps {
  input: string
  isLoading: boolean
  settings: ChatSettings
  selectedText?: string
  onInputChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  onStop: () => void
  onSettingsChange: (settings: Partial<ChatSettings>) => void
}

export interface MessageItemProps {
  message: ChatMessage
  onCopy?: (messageId: string) => void
  onRetry?: () => void
}

// 快捷操作类型
export interface QuickAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  action: (selectedText: string) => string
  shortcut?: string
}

// 错误类型
export interface ChatError {
  code: string
  message: string
  details?: any
  timestamp: number
}

// Douyin 流水线事件载荷
export type DouyinProgressEventPayload = DouyinPipelineProgress

export interface DouyinInfoEventPayload {
  videoInfo: DouyinVideoInfo
}

export interface DouyinPartialEventPayload {
  key: PipelinePartialKey  // 使用统一契约定义
  data: string
  append?: boolean
}

export interface DouyinDoneEventPayload {
  markdown: string
  videoInfo: DouyinVideoInfo
  transcript: string
}

export type DouyinProgressStepStatus = 'pending' | 'active' | 'completed' | 'error'

export interface DouyinProgressStep {
  key: DouyinPipelineStep
  status: DouyinProgressStepStatus
  detail?: string
  labelOverride?: string
  descriptionOverride?: string
}

export interface DouyinProgressState {
  steps: DouyinProgressStep[]
  percentage: number
  status: 'running' | 'completed' | 'failed'
  error?: string
  updatedAt: number
  videoInfo?: DouyinVideoInfo
  transcript?: string
  markdownPreview?: string
}

// Douyin 评论分析事件载荷
export type DouyinCommentsProgressEventPayload = DouyinCommentsProgress

export interface DouyinCommentsInfoEventPayload {
  videoInfo: DouyinCommentsVideoInfo
  statistics?: DouyinCommentsStatistics
}

export interface DouyinCommentsPartialEventPayload {
  key: Extract<PipelinePartialKey, 'analysis' | 'warn'>  // 评论只使用这两个key
  data: string
  append?: boolean
}

export interface DouyinCommentsDoneEventPayload {
  markdown: string
  videoInfo: DouyinCommentsVideoInfo
  statistics: DouyinCommentsStatistics
  analysis: {
    sentiment: any
    coreTopics: any
    userProfile: any
    suggestions: any
  }
}

export interface DouyinCommentsProgressState {
  steps: DouyinCommentsProgressStep[]
  percentage: number
  status: 'running' | 'completed' | 'failed'
  error?: string
  updatedAt: number
  videoInfo?: DouyinCommentsVideoInfo
  statistics?: DouyinCommentsStatistics
  analysisPreview?: string
}

export interface DouyinCommentsProgressStep {
  key: DouyinCommentsPipelineStep
  status: 'pending' | 'active' | 'completed' | 'error'
  detail?: string
  labelOverride?: string
  descriptionOverride?: string
}

export interface PipelineUpdateEvent {
  type: 'pipeline:update'
  requestId: string
  pendingAssistantId: string
  targetMessageId: string
  pipelineStateId: string
  source: PipelineSource
  stage: PipelineStage
  status: MessageStatus
  error?: string
  linkedMessageId?: string
}

export interface PipelineResultStreamEvent {
  type: 'pipeline:result-stream'
  requestId: string
  pendingAssistantId: string
  targetMessageId: string
  pipelineStateId: string
  chunk: string
  append: boolean
}

export interface PipelineResultFinalizeEvent {
  type: 'pipeline:result-finalize'
  requestId: string
  pendingAssistantId: string
  targetMessageId: string
  pipelineStateId: string
  content: string
  status: MessageStatus
  metadata?: Partial<MessageMetadata>
}

export interface PipelineResultErrorEvent {
  type: 'pipeline:result-error'
  requestId: string
  pendingAssistantId: string
  targetMessageId: string
  pipelineStateId: string
  error: string
}

export type ChatEvent =
  | {
      type: 'started'
      requestId: string
      conversationId?: string
      userMessage: ChatMessage
      pendingAssistantId: string
      mode?: 'standard' | 'retry'
      originUserMessageId?: string
      retryOfMessageId?: string
      retryCount?: number
    }
  | {
      type: 'chunk'
      requestId: string
      delta?: string
      content?: string
      reasoning?: string
      pendingAssistantId: string
    }
  | {
      type: 'done'
      requestId: string
      conversationId?: string
      assistantMessage: ChatMessage
      tokens?: number
      finishedAt: number
    }
  | {
      type: 'error'
      requestId: string
      pendingAssistantId: string
      error: string
      recoverable: boolean
      fallbackMessage?: ChatMessage
    }
  | {
      type: 'warn'
      requestId?: string
      message: string
    }
  | PipelineUpdateEvent
  | PipelineResultStreamEvent
  | PipelineResultFinalizeEvent
  | PipelineResultErrorEvent

// 性能监控类型
export interface PerformanceMetrics {
  renderTime: number
  messageCount: number
  memoryUsage?: number
  scrollPerformance?: number
  timestamp?: number
}

// 可访问性配置
export interface AccessibilityConfig {
  announceMessages: boolean
  keyboardNavigation: boolean
  highContrast: boolean
  reducedMotion: boolean
}

// 主题配置
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system'
  primaryColor: string
  fontSize: 'small' | 'medium' | 'large'
  compactMode: boolean
}

// Hook 返回类型
export interface UseChatStateReturn {
  state: ChatState
  dispatch: React.Dispatch<ChatAction>
}

export interface UseChatActionsReturn {
  sendMessage: (content: string, dynamicConversationId?: string) => Promise<void>
  stopGeneration: () => void
  copyMessage: (content: string) => void
  retryMessage: (messageId: string) => Promise<void>
  clearMessages: () => void
  updateSettings: (settings: Partial<ChatSettings>) => void
  addQuickActionMessage: (template: string, selectedText?: string) => void
  handleTemplateInject: (template: string) => void
  updateMessageStatus: (messageId: string, updates: Partial<ChatMessage>) => void
  handleErrorRetry: () => Promise<void> | void
  batchOperations: {
    importMessages: (messages: ChatMessage[]) => void
    exportMessages: () => { role: string; content: string; timestamp: number }[]
    searchMessages: (query: string) => ChatMessage[]
  }
}

export interface UseChatEffectsReturn {
  scrollToBottom: (smooth?: boolean) => void
  focusInput: () => void
  handleKeyboardShortcuts: (e: KeyboardEvent) => void
  scrollAreaRef: React.RefObject<HTMLDivElement | null>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

// 常量类型
export const CHAT_CONSTANTS = {
  MAX_MESSAGE_LENGTH: 20000,
  MAX_MESSAGES_DISPLAY: 100,
  SCROLL_THRESHOLD: 100,
  TYPING_INDICATOR_DELAY: 500,
  AUTO_SAVE_INTERVAL: 5000,
  PERFORMANCE_SAMPLE_RATE: 0.1,
} as const

export const KEYBOARD_SHORTCUTS = {
  SEND_MESSAGE: 'Enter',
  SEND_MESSAGE_ALT: 'Ctrl+Enter',
  STOP_GENERATION: 'Escape',
  NEW_CONVERSATION: 'Ctrl+N',
  FOCUS_INPUT: 'Ctrl+L',
  TOGGLE_SETTINGS: 'Ctrl+,',
} as const

// 默认值
import { DEFAULT_MODEL } from "@/lib/ai/models"
export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  modelId: DEFAULT_MODEL,
  temperature: 1.0,
  contextAware: false,
  maxTokens: 4096,
}

export const DEFAULT_CHAT_STATE: ChatState = {
  session: {
    conversationId: null,
    status: 'idle',
    error: null,
    sync: {
      conversationId: null,
      status: 'idle'
    },
    updatedAt: null
  },
  history: {
    messages: [],
    pagination: {
      hasMoreBefore: false,
      cursor: null
    }
  },
  composer: {
    input: '',
    settings: { ...DEFAULT_CHAT_SETTINGS },
    editingTitle: false,
    tempTitle: ''
  }
}
