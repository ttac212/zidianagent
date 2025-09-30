/**
 * API Key管理 - 多Key架构（数据驱动重构版）
 * 每个模型提供商使用独立的API Key
 *
 * Linus: "Good taste means removing special cases"
 * 重构后：添加新模型无需修改代码，只需添加配置
 */

/**
 * 模型Key配置结构
 */
interface ModelKeyConfig {
  /** 模型ID前缀（精确匹配或前缀匹配） */
  pattern: string
  /** 精确匹配模式（默认前缀匹配） */
  exactMatch?: boolean
  /** 环境变量Key名称 */
  envKey: string
  /** Fallback Key列表（按顺序尝试） */
  fallbacks?: string[]
  /** 提供商名称 */
  provider: string
  /** 优先级（数字越小优先级越高） */
  priority?: number
}

/**
 * 模型Key配置表
 * 注意：按优先级排序，精确匹配 > 前缀匹配
 */
const MODEL_KEY_CONFIGS: ModelKeyConfig[] = [
  // Claude 模型（按具体到通用排序）
  {
    pattern: 'claude-sonnet-4-5-20250929-thinking',
    exactMatch: true,
    envKey: 'LLM_CLAUDE_SONNET_4_5_THINKING_KEY',
    fallbacks: ['LLM_CLAUDE_API_KEY', 'LLM_API_KEY'],
    provider: 'Claude',
    priority: 1
  },
  {
    pattern: 'claude-sonnet-4-5-20250929',
    exactMatch: true,
    envKey: 'LLM_CLAUDE_SONNET_4_5_KEY',
    fallbacks: ['LLM_CLAUDE_API_KEY', 'LLM_API_KEY'],
    provider: 'Claude',
    priority: 2
  },
  {
    pattern: 'claude-',
    envKey: 'LLM_CLAUDE_API_KEY',
    fallbacks: ['LLM_API_KEY'],
    provider: 'Claude',
    priority: 3
  },
  // Gemini 模型
  {
    pattern: 'gemini-',
    envKey: 'LLM_GEMINI_API_KEY',
    fallbacks: ['LLM_API_KEY'],
    provider: 'Google',
    priority: 1
  },
  // GPT 模型
  {
    pattern: 'gpt-',
    envKey: 'LLM_OPENAI_API_KEY',
    fallbacks: ['LLM_API_KEY'],
    provider: 'OpenAI',
    priority: 1
  }
]

/**
 * 查找匹配的配置
 */
function findMatchingConfig(modelId: string): ModelKeyConfig | null {
  // 优先精确匹配
  const exactMatch = MODEL_KEY_CONFIGS.find(
    config => config.exactMatch && config.pattern === modelId
  )
  if (exactMatch) return exactMatch

  // 前缀匹配（找到第一个匹配的）
  const prefixMatch = MODEL_KEY_CONFIGS.find(
    config => !config.exactMatch && modelId.startsWith(config.pattern)
  )
  return prefixMatch || null
}

/**
 * 从配置中解析API Key（支持fallback链）
 */
function resolveApiKey(config: ModelKeyConfig): string {
  // 尝试主Key
  const primaryKey = process.env[config.envKey]
  if (primaryKey) return primaryKey

  // 尝试Fallback Keys
  if (config.fallbacks) {
    for (const fallbackKey of config.fallbacks) {
      const key = process.env[fallbackKey]
      if (key) return key
    }
  }

  return ''
}

/**
 * 选择API Key（重构后的主函数）
 */
export function selectApiKey(modelId: string): KeySelectionResult {
  // 查找匹配的配置
  const config = findMatchingConfig(modelId)

  if (!config) {
    // 未找到配置，使用全局fallback
    const fallbackKey = process.env.LLM_API_KEY || ''
    if (!fallbackKey) {
      console.warn(`[KeyManager] No API key found for model: ${modelId}`)
    }
    return {
      apiKey: fallbackKey,
      provider: 'Unknown'
    }
  }

  // 解析API Key
  const apiKey = resolveApiKey(config)

  if (!apiKey) {
    console.warn(
      `[KeyManager] No API key found for model: ${modelId} (provider: ${config.provider})`
    )
  }

  return {
    apiKey,
    provider: config.provider
  }
}

export interface KeySelectionResult {
  apiKey: string
  provider: string
}

// 健康检查
export function getKeyHealthStatus() {
  const hasClaudeKey = !!process.env.LLM_CLAUDE_API_KEY
  const hasClaudeSonnet45ThinkingKey = !!process.env.LLM_CLAUDE_SONNET_4_5_THINKING_KEY
  const hasClaudeSonnet45Key = !!process.env.LLM_CLAUDE_SONNET_4_5_KEY
  const hasGeminiKey = !!process.env.LLM_GEMINI_API_KEY
  const hasOpenAIKey = !!process.env.LLM_OPENAI_API_KEY
  const hasFallbackKey = !!process.env.LLM_API_KEY

  return {
    hasKey: hasClaudeKey || hasClaudeSonnet45ThinkingKey || hasClaudeSonnet45Key || hasGeminiKey || hasOpenAIKey || hasFallbackKey,
    keys: {
      claude: hasClaudeKey,
      claudeSonnet45Thinking: hasClaudeSonnet45ThinkingKey,
      claudeSonnet45: hasClaudeSonnet45Key,
      gemini: hasGeminiKey,
      openai: hasOpenAIKey,
      fallback: hasFallbackKey
    },
    apiBase: process.env.LLM_API_BASE || 'https://api.302.ai/v1'
  }
}