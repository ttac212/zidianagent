/**
 * API Key管理 - 多Key架构
 * 每个模型提供商使用独立的API Key
 */

export function selectApiKey(modelId: string): KeySelectionResult {
  let apiKey = ''
  let provider = 'Unknown'

  // 根据模型ID选择对应的API Key
  if (modelId.includes('claude')) {
    provider = 'Claude'
    // 优先使用Claude专用Key，如果没有则使用通用Key
    apiKey = process.env.LLM_CLAUDE_API_KEY || process.env.LLM_API_KEY || ''
  } else if (modelId.includes('gemini')) {
    provider = 'Google'
    // 优先使用Gemini专用Key，如果没有则使用通用Key
    apiKey = process.env.LLM_GEMINI_API_KEY || process.env.LLM_API_KEY || ''
  } else if (modelId.includes('gpt')) {
    provider = 'OpenAI'
    // 优先使用OpenAI专用Key，如果没有则使用通用Key
    apiKey = process.env.LLM_OPENAI_API_KEY || process.env.LLM_API_KEY || ''
  } else {
    // 其他模型使用通用Key
    apiKey = process.env.LLM_API_KEY || ''
  }

  // 如果没有找到合适的Key，记录警告
  if (!apiKey) {
    console.warn(`[KeyManager] No API key found for model: ${modelId} (provider: ${provider})`)
  }

  return { apiKey, provider }
}

export interface KeySelectionResult {
  apiKey: string
  provider: string
}

// 健康检查
export function getKeyHealthStatus() {
  const hasClaudeKey = !!process.env.LLM_CLAUDE_API_KEY
  const hasGeminiKey = !!process.env.LLM_GEMINI_API_KEY
  const hasOpenAIKey = !!process.env.LLM_OPENAI_API_KEY
  const hasFallbackKey = !!process.env.LLM_API_KEY

  return {
    hasKey: hasClaudeKey || hasGeminiKey || hasOpenAIKey || hasFallbackKey,
    keys: {
      claude: hasClaudeKey,
      gemini: hasGeminiKey,
      openai: hasOpenAIKey,
      fallback: hasFallbackKey
    },
    apiBase: process.env.LLM_API_BASE || 'https://api.302.ai/v1'
  }
}