/**
 * SSE (Server-Sent Events) 解析工具
 *
 * Linus原则：一个函数做一件事，做好它
 * 消除了API route和hooks中的重复代码
 */

export interface SSEMessage {
  event?: string
  payload?: unknown
  content?: string
  reasoning?: string  // ZenMux 推理内容
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
    // 处理Anthropic的content blocks格式
    if (Array.isArray(obj.content)) {
      for (const block of obj.content) {
        if (typeof block === 'object' && block !== null) {
          if (block.type === 'text' && block.text) {
            message.content = (message.content || '') + block.text
          } else if (block.type === 'thinking' && block.thinking) {
            // Claude Extended Thinking格式
            message.reasoning = (message.reasoning || '') + block.thinking
          }
        }
      }
    } else if (typeof obj.content === 'string') {
      message.content = obj.content
    }
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

    // 提取内容
    if (choice.delta?.content) {
      message.content = choice.delta.content
    }

    if (choice.message?.content) {
      message.content = choice.message.content
    }

    // 提取推理内容（ZenMux 推理模型）
    // 支持多种可能的字段名：reasoning、thinking、thought、reasoning_content
    if (choice.delta?.reasoning) {
      message.reasoning = choice.delta.reasoning
    } else if (choice.delta?.reasoning_content) {
      message.reasoning = choice.delta.reasoning_content
    } else if (choice.delta?.thinking) {
      message.reasoning = choice.delta.thinking
    } else if (choice.delta?.thought) {
      message.reasoning = choice.delta.thought
    } else if (choice.message?.reasoning) {
      message.reasoning = choice.message.reasoning
    } else if (choice.message?.reasoning_content) {
      message.reasoning = choice.message.reasoning_content
    }

    if (choice.finish_reason) {
      message.finished = true
    }
  }

  // 检查顶层 reasoning 字段（某些提供商可能使用这种格式）
  if (obj.reasoning && typeof obj.reasoning === 'string') {
    message.reasoning = obj.reasoning
  }

  // 返回null表示没有有效数据
  return Object.keys(message).length > 0 ? message : null
}

