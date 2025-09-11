/**
 * AI模型API Key管理器
 * 支持按模型自动选择对应的API Key
 */

interface KeyConfig {
  key: string
  provider: string
  models: string[]
}

// API Key配置映射
const KEY_CONFIGS: KeyConfig[] = [
  {
    key: process.env.LLM_CLAUDE_API_KEY || '',
    provider: 'Claude',
    models: ['claude-opus-4-1-20250805', 'claude-3-5-sonnet', 'claude-3-opus']
  },
  {
    key: process.env.LLM_GEMINI_API_KEY || '',
    provider: 'Google',
    models: ['gemini-2.5-pro', 'gemini-1.5-pro']
  },
  {
    key: process.env.LLM_OPENAI_API_KEY || '',
    provider: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
  }
]

// 回退API Key（兼容旧配置）
const FALLBACK_KEY = process.env.LLM_API_KEY || ''

export interface KeySelectionResult {
  apiKey: string
  provider: string
  keySource: 'specific' | 'fallback' | 'none'
  confidence: 'high' | 'medium' | 'low'
}

/**
 * 根据模型ID选择最合适的API Key
 */
export function selectApiKey(modelId: string): KeySelectionResult {
  // 1. 精确匹配：在配置中查找支持该模型的专属key
  for (const config of KEY_CONFIGS) {
    if (config.key && config.models.includes(modelId)) {
      const result: KeySelectionResult = {
        apiKey: config.key,
        provider: config.provider,
        keySource: 'specific',
        confidence: 'high'
      }
      return result
    }
  }

  // 2. 模糊匹配：根据模型名称推断供应商
  const modelLower = modelId.toLowerCase()
  for (const config of KEY_CONFIGS) {
    if (!config.key) continue

    const providerMatches = [
      { provider: 'Claude', patterns: ['claude'] },
      { provider: 'Google', patterns: ['gemini', 'palm', 'bard'] },
      { provider: 'OpenAI', patterns: ['gpt', 'text-davinci', 'text-ada'] }
    ]

    const match = providerMatches.find(pm =>
      pm.provider === config.provider &&
      pm.patterns.some(pattern => modelLower.includes(pattern))
    )

    if (match) {
      const result: KeySelectionResult = {
        apiKey: config.key,
        provider: config.provider,
        keySource: 'specific',
        confidence: 'medium'
      }
      return result
    }
  }

  // 3. 回退到统一KEY（保持兼容性）
  if (FALLBACK_KEY) {
    const result: KeySelectionResult = {
      apiKey: FALLBACK_KEY,
      provider: 'Unknown',
      keySource: 'fallback',
      confidence: 'low'
    }
    return result
  }

  // 4. 无可用Key - 抛出错误而不是返回空Key
  throw new Error(`无法为模型 ${modelId} 找到有效的API Key。请检查环境变量配置。`)
}

/**
 * 获取所有已配置的Key信息（用于健康检查）
 */
export function getKeyHealthStatus() {
  const status = {
    configuredKeys: 0,
    availableProviders: [] as string[],
    fallbackKey: !!FALLBACK_KEY,
    keyStatus: {} as Record<string, boolean>
  }

  KEY_CONFIGS.forEach(config => {
    if (config.key) {
      status.configuredKeys++
      status.availableProviders.push(config.provider)
      status.keyStatus[config.provider] = true
    } else {
      status.keyStatus[config.provider] = false
    }
  })

  return status
}

/**
 * 验证特定模型的Key配置
 */
export function validateModelKeyConfig(modelId: string): {
  isValid: boolean
  keyInfo: KeySelectionResult
  recommendation?: string
} {
  const keyInfo = selectApiKey(modelId)
  
  const validation = {
    isValid: !!keyInfo.apiKey,
    keyInfo,
    recommendation: undefined as string | undefined
  }

  if (!keyInfo.apiKey) {
    validation.recommendation = `请配置 ${modelId} 对应供应商的API Key`
  } else if (keyInfo.confidence === 'low') {
    validation.recommendation = `建议为 ${modelId} 配置专属API Key以提高稳定性`
  }

  return validation
}

/**
 * 开发环境调试工具
 */
export const KeyDebugTools = {
  showAllKeys: () => {
    KEY_CONFIGS.forEach(config => {
      })
  },

  testKeySelection: (modelId: string) => {
    const result = selectApiKey(modelId)
    return result
  },

  getAllSupportedModels: () => {
    const allModels = KEY_CONFIGS.flatMap(config => config.models)
    return allModels
  }
}

// 开发环境暴露调试工具
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).KeyDebugTools = KeyDebugTools
}