/**
 * SSE (Server-Sent Events) 解析工具
 *
 * Linus原则：一个函数做一件事，做好它
 * 消除了API route和hooks中的重复代码
 */

export interface SSEMessage {
  content?: string
  error?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  finished?: boolean
}

export interface SSEParseResult {
  messages: SSEMessage[]
  remainingBuffer: string
}

/**
 * 归一化不同AI Provider的响应格式
 * Linus原则：所有特殊情况都在这里处理，主流程保持简单
 *
 * 支持格式：
 * 1. OpenAI: { choices: [{ delta: { content }, finish_reason }] }
 * 2. Claude/302.AI扁平格式: { content, error, usage }
 * 3. 纯文本: 字符串直接作为content
 */
function normalizePayload(raw: unknown): SSEMessage | null {
  if (!raw) return null

  const message: SSEMessage = {}

  // 处理纯字符串
  if (typeof raw === 'string') {
    message.content = raw
    return message
  }

  // 类型守卫
  const obj = raw as Record<string, any>

  // 优先处理扁平格式（最简单的情况）
  if ('content' in obj) {
    message.content = obj.content
  }

  if ('error' in obj) {
    message.error = typeof obj.error === 'string'
      ? obj.error
      : obj.error?.message || JSON.stringify(obj.error)
  }

  if ('usage' in obj && typeof obj.usage === 'object') {
    message.usage = obj.usage
  }

  if ('finished' in obj) {
    message.finished = obj.finished
  }

  // OpenAI格式兼容（仅在没有扁平content时检查）
  if (!message.content && obj.choices?.[0]) {
    const choice = obj.choices[0]

    if (choice.delta?.content) {
      message.content = choice.delta.content
    }

    if (choice.message?.content) {
      message.content = choice.message.content
    }

    if (choice.finish_reason) {
      message.finished = true
    }
  }

  // 返回null表示没有有效数据
  return Object.keys(message).length > 0 ? message : null
}

/**
 * 解析SSE数据块
 * 处理跨chunk的不完整行，返回解析的消息和剩余缓冲区
 */
export function parseSSEChunk(chunk: string, buffer: string = ''): SSEParseResult {
  const messages: SSEMessage[] = []

  // 将新数据添加到缓冲区
  let workingBuffer = buffer + chunk

  // 按行分割，但保留最后的不完整行
  const lines = workingBuffer.split('\n')

  // 如果最后一个元素不是空字符串，说明可能是不完整的行
  let remainingBuffer = ''
  if (lines[lines.length - 1] !== '') {
    remainingBuffer = lines.pop() || ''
  } else {
    lines.pop() // 移除最后的空字符串
  }

  // 处理每一行
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue

    const data = line.slice(6).trim()
    if (data === '[DONE]') {
      messages.push({ finished: true })
      continue
    }

    try {
      const parsed = JSON.parse(data)
      const message = normalizePayload(parsed)

      if (message) {
        messages.push(message)
      }
    } catch (_e) {
      // 解析错误，忽略这行
    }
  }

  return { messages, remainingBuffer }
}

/**
 * 处理SSE流的完整生命周期
 * 使用回调模式处理流式数据
 */
export interface SSEStreamCallbacks {
  onMessage?: (_message: SSEMessage) => void
  onContent?: (_content: string, _fullContent: string) => void
  onError?: (_error: string) => void
  onFinish?: () => void
  onUsage?: (_usage: SSEMessage['usage']) => void
}

export async function processSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: SSEStreamCallbacks
): Promise<string> {
  let buffer = ''
  let fullContent = ''
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const { messages, remainingBuffer } = parseSSEChunk(chunk, buffer)
      buffer = remainingBuffer

      // 处理每个消息
      for (const message of messages) {
        callbacks.onMessage?.(message)

        if (message.content) {
          fullContent += message.content
          callbacks.onContent?.(message.content, fullContent)
        }

        if (message.error) {
          callbacks.onError?.(message.error)
        }

        if (message.usage) {
          callbacks.onUsage?.(message.usage)
        }

        if (message.finished) {
          callbacks.onFinish?.()
        }
      }
    }

    // 处理缓冲区中剩余的数据
    if (buffer.trim()) {
      const { messages } = parseSSEChunk('', buffer + '\n')
      for (const message of messages) {
        if (message.content) {
          fullContent += message.content
          callbacks.onContent?.(message.content, fullContent)
        }
      }
    }
  } catch (error) {
    // AbortError必须重新抛出，不能把中断当作正常完成
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }

    // 其他错误走回调处理
    callbacks.onError?.(error instanceof Error ? error.message : 'Stream processing error')
  }

  return fullContent
}

/**
 * 创建Transform流用于SSE处理（用于API route）
 */
export function createSSETransformStream(
  onContent?: (_content: string) => void,
  onComplete?: (_fullContent: string, _usage?: SSEMessage['usage']) => void | Promise<void>
): TransformStream {
  let buffer = ''
  let assistantContent = ''
  let tokenUsage: SSEMessage['usage'] | undefined

  return new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk)
      const { messages, remainingBuffer } = parseSSEChunk(text, buffer)
      buffer = remainingBuffer

      for (const message of messages) {
        if (message.content) {
          assistantContent += message.content
          onContent?.(message.content)
        }

        if (message.usage) {
          tokenUsage = message.usage
        }
      }

      controller.enqueue(chunk)
    },

    async flush() {
      // 处理缓冲区中剩余的数据
      if (buffer.trim()) {
        const { messages } = parseSSEChunk('', buffer + '\n')
        for (const message of messages) {
          if (message.content) {
            assistantContent += message.content
          }
          if (message.usage) {
            tokenUsage = message.usage
          }
        }
      }

      if (onComplete) {
        await Promise.resolve(onComplete(assistantContent, tokenUsage))
      }
    }
  })
}