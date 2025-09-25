/**
 * 聊天状态管理 Hook
 * 使用 useReducer 管理复杂的聊天状态
 */

import { useReducer, useCallback } from 'react'
import type {
  ChatState,
  ChatAction,
  ChatSettings,
  ChatMessage,
  UseChatStateReturn
} from '@/types/chat'
import { DEFAULT_CHAT_STATE } from '@/types/chat'

// 状态 reducer
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: action.payload }
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    
    case 'ADD_MESSAGE':
      return { 
        ...state, 
        messages: [...state.messages, action.payload],
        error: null // 清除之前的错误
      }
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg => 
          msg.id === action.payload.id 
            ? { ...msg, ...action.payload.updates }
            : msg
        )
      }
    
    case 'SET_MESSAGES':
      // 批量设置消息，用于对话切换
      return { ...state, messages: action.payload }
    
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] }
    
    case 'SET_SETTINGS':
      return { 
        ...state, 
        settings: { ...state.settings, ...action.payload }
      }
    
    case 'SET_EDITING_TITLE':
      return { ...state, editingTitle: action.payload }
    
    case 'SET_TEMP_TITLE':
      return { ...state, tempTitle: action.payload }
    
    case 'SET_RESPONSE_PHASE':
      return { ...state, responsePhase: action.payload }
    
    case 'SET_PREVIEW_CONTENT':
      return { ...state, previewContent: action.payload }
    
    case 'RESET_STATE':
      return { ...DEFAULT_CHAT_STATE }
    
    default:
      return state
  }
}

/**
 * 聊天状态管理 Hook
 * @param initialState 初始状态
 * @returns 状态和 dispatch 函数
 */
export function useChatState(initialState?: Partial<ChatState>): UseChatStateReturn {
  const [state, dispatch] = useReducer(
    chatReducer, 
    { ...DEFAULT_CHAT_STATE, ...initialState }
  )

  return { state, dispatch }
}

/**
 * 聊天状态选择器 Hook
 * 用于优化性能，只在特定状态变化时重新渲染
 */
export function useChatStateSelector<T>(
  state: ChatState,
  selector: (state: ChatState) => T,
  deps: React.DependencyList = []
): T {
  return useCallback(() => selector(state), [state, ...deps])()
}

/**
 * 消息相关的状态选择器
 */
export const messageSelectors = {
  // 获取最后一条消息
  getLastMessage: (state: ChatState): ChatMessage | null => 
    state.messages.length > 0 ? state.messages[state.messages.length - 1] : null,
  
  // 获取用户消息数量
  getUserMessageCount: (state: ChatState): number =>
    state.messages.filter(msg => msg.role === 'user').length,
  
  // 获取助手消息数量
  getAssistantMessageCount: (state: ChatState): number =>
    state.messages.filter(msg => msg.role === 'assistant').length,
  
  // 获取总 token 数
  getTotalTokens: (state: ChatState): number =>
    state.messages.reduce((total, msg) => total + (msg.tokens || 0), 0),
  
  // 检查是否有错误消息
  hasErrorMessages: (state: ChatState): boolean =>
    state.messages.some(msg => msg.metadata?.error),
  
  // 获取最近的错误消息
  getLastErrorMessage: (state: ChatState): ChatMessage | null => {
    const errorMessages = state.messages.filter(msg => msg.metadata?.error)
    return errorMessages.length > 0 ? errorMessages[errorMessages.length - 1] : null
  }
}

/**
 * UI 状态选择器
 */
export const uiSelectors = {
  // 检查是否可以发送消息
  canSendMessage: (state: ChatState): boolean =>
    !state.isLoading && state.input.trim().length > 0,
  
  // 检查是否显示停止按钮
  shouldShowStopButton: (state: ChatState): boolean =>
    state.isLoading,
  
  // 检查是否显示错误提示
  shouldShowError: (state: ChatState): boolean =>
    state.error !== null,
  
  // 获取输入框占位符文本
  getInputPlaceholder: (state: ChatState): string => {
    if (state.isLoading) return 'AI正在回复中...'
    if (state.messages.length === 0) return '请输入您想要创作的内容主题，比如：美食、旅行、生活技巧等...'
    return '继续对话...'
  }
}

/**
 * 设置相关的状态选择器
 */
export const settingsSelectors = {
  // 获取当前模型名称
  getCurrentModelName: (state: ChatState, modelList: Array<{id: string, name: string}>): string => {
    const model = modelList.find(m => m.id === state.settings.modelId)
    return model?.name || state.settings.modelId
  },
  
  // 检查上下文感知是否启用
  isContextAwareEnabled: (state: ChatState): boolean =>
    state.settings.contextAware,
  
  // 获取温度显示值
  getTemperatureDisplay: (state: ChatState): string =>
    state.settings.temperature.toFixed(1),
  
  // 检查设置是否为默认值
  isDefaultSettings: (state: ChatState): boolean => {
    const { settings } = state
    return (
      settings.modelId === DEFAULT_CHAT_STATE.settings.modelId &&
      settings.temperature === DEFAULT_CHAT_STATE.settings.temperature &&
      settings.contextAware === DEFAULT_CHAT_STATE.settings.contextAware
    )
  }
}

/**
 * 性能优化的状态更新函数
 */
export const optimizedActions = {
  // 批量更新多个状态
  batchUpdate: (dispatch: React.Dispatch<ChatAction>) => 
    (actions: ChatAction[]) => {
      // 使用 React 的自动批处理
      actions.forEach(action => dispatch(action))
    },
  
  // 防抖的输入更新
  debouncedSetInput: (dispatch: React.Dispatch<ChatAction>, delay = 300) => {
    let timeoutId: NodeJS.Timeout
    return (input: string) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        dispatch({ type: 'SET_INPUT', payload: input })
      }, delay)
    }
  },
  
  // 节流的设置更新
  throttledSetSettings: (dispatch: React.Dispatch<ChatAction>, delay = 1000) => {
    let lastUpdate = 0
    return (settings: Partial<ChatSettings>) => {
      const now = Date.now()
      if (now - lastUpdate >= delay) {
        dispatch({ type: 'SET_SETTINGS', payload: settings })
        lastUpdate = now
      }
    }
  }
}
