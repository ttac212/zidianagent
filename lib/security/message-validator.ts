/**
 * 消息验证器
 * 用于API路由的消息安全验证
 */

import { validateMessageContent } from './content-filter'
import { MESSAGE_LIMITS } from '@/lib/constants/message-limits'

export interface ValidatedMessage {
  role: 'user'  // 强制只允许user角色
  content: string
}

export interface MessageValidationResult {
  isValid: boolean
  messages: ValidatedMessage[]
  errors: string[]
  stats: {
    totalReceived: number
    totalValidated: number
    totalRejected: number
    roleViolations: number
    contentViolations: number
  }
}

/**
 * 验证并清理消息数组
 * 只允许user角色的消息，防止prompt注入
 */
export function validateMessages(
  messages: any[],
  options: {
    maxMessages?: number
    allowEmptyContent?: boolean
    logSecurityEvents?: boolean
    onlyValidateLastMessage?: boolean  // 只验证最后一条消息（新发送的）
    allowHistoricalAssistantMessages?: boolean  // 允许历史assistant消息
  } = {}
): MessageValidationResult {
  const {
    maxMessages = 100,
    allowEmptyContent = false,
    logSecurityEvents = true,
    onlyValidateLastMessage = false,
    allowHistoricalAssistantMessages = false
  } = options

  const errors: string[] = []
  const validatedMessages: ValidatedMessage[] = []
  let roleViolations = 0
  let contentViolations = 0

  // 输入验证
  if (!Array.isArray(messages)) {
    return {
      isValid: false,
      messages: [],
      errors: ['消息必须是数组格式'],
      stats: {
        totalReceived: 0,
        totalValidated: 0,
        totalRejected: 0,
        roleViolations: 0,
        contentViolations: 0
      }
    }
  }

  // 限制消息数量，防止DoS攻击
  const messagesToProcess = messages.slice(0, maxMessages)
  if (messages.length > maxMessages) {
    errors.push(`消息数量超过限制，已截断至 ${maxMessages} 条`)
  }

  // 如果只验证最后一条消息，则将历史消息直接加入
  if (onlyValidateLastMessage && messagesToProcess.length > 0) {
    // 处理历史消息（除最后一条外的所有消息）
    const historicalMessages = messagesToProcess.slice(0, -1)
    const lastMessage = messagesToProcess[messagesToProcess.length - 1]

    // 历史消息直接通过（但仍然过滤危险内容）
    for (const msg of historicalMessages) {
      if (!msg || typeof msg !== 'object') continue

      // 历史消息允许assistant和user角色，保持原始结构
      if (msg.role === 'user' || (msg.role === 'assistant' && allowHistoricalAssistantMessages)) {
        // 对于历史消息，简单的内容过滤但保持角色信息
        const content = String(msg.content || '')
        if (content.trim()) {  // 跳过空内容的历史消息
          validatedMessages.push({
            role: 'user',  // 注意：这里为了类型安全统一为user，但在API层会正确处理
            content: content
          })
        }
      }
    }

    // 只严格验证最后一条消息（必须是user）
    if (lastMessage) {
      if (!lastMessage || typeof lastMessage !== 'object') {
        errors.push('最新消息格式无效')
      } else if (lastMessage.role !== 'user') {
        roleViolations++
        errors.push('最新消息必须是用户发送的')

        if (logSecurityEvents) {
          console.warn('[Security Alert] Blocked non-user role in new message:', {
            attemptedRole: lastMessage.role,
            contentPreview: String(lastMessage.content || '').substring(0, 50),
            timestamp: new Date().toISOString(),
            violation: 'NEW_MESSAGE_ROLE_VIOLATION'
          })
        }
      } else {
        // 验证最后一条消息的内容
        const validation = validateMessageContent(lastMessage.content)
        if (validation.isValid) {
          validatedMessages.push({
            role: 'user',
            content: validation.filteredContent
          })
        } else {
          contentViolations++
          errors.push(...validation.warnings)
        }
      }
    }
  } else {
    // 原有的全部验证逻辑
    for (const msg of messagesToProcess) {
      // 类型检查
      if (!msg || typeof msg !== 'object') {
        errors.push('检测到无效的消息格式')
        continue
      }

      // 角色验证 - 核心安全措施
      const isHistoricalAssistant = allowHistoricalAssistantMessages && msg.role === 'assistant'
      
      if (msg.role !== 'user' && !isHistoricalAssistant) {
        roleViolations++
        
        if (logSecurityEvents) {
          console.warn('[Security Alert] Blocked non-user role message:', {
            attemptedRole: msg.role,
            contentPreview: String(msg.content || '').substring(0, 50),
            timestamp: new Date().toISOString(),
            violation: 'ROLE_INJECTION_ATTEMPT'
          })
        }
        
        // 记录特定的角色违规
        if (msg.role === 'system') {
          errors.push('检测到系统角色伪造尝试')
        } else if (msg.role === 'assistant' && !allowHistoricalAssistantMessages) {
          errors.push('检测到助手角色伪造尝试')
        } else {
          errors.push(`检测到非法角色: ${msg.role}`)
        }
        
        continue // 跳过此消息
      }

      // 内容验证
      const content = msg.content
      
      // 空内容检查
      if (!content && !allowEmptyContent) {
        contentViolations++
        errors.push('消息内容不能为空')
        continue
      }

      // 类型检查
      if (typeof content !== 'string') {
        contentViolations++
        errors.push('消息内容必须是字符串')
        continue
      }

      // 使用内容过滤器进行深度验证
      const validation = validateMessageContent(content)
      
      if (!validation.isValid) {
        contentViolations++
        errors.push(...validation.warnings)
        
        if (logSecurityEvents) {
          console.warn('[Security Alert] Content validation failed:', {
            warnings: validation.warnings,
            dangerLevel: validation.dangerLevel,
            metadata: validation.metadata
          })
        }
        
        continue
      }

      // 通过所有验证，添加到结果中
      validatedMessages.push({
        role: 'user',  // 强制设置为user，即使原始数据是user也重新设置
        content: validation.filteredContent
      })
    }
  }

  const totalRejected = messages.length - validatedMessages.length

  // 如果所有消息都被拒绝，记录严重警告
  if (messages.length > 0 && validatedMessages.length === 0) {
    if (logSecurityEvents) {
      console.error('[Security Alert] All messages rejected:', {
        totalAttempted: messages.length,
        roleViolations,
        contentViolations,
        timestamp: new Date().toISOString(),
        severity: 'HIGH'
      })
    }
  }

  return {
    isValid: validatedMessages.length > 0,
    messages: validatedMessages,
    errors,
    stats: {
      totalReceived: messages.length,
      totalValidated: validatedMessages.length,
      totalRejected,
      roleViolations,
      contentViolations
    }
  }
}

