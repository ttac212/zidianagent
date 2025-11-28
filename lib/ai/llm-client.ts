/**
 * 统一的 LLM 客户端
 * 提供流式和非流式 API 调用，消除重复代码
 */

import { getAIConfig, validateAIConfig, selectModel } from '@/lib/config/ai-config'

/**
 * LLM 请求参数
 */
export interface LLMRequest {
  prompt: string
  modelId?: string
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
}

/**
 * 流式 LLM 请求参数
 */
export interface LLMStreamRequest extends LLMRequest {
  onChunk: (delta: string) => void | Promise<void>
}

/**
 * LLM 响应
 */
export interface LLMResponse {
  content: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * 解析 LLM API 错误响应
 */
async function parseLLMError(response: Response): Promise<string> {
  try {
    const errorText = await response.text()
    try {
      const errorJson = JSON.parse(errorText)
      return errorJson.error?.message || errorJson.message || errorText
    } catch {
      return errorText
    }
  } catch {
    return '无法读取错误详情'
  }
}

/**
 * 构建 LLM 错误消息
 */
function buildLLMErrorMessage(status: number, statusText: string, detail: string): string {
  return detail
    ? `LLM API错误: ${status} - ${detail}`
    : `LLM API错误: HTTP ${status} ${statusText}`
}

/**
 * 调用 LLM API（非流式）
 */
export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  const config = validateAIConfig()
  const modelId = request.modelId || config.defaultModel

  const response = await fetch(`${config.apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: request.prompt }],
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature ?? 0.7,
      stream: false
    }),
    signal: request.signal
  })

  if (!response.ok) {
    const detail = await parseLLMError(response)
    throw new Error(buildLLMErrorMessage(response.status, response.statusText, detail))
  }

  const data = await response.json()

  if (!data.choices || data.choices.length === 0) {
    throw new Error('LLM API 返回格式错误')
  }

  return {
    content: data.choices[0].message.content,
    usage: data.usage
  }
}

/**
 * 调用 LLM API（流式）
 * 统一处理 SSE 流式响应，消除重复代码
 */
export async function callLLMStream(request: LLMStreamRequest): Promise<string> {
  const config = validateAIConfig()
  const modelId = request.modelId || config.defaultModel

  const response = await fetch(`${config.apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: request.prompt }],
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature ?? 0.7,
      stream: true
    }),
    signal: request.signal
  })

  if (!response.ok) {
    const detail = await parseLLMError(response)
    throw new Error(buildLLMErrorMessage(response.status, response.statusText, detail))
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法读取响应流')
  }

  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  try {
    while (true) {
      if (request.signal?.aborted) {
        throw new Error('请求已取消')
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        // 处理结束标记
        if (line.trim() === 'data:[DONE]' || line.trim() === 'data: [DONE]') continue

        // 解析 SSE 数据
        if (line.startsWith('data:')) {
          try {
            const jsonStr = line.startsWith('data: ') ? line.slice(6) : line.slice(5)
            const data = JSON.parse(jsonStr)
            const rawContent = data.choices?.[0]?.delta?.content

            // 兼容 OpenAI/ZenMux 的 content 数组格式
            // content 可能是字符串或 [{type: 'text', text: '...'}, ...] 数组
            // 注意：text 字段本身也可能是嵌套对象 {value: '...'}
            let delta: string | undefined
            if (rawContent !== undefined && rawContent !== null) {
              if (typeof rawContent === 'string') {
                delta = rawContent
              } else if (Array.isArray(rawContent)) {
                // 数组格式：提取所有 text 部分拼接
                delta = rawContent
                  .map(part => {
                    if (typeof part === 'string') return part
                    if (part && typeof part === 'object' && 'text' in part) {
                      // text 可能是字符串或嵌套对象 {value: '...'}
                      const text = part.text
                      return typeof text === 'string' ? text : (text?.value ?? '')
                    }
                    return ''
                  })
                  .join('')
              }
            }

            if (delta) {
              fullText += delta
              await request.onChunk(delta)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!fullText) {
    throw new Error('LLM 分析失败，未返回文本')
  }

  return fullText
}

/**
 * 带超时的流式 LLM 调用
 */
export async function callLLMStreamWithTimeout(
  request: LLMStreamRequest,
  timeoutMs: number = 180000
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.warn(`[LLM] 请求超时 (${timeoutMs}ms)，正在取消...`)
    controller.abort()
  }, timeoutMs)

  // 如果传入了外部 signal，也监听它
  const abortHandler = () => {
    clearTimeout(timeoutId)
    controller.abort()
  }

  if (request.signal) {
    request.signal.addEventListener('abort', abortHandler)
  }

  try {
    return await callLLMStream({
      ...request,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeoutId)
    if (request.signal) {
      request.signal.removeEventListener('abort', abortHandler)
    }
  }
}

/**
 * 便捷函数：使用快速模式调用 LLM
 */
export async function callLLMFast(request: Omit<LLMStreamRequest, 'modelId'>): Promise<string> {
  return callLLMStream({
    ...request,
    modelId: selectModel(true)
  })
}
