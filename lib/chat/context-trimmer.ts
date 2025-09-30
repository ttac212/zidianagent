/**
 * 统一的消息上下文裁剪器
 * 确保前后端一致的裁剪规则，防止token超限和内存溢出
 * Linus原则：一处逻辑，前后端共享
 */

import type { ChatMessage } from '@/types/chat'
import { MESSAGE_LIMITS, getModelContextConfig } from '@/lib/constants/message-limits'

export interface TrimOptions {
  maxMessages?: number      // 最大消息数量限制
  maxTokens?: number       // 最大token预算（粗略估算）
  reserveTokens?: number   // 为新回复预留的token
  keepSystemMessage?: boolean // 是否保留系统消息
}

export interface TrimResult {
  messages: ChatMessage[]
  trimmed: boolean
  originalLength: number
  estimatedTokens: number
  dropCount: number
}

/**
 * 粗略估算消息的token数量
 * 简单规则：英文按4字符/token，中文按1.5字符/token
 */
function estimateTokens(content: string): number {
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length
  const otherChars = content.length - chineseChars

  // 中文：1.5字符/token，英文：4字符/token
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

/**
 * 计算消息数组的总token数
 */
function calculateTotalTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, msg) => total + estimateTokens(msg.content), 0)
}

/**
 * 核心裁剪逻辑
 * 策略：保留最新的消息，优先保留system消息
 */
export function trimMessageHistory(
  messages: ChatMessage[],
  options: TrimOptions = {}
): TrimResult {
  const {
    maxMessages = 50,          // 默认最多50条消息
    maxTokens = 12000,         // 默认token预算12k（为4k输出预留空间）
    reserveTokens = 4000,      // 为回复预留4k token
    keepSystemMessage = true
  } = options

  const originalLength = messages.length

  if (messages.length === 0) {
    return {
      messages: [],
      trimmed: false,
      originalLength,
      estimatedTokens: 0,
      dropCount: 0
    }
  }

  // 分离系统消息和其他消息
  let systemMessages: ChatMessage[] = []
  let otherMessages: ChatMessage[] = []

  for (const message of messages) {
    if (message.role === 'system') {
      systemMessages.push(message)
    } else {
      otherMessages.push(message)
    }
  }

  // 如果不保留系统消息，全部算作其他消息
  if (!keepSystemMessage) {
    otherMessages = [...systemMessages, ...otherMessages]
    systemMessages = []
  }

  let resultMessages: ChatMessage[] = [...systemMessages]
  const availableTokenBudget = maxTokens - reserveTokens
  let currentTokens = calculateTotalTokens(systemMessages)

  // 从最新的消息开始向前取，直到达到限制
  const reversedOthers = [...otherMessages].reverse()
  let selectedOthers: ChatMessage[] = []

  for (const message of reversedOthers) {
    const messageTokens = estimateTokens(message.content)

    // 检查消息数量限制
    if (resultMessages.length + selectedOthers.length >= maxMessages) {
      break
    }

    // 检查token限制
    if (currentTokens + messageTokens > availableTokenBudget) {
      break
    }

    selectedOthers.unshift(message) // 插入到开头保持时间顺序
    currentTokens += messageTokens
  }

  resultMessages.push(...selectedOthers)

  const trimmed = resultMessages.length < originalLength
  const dropCount = originalLength - resultMessages.length

  return {
    messages: resultMessages,
    trimmed,
    originalLength,
    estimatedTokens: currentTokens,
    dropCount
  }
}

/**
 * 专门用于聊天API的裁剪 - 支持动态模型配置和创作模式
 * @param messages 消息列表
 * @param modelId 模型ID
 * @param creativeMode 是否启用创作模式
 */
export function trimForChatAPI(
  messages: ChatMessage[],
  modelId?: string,
  creativeMode: boolean = false
): TrimResult {
  const config = modelId
    ? getModelContextConfig(modelId, creativeMode)
    : MESSAGE_LIMITS.CONTEXT_LIMITS.DEFAULT

  return trimMessageHistory(messages, {
    maxMessages: config.maxMessages,
    maxTokens: config.maxTokens,
    reserveTokens: config.reserveTokens,
    keepSystemMessage: true
  })
}

/**
 * 专门用于客户端显示的裁剪
 */
export function trimForDisplay(messages: ChatMessage[]): TrimResult {
  const config = MESSAGE_LIMITS.CONTEXT_LIMITS.DISPLAY
  return trimMessageHistory(messages, {
    maxMessages: config.maxMessages,
    maxTokens: config.maxTokens,
    reserveTokens: config.reserveTokens,
    keepSystemMessage: true
  })
}

/**
 * 检查是否需要裁剪
 */
export function shouldTrimContext(
  messages: ChatMessage[],
  options: TrimOptions = {}
): boolean {
  const result = trimMessageHistory(messages, options)
  return result.trimmed
}