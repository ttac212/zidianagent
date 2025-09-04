/**
 * 内容过滤和安全验证工具
 * 防止注入攻击和恶意内容
 */

// 内容过滤配置
export const CONTENT_FILTER_CONFIG = {
  // 编辑器上下文限制
  EDITOR_EXCERPT: {
    MAX_LENGTH: 2000,           // 最大长度2000字符
    MAX_LINES: 50,              // 最大50行
    ALLOWED_LANGUAGES: [        // 允许的编程语言标识
      'javascript', 'typescript', 'python', 'java', 'c++', 'c', 'go', 
      'rust', 'html', 'css', 'json', 'xml', 'yaml', 'markdown'
    ]
  },
  
  // 危险模式匹配
  DANGEROUS_PATTERNS: [
    /system\s*[:：]\s*/i,        // "system:" 或 "system："
    /assistant\s*[:：]\s*/i,     // "assistant:" 或 "assistant："
    /human\s*[:：]\s*/i,         // "human:" 或 "human："  
    /user\s*[:：]\s*/i,          // "user:" 或 "user："
    /\[system\]/i,               // [system]
    /\[assistant\]/i,            // [assistant]
    /\[user\]/i,                 // [user]
    /忽略以上/i,                  // "忽略以上"
    /ignore\s+above/i,           // "ignore above"
    /forget\s+previous/i,        // "forget previous"
    /new\s+instruction/i,        // "new instruction"
    /重新定义/i,                  // "重新定义"
    /redefine/i,                 // "redefine"
    /<script\b/i,                // script标签
    /javascript\s*:/i,           // javascript: 协议
    /data\s*:/i,                 // data: 协议
  ],
  
  // 敏感关键词
  SENSITIVE_KEYWORDS: [
    'prompt injection', '提示注入', 'jailbreak', '越狱',
    'system prompt', '系统提示', 'override', '覆盖',
    'backdoor', '后门', 'malware', '恶意软件'
  ]
}

// 过滤结果类型
export interface ContentFilterResult {
  isValid: boolean
  filteredContent: string
  warnings: string[]
  dangerLevel: 'safe' | 'suspicious' | 'dangerous'
  metadata: {
    originalLength: number
    filteredLength: number
    removedLines: number
    truncated: boolean
  }
}

/**
 * 过滤编辑器上下文内容
 */
export function filterEditorExcerpt(content: string): ContentFilterResult {
  const originalLength = content.length
  const warnings: string[] = []
  let dangerLevel: 'safe' | 'suspicious' | 'dangerous' = 'safe'
  
  // 1. 基本验证
  if (!content || typeof content !== 'string') {
    return {
      isValid: false,
      filteredContent: '',
      warnings: ['内容为空或格式无效'],
      dangerLevel: 'safe',
      metadata: {
        originalLength: 0,
        filteredLength: 0,
        removedLines: 0,
        truncated: false
      }
    }
  }

  let filteredContent = content.trim()

  // 2. 长度限制
  let truncated = false
  if (filteredContent.length > CONTENT_FILTER_CONFIG.EDITOR_EXCERPT.MAX_LENGTH) {
    filteredContent = filteredContent.substring(0, CONTENT_FILTER_CONFIG.EDITOR_EXCERPT.MAX_LENGTH)
    truncated = true
    warnings.push(`内容超长已截断至${CONTENT_FILTER_CONFIG.EDITOR_EXCERPT.MAX_LENGTH}字符`)
  }

  // 3. 行数限制
  const lines = filteredContent.split('\n')
  let removedLines = 0
  if (lines.length > CONTENT_FILTER_CONFIG.EDITOR_EXCERPT.MAX_LINES) {
    const keepLines = CONTENT_FILTER_CONFIG.EDITOR_EXCERPT.MAX_LINES
    filteredContent = lines.slice(0, keepLines).join('\n')
    removedLines = lines.length - keepLines
    warnings.push(`超过${CONTENT_FILTER_CONFIG.EDITOR_EXCERPT.MAX_LINES}行限制，已移除${removedLines}行`)
  }

  // 4. 危险模式检测
  const dangerousMatches = CONTENT_FILTER_CONFIG.DANGEROUS_PATTERNS.filter(pattern => 
    pattern.test(filteredContent)
  )

  if (dangerousMatches.length > 0) {
    dangerLevel = 'dangerous'
    warnings.push(`检测到${dangerousMatches.length}个可能的注入模式`)
    
    // 移除或替换危险模式
    for (const pattern of CONTENT_FILTER_CONFIG.DANGEROUS_PATTERNS) {
      filteredContent = filteredContent.replace(pattern, '[已过滤]')
    }
  }

  // 5. 敏感关键词检测
  const sensitiveMatches = CONTENT_FILTER_CONFIG.SENSITIVE_KEYWORDS.filter(keyword =>
    filteredContent.toLowerCase().includes(keyword.toLowerCase())
  )

  if (sensitiveMatches.length > 0) {
    if (dangerLevel === 'safe') dangerLevel = 'suspicious'
    warnings.push(`检测到${sensitiveMatches.length}个敏感关键词`)
    
    // 替换敏感关键词
    for (const keyword of CONTENT_FILTER_CONFIG.SENSITIVE_KEYWORDS) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      filteredContent = filteredContent.replace(regex, '[敏感内容]')
    }
  }

  // 6. HTML/JavaScript 清理
  filteredContent = sanitizeContent(filteredContent)

  // 7. 最终验证
  const isValid = dangerLevel !== 'dangerous' && filteredContent.length > 0

  return {
    isValid,
    filteredContent,
    warnings,
    dangerLevel,
    metadata: {
      originalLength,
      filteredLength: filteredContent.length,
      removedLines,
      truncated
    }
  }
}

