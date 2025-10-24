/**
 * LLM提供商管理器
 * 支持多个API提供商，实现自动切换和负载均衡
 */

export interface LLMProvider {
  /** 提供商名称 */
  name: string
  /** API基础URL */
  baseURL: string
  /** API密钥 */
  apiKey: string
  /** 是否启用 */
  enabled: boolean
  /** 优先级（数字越小优先级越高） */
  priority: number
  /** 支持的模型列表（可选，空则表示支持所有） */
  supportedModels?: string[]
}

/**
 * 获取所有配置的LLM提供商
 */
export function getLLMProviders(): LLMProvider[] {
  const providers: LLMProvider[] = []

  // 主提供商：ZenMux（支持推理模型）
  if (process.env.ZENMUX_API_KEY && process.env.ZENMUX_API_BASE) {
    providers.push({
      name: 'ZenMux',
      baseURL: process.env.ZENMUX_API_BASE,
      apiKey: process.env.ZENMUX_API_KEY,
      enabled: true,
      priority: 1,
    })
  }

  // 备选提供商：302.AI
  if (process.env.LLM_API_KEY && process.env.LLM_API_BASE) {
    providers.push({
      name: '302.AI',
      baseURL: process.env.LLM_API_BASE,
      apiKey: process.env.LLM_API_KEY,
      enabled: true,
      priority: 2,
    })
  }

  // 按优先级排序
  return providers.sort((a, b) => a.priority - b.priority)
}

/**
 * 根据模型ID选择提供商
 */
export function selectProvider(modelId: string): LLMProvider | null {
  const providers = getLLMProviders().filter(p => p.enabled)

  if (providers.length === 0) {
    console.warn('[LLMProviderManager] No enabled providers found')
    return null
  }

  // 如果模型ID包含提供商前缀（如 anthropic/claude-sonnet-4.5）
  // ZenMux使用这种格式，优先匹配ZenMux
  if (modelId.includes('/')) {
    const zenmux = providers.find(p => p.name === 'ZenMux')
    if (zenmux) {
      return zenmux
    }
  }

  // 否则返回优先级最高的提供商
  return providers[0]
}

/**
 * 转换模型ID为提供商特定格式
 */
export function transformModelId(modelId: string, provider: LLMProvider): string {
  // ZenMux需要带提供商前缀的格式
  if (provider.name === 'ZenMux') {
    // 如果已经有前缀，去掉 :thinking 后缀（ZenMux 通过 reasoning_effort 参数控制推理，不是通过模型名）
    if (modelId.includes('/')) {
      // 去掉 :thinking 后缀
      return modelId.replace(':thinking', '')
    }

    // 否则使用默认模型
    return process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5'
  }

  // 302.AI等其他提供商保持原格式
  return modelId
}

/**
 * 获取提供商健康状态
 */
export function getProviderHealthStatus() {
  const providers = getLLMProviders()

  return {
    totalProviders: providers.length,
    enabledProviders: providers.filter(p => p.enabled).length,
    providers: providers.map(p => ({
      name: p.name,
      enabled: p.enabled,
      priority: p.priority,
      hasApiKey: !!p.apiKey,
      baseURL: p.baseURL,
    })),
    primary: providers.find(p => p.enabled),
  }
}

/**
 * 构建聊天请求（适配不同提供商）
 */
export function buildChatRequest(
  provider: LLMProvider,
  modelId: string,
  messages: any[],
  options: any = {}
) {
  const transformedModelId = transformModelId(modelId, provider)

  // 基础请求体
  const requestBody: any = {
    model: transformedModelId,
    messages,
    ...options,
  }

  // ZenMux特定配置
  if (provider.name === 'ZenMux') {
    // ZenMux可能需要特定的参数格式
    // 这里可以添加ZenMux特定的配置
  }

  return {
    url: `${provider.baseURL}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: requestBody,
  }
}
