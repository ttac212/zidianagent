/**
 * 统一的消息长度限制配置
 * 前后端共享，确保一致性
 */
export const MESSAGE_LIMITS = {
  // 单条消息最大长度
  MAX_LENGTH: 15000,
  
  // 显示字符计数器的阈值
  SHOW_COUNTER_THRESHOLD: 10000,
  
  // 警告阈值（接近最大限制时显示警告）
  WARNING_THRESHOLD: 13000,
  
  // 危险阈值（即将超出限制）
  DANGER_THRESHOLD: 14500,
  
  // 消息截断时的后缀提示
  TRUNCATION_SUFFIX: '\n\n[消息已被截断，请分段发送]'
} as const

/**
 * 获取字符限制状态
 */
export function getCharLimitStatus(length: number) {
  return {
    isValid: length <= MESSAGE_LIMITS.MAX_LENGTH,
    showCounter: length >= MESSAGE_LIMITS.SHOW_COUNTER_THRESHOLD,
    isWarning: length >= MESSAGE_LIMITS.WARNING_THRESHOLD,
    isDanger: length >= MESSAGE_LIMITS.DANGER_THRESHOLD,
    remaining: MESSAGE_LIMITS.MAX_LENGTH - length,
    percentage: Math.min(100, (length / MESSAGE_LIMITS.MAX_LENGTH) * 100)
  }
}

/**
 * 安全截断消息内容
 */
export function truncateMessage(content: string): {
  truncated: boolean
  content: string
  originalLength: number
} {
  if (content.length <= MESSAGE_LIMITS.MAX_LENGTH) {
    return {
      truncated: false,
      content,
      originalLength: content.length
    }
  }
  
  // 保留空间给截断提示
  const maxLength = MESSAGE_LIMITS.MAX_LENGTH - MESSAGE_LIMITS.TRUNCATION_SUFFIX.length
  const truncatedContent = content.slice(0, maxLength) + MESSAGE_LIMITS.TRUNCATION_SUFFIX
  
  return {
    truncated: true,
    content: truncatedContent,
    originalLength: content.length
  }
}