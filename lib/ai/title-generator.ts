/**
 * 服务器端标题生成工具
 * 从消息内容中智能生成对话标题
 */

/**
 * 根据对话的首条用户消息生成标题
 */
export function generateConversationTitle(firstUserMessage: string): string {
  if (!firstUserMessage || firstUserMessage.trim().length === 0) {
    return '新对话'
  }

  // 清理消息内容
  const cleaned = firstUserMessage.trim()

  // 如果消息很短，直接使用（限制在30字符内）
  if (cleaned.length <= 30) {
    return cleaned
  }

  // 长消息的处理逻辑
  // 1. 尝试提取第一句话
  const firstSentence = extractFirstSentence(cleaned)
  if (firstSentence && firstSentence.length <= 30) {
    return firstSentence
  }

  // 2. 截断到30字符并添加省略号
  return cleaned.substring(0, 27) + '...'
}

/**
 * 提取第一句话
 */
function extractFirstSentence(text: string): string | null {
  // 常见的句子结束符
  const sentenceEnders = /[。！？!?\.]/
  const match = text.match(sentenceEnders)

  if (match && match.index !== undefined) {
    const firstSentence = text.substring(0, match.index + 1).trim()
    // 确保第一句话不会太短（至少5个字符）或太长
    if (firstSentence.length >= 5 && firstSentence.length <= 30) {
      return firstSentence
    }
  }

  return null
}

/**
 * 从最后一条消息中提取摘要
 */
export function extractLastSnippet(lastMessage: string | null, maxLength: number = 50): string {
  if (!lastMessage || lastMessage.trim().length === 0) {
    return '暂无消息'
  }

  const cleaned = lastMessage.trim()
  if (cleaned.length <= maxLength) {
    return cleaned
  }

  return cleaned.substring(0, maxLength - 3) + '...'
}