/**
 * 内容清理 - 移除HTML标签和危险字符
 */
function sanitizeContent(content: string): string {
  return content
    // 移除HTML标签
    .replace(/<[^>]*>/g, '')
    // 移除JavaScript事件属性
    .replace(/on\w+\s*=\s*['""].*?['"]/gi, '')
    // 移除特殊控制字符（保留换行和制表符）
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 限制连续的换行符
    .replace(/\n{4,}/g, '\n\n\n')
}

/**
 * 生成安全的上下文消息
 */
export function createSafeContextMessage(editorExcerpt: string): { role: string; content: string } | null {
  if (!editorExcerpt) return null

  const filterResult = filterEditorExcerpt(editorExcerpt)
  
  if (!filterResult.isValid) {
    console.warn('[Content Filter] Rejected editor excerpt:', {
      dangerLevel: filterResult.dangerLevel,
      warnings: filterResult.warnings
    })
    return null
  }

  // 记录可疑内容
  if (filterResult.dangerLevel !== 'safe') {
    console.warn('[Content Filter] Suspicious content filtered:', {
      dangerLevel: filterResult.dangerLevel,
      warnings: filterResult.warnings,
      metadata: filterResult.metadata
    })
  }

  return {
    role: "system",
    content: `以下是用户编辑器中的代码上下文（已安全过滤）：\n\n${filterResult.filteredContent}\n\n请基于此上下文协助用户。`
  }
}

/**
 * 验证消息内容
 */
export function validateMessageContent(content: string): ContentFilterResult {
  // 对用户消息进行基本验证
  const maxMessageLength = 10000 // 单条消息最大长度
  const warnings: string[] = []
  let dangerLevel: 'safe' | 'suspicious' | 'dangerous' = 'safe'
  
  if (!content || typeof content !== 'string') {
    return {
      isValid: false,
      filteredContent: '',
      warnings: ['消息内容无效'],
      dangerLevel: 'safe',
      metadata: {
        originalLength: 0,
        filteredLength: 0,
        removedLines: 0,
        truncated: false
      }
    }
  }

  let filteredContent = content.trim()
  const originalLength = filteredContent.length

  // 长度检查
  let truncated = false
  if (filteredContent.length > maxMessageLength) {
    filteredContent = filteredContent.substring(0, maxMessageLength)
    truncated = true
    warnings.push('消息过长已截断')
  }

  // 基本清理
  filteredContent = sanitizeContent(filteredContent)

  return {
    isValid: true,
    filteredContent,
    warnings,
    dangerLevel,
    metadata: {
      originalLength,
      filteredLength: filteredContent.length,
      removedLines: 0,
      truncated
    }
  }
}

/**
 * 内容过滤中间件 - 用于API路由
 */
export function withContentFilter<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  options: { logSuspicious?: boolean } = {}
) {
  return async (...args: T): Promise<R> => {
    // 这里可以添加请求级别的内容过滤逻辑
    const result = await handler(...args)
    
    // 记录可疑活动
    if (options.logSuspicious) {
      // 实现日志记录逻辑
    }
    
    return result
  }
}