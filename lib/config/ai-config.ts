/**
 * AI 服务配置模块
 * 统一管理 ZenMux API 的配置读取
 */

export interface AIConfig {
  apiKey: string
  apiBase: string
  defaultModel: string
}

/**
 * 获取 AI 配置
 * 在函数调用时读取环境变量，避免模块加载时环境变量未初始化的问题
 */
export function getAIConfig(): AIConfig {
  const apiKey = process.env.ZENMUX_API_KEY || ''
  const apiBase = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
  const defaultModel = process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5'

  return { apiKey, apiBase, defaultModel }
}

/**
 * 验证 AI 配置是否有效
 * @throws Error 如果配置无效
 */
export function validateAIConfig(): AIConfig {
  const config = getAIConfig()

  if (!config.apiKey) {
    throw new Error('未配置 ZENMUX_API_KEY 环境变量，请检查 .env.local 配置')
  }

  return config
}

/**
 * 快速模式模型 ID
 */
export const FAST_MODEL_ID = 'anthropic/claude-haiku-4.5'

/**
 * 根据快速模式选择模型
 */
export function selectModel(fastMode: boolean): string {
  if (fastMode) {
    return FAST_MODEL_ID
  }
  const config = getAIConfig()
  return config.defaultModel
}