/**
 * 验证单个消息
 */
export function validateSingleMessage(
  message: any,
  options?: Parameters<typeof validateMessages>[1]
): { isValid: boolean; message?: ValidatedMessage; error?: string } {
  const result = validateMessages([message], options)
  
  if (result.isValid && result.messages.length > 0) {
    return {
      isValid: true,
      message: result.messages[0]
    }
  }
  
  return {
    isValid: false,
    error: result.errors[0] || '消息验证失败'
  }
}

/**
 * 构建安全的系统消息
 * 只能在服务器端调用，不接受客户端输入
 */
export function buildSystemMessage(content: string): { role: 'system'; content: string } {
  // 这个函数只能在服务器端使用，不应该处理任何客户端数据
  if (typeof content !== 'string' || !content) {
    throw new Error('System message content must be a non-empty string')
  }
  
  return {
    role: 'system',
    content: content.trim()
  }
}

/**
 * 构建安全的助手消息
 * 只能在服务器端调用，用于构建AI响应
 */
export function buildAssistantMessage(content: string): { role: 'assistant'; content: string } {
  if (typeof content !== 'string' || !content) {
    throw new Error('Assistant message content must be a non-empty string')
  }
  
  return {
    role: 'assistant',
    content: content.trim()
  }
}

/**
 * 专门为聊天API设计的消息验证函数
 * 智能处理新消息和历史消息的区分
 */
export function validateChatMessages(
  messages: any[],
  hasExistingConversation: boolean = false
): MessageValidationResult {
  // 增强的对话状态检测
  const enhancedConversationDetection = hasExistingConversation ||
    // 多条消息通常表示已有对话历史
    (Array.isArray(messages) && messages.length > 1) ||
    // 检查是否包含助手响应（标志性的对话历史）
    (Array.isArray(messages) && messages.some((msg: any) =>
      msg?.role === 'assistant' && msg?.content && typeof msg.content === 'string'
    )) ||
    // 检查消息结构是否符合对话历史模式（用户-助手交替）
    (Array.isArray(messages) && messages.length >= 2 &&
      messages.some((msg: any, index: number) =>
        msg?.role === 'user' && index < messages.length - 1
      )
    )

  // 如果有现存对话，使用更宽松的验证（只严格验证最新消息）
  if (enhancedConversationDetection) {
    return validateMessages(messages, {
      maxMessages: 50,
      allowEmptyContent: false,
      logSecurityEvents: true,
      onlyValidateLastMessage: true,  // 只验证最后一条消息
      allowHistoricalAssistantMessages: true  // 允许历史assistant消息
    })
  }

  // 新对话，严格验证所有消息必须是user角色
  return validateMessages(messages, {
    maxMessages: 50,
    allowEmptyContent: false,
    logSecurityEvents: true,
    onlyValidateLastMessage: false,
    allowHistoricalAssistantMessages: false
  })
}