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
      const message: SSEMessage = {}

      // 提取内容
      if (parsed.choices?.[0]?.delta?.content) {
        message.content = parsed.choices[0].delta.content
      }

      // 提取token使用信息
      if (parsed.usage) {
        message.usage = parsed.usage
      }

      // 检查是否结束
      if (parsed.choices?.[0]?.finish_reason) {
        message.finished = true
      }

      // 提取错误信息
      if (parsed.error) {
        message.error = parsed.error.message || parsed.error
      }

      // 只有当消息有内容时才添加
      if (Object.keys(message).length > 0) {
        messages.push(message)
      }
    } catch (e) {
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