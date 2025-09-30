/**
 * 聊天相关的统一类型定义
 * 用于 SmartChatCenter 组件及其子组件
 */

// 消息状态类型
export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'error'

// 基础消息类型
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool' | string // 支持未来扩展
  content: string
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
}

// 对话类型
export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  model: string
  createdAt: number
  updatedAt: number
  temperature?: number
  maxTokens?: number
  contextAware?: boolean
  metadata?: ConversationMetadata
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
  creativeMode?: boolean  // 创作模式：启用长文本优化，使用90%的模型上下文容量
}

// 聊天状态
export type ResponsePhase = 'idle' | 'queueing' | 'organizing' | 'responding'

export interface ChatState {
  // 消息相关
  messages: ChatMessage[]
  input: string
  isLoading: boolean
  error: string | null

  // 设置相关
  settings: ChatSettings

  // UI 状态
  editingTitle: boolean
  tempTitle: string

  // 生成流程阶段
  responsePhase: ResponsePhase
  // 移除 previewContent，状态直接存储在 message.status 中
}

// 聊天操作类型
export type ChatAction =
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<ChatMessage> } }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_SETTINGS'; payload: Partial<ChatSettings> }
  | { type: 'SET_EDITING_TITLE'; payload: boolean }
  | { type: 'SET_TEMP_TITLE'; payload: string }
  | { type: 'SET_RESPONSE_PHASE'; payload: ResponsePhase }
  | { type: 'RESET_STATE' }
  // 新的统一流式更新 action，替代原来的多个 action
  | {
      type: 'UPDATE_MESSAGE_STREAM';
      payload: {
        messageId: string;
        content?: string;
        delta?: string;
        status: MessageStatus;
        metadata?: Partial<MessageMetadata>
      }
    }
  // 保留向后兼容的 action（逐步废弃）
  | { type: 'SEND_USER_MESSAGE'; payload: ChatMessage }
  | { type: 'REMOVE_MESSAGE'; payload: { messageId: string } }

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

// 事件协议类型
export interface ChatEventProtocol {
  started: {
    type: 'started'
    requestId: string
    conversationId?: string
    userMessage: ChatMessage
    pendingAssistantId: string
  }
  chunk: {
    type: 'chunk'
    requestId: string
    delta: string
    pendingAssistantId: string
  }
  done: {
    type: 'done'
    requestId: string
    conversationId?: string
    assistantMessage: ChatMessage
    tokens?: number
    finishedAt: number
  }
  error: {
    type: 'error'
    requestId: string
    pendingAssistantId: string
    error: string
    recoverable: boolean
    fallbackMessage?: ChatMessage
  }
  warn: {
    type: 'warn'
    requestId?: string
    message: string
  }
}

export type ChatEvent = ChatEventProtocol[keyof ChatEventProtocol]

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
  messages: [],
  input: '',
  isLoading: false,
  error: null,
  settings: DEFAULT_CHAT_SETTINGS,
  editingTitle: false,
  tempTitle: '',
  responsePhase: 'idle',
}
