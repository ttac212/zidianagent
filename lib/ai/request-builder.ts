/**
 * LLM API请求构建工具
 *
 * 统一处理不同提供商（ZenMux、302.AI）的API请求参数差异
 * 消除调用方需要记住提供商特定参数的复杂性
 *
 * @author Linus式重构 - 数据结构优先，消除特殊情况
 */

export type LLMProvider = 'zenmux' | '302ai'
export type ReasoningEffort = 'low' | 'medium' | 'high'

export interface BuildLLMRequestOptions {
  /** 提供商类型 */
  provider: LLMProvider
  /** 模型ID（如 anthropic/claude-sonnet-4.5） */
  model: string
  /** 对话消息 */
  messages: any[]
  /** 最大生成token数 */
  maxTokens?: number
  /** 温度参数 0-2 (Claude为0-1) */
  temperature?: number
  /** 推理配置 */
  reasoning?: {
    effort: ReasoningEffort
    /** 最大推理token数（可选） */
    maxTokens?: number
    /** 是否启用推理（默认true） */
    enabled?: boolean
  }
  /** 是否启用流式响应 */
  stream?: boolean
  /** 响应格式（JSON Schema等） */
  responseFormat?: any
  /** 其他自定义参数 */
  [key: string]: any
}

/**
 * 构建符合提供商规范的LLM请求体
 *
 * 核心差异处理：
 * - ZenMux: max_completion_tokens, stream_options
 * - 302.AI: max_tokens
 * - Claude推理模式: 强制temperature=1
 */
export function buildLLMRequest(options: BuildLLMRequestOptions): Record<string, any> {
  const {
    provider,
    model,
    messages,
    maxTokens,
    temperature,
    reasoning,
    stream,
    responseFormat,
    ...restOptions
  } = options

  // 验证推理参数
  if (reasoning?.effort) {
    validateReasoningEffort(reasoning.effort)
  }

  // 基础请求体
  const body: Record<string, any> = {
    model,
    messages,
    temperature: temperature ?? 1.0,
    ...restOptions
  }

  // 提供商特定参数处理
  if (provider === 'zenmux') {
    handleZenMuxParams(body, { maxTokens, stream })
  } else if (provider === '302ai') {
    handle302AIParams(body, { maxTokens, stream })
  }

  // 推理模式特殊处理
  if (reasoning && reasoning.enabled !== false) {
    handleReasoningParams(body, reasoning, model)
  }

  // 响应格式
  if (responseFormat) {
    body.response_format = responseFormat
  }

  return body
}

/**
 * ZenMux特定参数处理
 * - 使用 max_completion_tokens（而非max_tokens）
 * - 流式响应需要 stream_options.include_usage
 */
function handleZenMuxParams(
  body: Record<string, any>,
  options: { maxTokens?: number; stream?: boolean }
) {
  if (options.maxTokens) {
    body.max_completion_tokens = options.maxTokens
  }

  if (options.stream) {
    body.stream = true
    body.stream_options = {
      include_usage: true // ZenMux优化：在最后chunk包含用量信息
    }
  }
}

/**
 * 302.AI特定参数处理
 * - 使用 max_tokens（OpenAI标准）
 */
function handle302AIParams(
  body: Record<string, any>,
  options: { maxTokens?: number; stream?: boolean }
) {
  if (options.maxTokens) {
    body.max_tokens = options.maxTokens
  }

  if (options.stream) {
    body.stream = true
  }
}

/**
 * 推理模式参数处理
 * - 设置 reasoning.effort
 * - Claude模型强制 temperature=1
 */
function handleReasoningParams(
  body: Record<string, any>,
  reasoning: NonNullable<BuildLLMRequestOptions['reasoning']>,
  model: string
) {
  body.reasoning = {
    effort: reasoning.effort
  }

  if (reasoning.maxTokens) {
    body.reasoning.max_tokens = reasoning.maxTokens
  }

  // Claude推理模式必须temperature=1
  if (model.includes('claude')) {
    body.temperature = 1
  }
}

/**
 * 验证推理强度参数
 */
function validateReasoningEffort(effort: string): void {
  const validEfforts: ReasoningEffort[] = ['low', 'medium', 'high']
  if (!validEfforts.includes(effort as ReasoningEffort)) {
    throw new Error(
      `Invalid reasoning effort: "${effort}". Must be one of: ${validEfforts.join(', ')}`
    )
  }
}

/**
 * 根据推理强度获取推荐的请求超时时间
 *
 * 超时策略：
 * - 无推理: 60秒
 * - low: 90秒 (1.5x)
 * - medium: 120秒 (2x)
 * - high: 180秒 (3x)
 */
export function getRequestTimeout(reasoning?: { effort: ReasoningEffort }): number {
  if (!reasoning) {
    return 60000 // 普通模式60秒
  }

  const timeouts: Record<ReasoningEffort, number> = {
    'low': 90000,      // 1.5分钟
    'medium': 120000,  // 2分钟
    'high': 180000     // 3分钟
  }

  return timeouts[reasoning.effort] ?? 120000
}

/**
 * 从模型ID推断提供商类型
 *
 * @param modelId - 模型ID（如 anthropic/claude-sonnet-4.5）
 * @returns 提供商类型
 */
export function inferProviderFromModel(modelId: string): LLMProvider {
  // ZenMux模型格式：provider/model
  if (modelId.includes('/')) {
    return 'zenmux'
  }

  // 302.AI通常使用原始模型名（如 gpt-4o-audio-preview）
  return '302ai'
}

/**
 * 简化版API：根据模型ID自动推断提供商
 */
export function buildLLMRequestAuto(
  options: Omit<BuildLLMRequestOptions, 'provider'>
): Record<string, any> {
  const provider = inferProviderFromModel(options.model)

  return buildLLMRequest({
    provider,
    ...options
  } as BuildLLMRequestOptions)
}