function safeParseData(data: string): unknown {
  const trimmed = data.trim()
  if (!trimmed) {
    return ''
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

function parseEventBlock(block: string): SSEMessage | null {
  const lines = block.split('\n')
  let eventType: string | undefined
  const dataLines: string[] = []

  for (const rawLine of lines) {
    if (!rawLine) continue
    if (rawLine.startsWith(':')) continue

    if (rawLine.startsWith('event:')) {
      eventType = rawLine.slice(6).trim()
      continue
    }

    if (rawLine.startsWith('data:')) {
      const value = rawLine.slice(5).replace(/^ /, '')
      dataLines.push(value)
      continue
    }
  }

  const dataString = dataLines.join('\n')

  if (!eventType) {
    if (dataString === '[DONE]') {
      return { finished: true }
    }

    if (!dataString) {
      return null
    }

    const parsed = safeParseData(dataString)
    const normalized = normalizePayload(parsed)
    if (normalized) {
      return normalized
    }

    return { payload: parsed }
  }

  const message: SSEMessage = { event: eventType }

  if (dataString === '[DONE]') {
    message.finished = true
    return message
  }

  if (dataString) {
    message.payload = safeParseData(dataString)
  }

  return message
}

/**
 * 解析SSE数据块
 * 处理跨chunk的不完整行，返回解析的消息和剩余缓冲区
 */
export function parseSSEChunk(chunk: string, buffer: string = ''): SSEParseResult {
  const messages: SSEMessage[] = []

  if (!chunk && !buffer) {
    return { messages, remainingBuffer: '' }
  }

  const workingBuffer = (buffer + chunk).replace(/\r\n/g, '\n')
  let cursor = 0

  while (true) {
    const separatorIndex = workingBuffer.indexOf('\n\n', cursor)
    if (separatorIndex === -1) break

    const block = workingBuffer.slice(cursor, separatorIndex)
    if (block.trim()) {
      const message = parseEventBlock(block)
      if (message) {
        messages.push(message)
      }
    }

    cursor = separatorIndex + 2
  }

  const remainingBuffer = workingBuffer.slice(cursor)
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

    // 修复P0: flush decoder以输出剩余的不完整多字节字符
    // 必须在stream结束后调用,否则会丢失chunk边界的UTF-8字节
    const finalChunk = decoder.decode()
    if (finalChunk) {
      const { messages: finalMessages, remainingBuffer: finalBuffer } = parseSSEChunk(finalChunk, buffer)
      buffer = finalBuffer

      for (const message of finalMessages) {
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
    if (buffer.length > 0) {
      const { messages } = parseSSEChunk('\n\n', buffer)
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
 * 检测TransformStream是否可用
 * Safari部分版本和旧浏览器可能不支持
 */
export function isTransformStreamSupported(): boolean {
  return typeof TransformStream !== 'undefined'
}

/**
 * 创建Transform流用于SSE处理(用于API route)
 * 修复: 使用持久化 TextDecoder 并启用流模式,避免多字节字符截断
 * 兼容性: 仅在支持TransformStream的环境中使用，否则抛出错误提示使用fallback
 */
export function createSSETransformStream(
  onContent?: (_content: string) => void,
  onComplete?: (
    _fullContent: string,
    _usage?: SSEMessage['usage'],
    _reasoning?: string  // ✅ 新增：推理内容
  ) => void | Promise<void>
): TransformStream {
  if (!isTransformStreamSupported()) {
    throw new Error('TransformStream not supported in this environment. Use processSSEStream instead.')
  }

  let buffer = ''
  let assistantContent = ''
  let assistantReasoning = ''  // ✅ 新增：收集推理内容
  let tokenUsage: SSEMessage['usage'] | undefined
  // 修复P0: 持久化TextDecoder并启用流模式,防止多字节字符截断
  const decoder = new TextDecoder()

  return new TransformStream({
    transform(chunk, controller) {
      // 修复P0: 使用{ stream: true }确保多字节字符正确处理
      const text = decoder.decode(chunk, { stream: true })
      const { messages, remainingBuffer } = parseSSEChunk(text, buffer)
      buffer = remainingBuffer

      for (const message of messages) {
        if (message.content) {
          assistantContent += message.content
          onContent?.(message.content)
        }

        // ✅ 新增：收集推理内容
        if (message.reasoning) {
          assistantReasoning += message.reasoning
        }

        if (message.usage) {
          tokenUsage = message.usage
        }
      }

      controller.enqueue(chunk)
    },

    async flush() {
      // 修复P0: flush decoder以输出剩余的不完整多字节字符
      const finalChunk = decoder.decode()
      if (finalChunk) {
        const { messages: finalMessages, remainingBuffer: finalBuffer } = parseSSEChunk(finalChunk, buffer)
        buffer = finalBuffer

        for (const message of finalMessages) {
          if (message.content) {
            assistantContent += message.content
            onContent?.(message.content)
          }
          // ✅ 新增：收集推理内容
          if (message.reasoning) {
            assistantReasoning += message.reasoning
          }
          if (message.usage) {
            tokenUsage = message.usage
          }
        }
      }

      // 处理缓冲区中剩余的数据
      if (buffer.length > 0) {
        const { messages } = parseSSEChunk('\n\n', buffer)
        for (const message of messages) {
          if (message.content) {
            assistantContent += message.content
          }
          // ✅ 新增：收集推理内容
          if (message.reasoning) {
            assistantReasoning += message.reasoning
          }
          if (message.usage) {
            tokenUsage = message.usage
          }
        }
      }

      if (onComplete) {
        await Promise.resolve(onComplete(assistantContent, tokenUsage, assistantReasoning || undefined))
      }
    }
  })
}
