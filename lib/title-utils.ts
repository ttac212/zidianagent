/**
 * 对话标题智能处理工具
 * 考虑UI显示限制和响应式设计
 */

/**
 * 智能截取标题
 * @param content 原始内容
 * @param maxLength 最大字符数（默认15，适配侧边栏显示）
 * @returns 截取后的标题
 */
export function createSmartTitle(content: string, maxLength: number = 15): string {
  if (!content || !content.trim()) {
    return '新对话'
  }

  const trimmedContent = content.trim()
  
  // 如果内容本身就很短，直接返回
  if (trimmedContent.length <= maxLength) {
    return trimmedContent
  }

  // 智能截取策略：
  // 1. 优先在句号、问号、感叹号处截断
  // 2. 其次在逗号、分号处截断  
  // 3. 避免在单词中间截断（英文）
  // 4. 最后添加省略号
  
  const punctuationBreaks = ['。', '？', '！', '.', '?', '!']
  const softBreaks = ['，', '；', ',', ';', ' ']
  
  // 在理想长度范围内查找标点符号
  const idealRange = Math.floor(maxLength * 0.7) // 70%位置开始查找
  
  // 查找句号等强截断点
  for (let i = idealRange; i < Math.min(maxLength, trimmedContent.length); i++) {
    if (punctuationBreaks.includes(trimmedContent[i])) {
      return trimmedContent.substring(0, i + 1)
    }
  }
  
  // 查找逗号等软截断点
  for (let i = idealRange; i < Math.min(maxLength, trimmedContent.length); i++) {
    if (softBreaks.includes(trimmedContent[i])) {
      return trimmedContent.substring(0, i) + '...'
    }
  }
  
  // 硬截断，但尽量避免截断emoji或特殊字符
  const truncated = trimmedContent.substring(0, maxLength - 3)
  return truncated + '...'
}

/**
 * 根据不同屏幕尺寸动态调整标题长度
 */
export function getAdaptiveTitleLength(): number {
  if (typeof window === 'undefined') return 15 // SSR fallback
  
  const width = window.innerWidth
  
  // 移动端：侧边栏折叠，不需要考虑
  if (width < 768) return 20
  
  // 平板：较小空间
  if (width < 1024) return 12
  
  // 桌面端：正常空间
  if (width < 1440) return 15
  
  // 大屏：更多空间
  return 18
}

/**
 * 生成智能对话标题
 * @param firstUserMessage 用户的第一条消息内容
 * @param maxLength 最大长度，默认15
 */
export function generateConversationTitle(firstUserMessage: string, maxLength?: number): string {
  const adaptiveLength = maxLength || getAdaptiveTitleLength()
  return createSmartTitle(firstUserMessage, adaptiveLength)
}

/**
 * 检查对话是否需要生成标题
 * @param conversation 对话对象
 * @returns 是否需要生成新标题
 */
export function shouldGenerateTitle(conversation: any): boolean {
  if (!conversation || !conversation.messages) return false
  
  // 检查是否还是默认标题且有用户消息
  const hasDefaultTitle = conversation.title === '新对话' || !conversation.title.trim()
  const hasUserMessages = conversation.messages.some((msg: any) => msg.role === 'user' && msg.content.trim())
  
  return hasDefaultTitle && hasUserMessages
}

/**
 * 从对话中获取智能标题
 * @param conversation 对话对象
 * @returns 智能生成的标题
 */
export function getSmartTitleFromConversation(conversation: any): string {
  if (!conversation || !conversation.messages) return '新对话'
  
  // 找到第一条用户消息
  const firstUserMessage = conversation.messages.find((msg: any) => 
    msg.role === 'user' && msg.content && msg.content.trim()
  )
  
  if (!firstUserMessage) return '新对话'
  
  return generateConversationTitle(firstUserMessage.content)
}

/**
 * 测试不同场景下的标题生成
 */
export function testTitleGeneration() {
  const testCases = [
    "帮我写一个登录页面的完整代码",
    "What is the best way to handle authentication in Next.js applications?",
    "你好！我想了解一下React的useState Hook的使用方法。",
    "解释一下这个错误：Cannot read properties of undefined",
    "写一个简单的待办事项应用",
    "How to fix CORS errors?",
    "请帮我分析这段代码的性能问题，我觉得渲染太慢了",
    "Hi there!",
    "",
    "A"
  ]
  
  testCases.forEach((content, _index) => {
    const _title12 = createSmartTitle(content, 12)
    const _title15 = createSmartTitle(content, 15)
    const _title20 = createSmartTitle(content, 20)
    
    })
}

// 开发时可以调用测试
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // testTitleGeneration()
}