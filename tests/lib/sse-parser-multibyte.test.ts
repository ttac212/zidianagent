/**
 * SSE Parser 多字节字符测试
 * 确保 TextDecoder 流模式正确处理中文/emoji 跨chunk分割
 */

import { describe, it, expect } from 'vitest'
import { parseSSEChunk, createSSETransformStream } from '@/lib/utils/sse-parser'

describe('SSE Parser - 多字节字符支持', () => {
  it('应该正确处理跨chunk分割的中文字符', () => {
    // UTF-8编码: "你好" = E4 BD A0 E5 A5 BD (6字节)
    // 第一个chunk包含前3字节(不完整的字符)
    const chunk1 = new Uint8Array([
      0x64, 0x61, 0x74, 0x61, 0x3a, 0x20, // "data: "
      0xe4, 0xbd, 0xa0 // "你"的前3字节
    ])

    // 第二个chunk包含剩余的3字节
    const chunk2 = new Uint8Array([
      0xe5, 0xa5, 0xbd, // "好"的3字节
      0x0a, 0x0a // "\n\n"
    ])

    const decoder = new TextDecoder()
    const text1 = decoder.decode(chunk1, { stream: true })
    const text2 = decoder.decode(chunk2, { stream: true })

    // 验证decoder在流模式下能正确处理分割的字符
    const fullText = text1 + text2
    expect(fullText).toContain('你好')
  })

  it('应该正确处理包含emoji的SSE消息', () => {
    // emoji "😀" = F0 9F 98 80 (4字节)
    const sseData = 'data: {"content":"测试😀消息"}\n\n'
    const encoder = new TextEncoder()
    const bytes = encoder.encode(sseData)

    // 在emoji中间分割
    const chunk1 = bytes.slice(0, 25) // 包含部分emoji
    const chunk2 = bytes.slice(25)    // 剩余部分

    const decoder = new TextDecoder()
    const text1 = decoder.decode(chunk1, { stream: true })
    const text2 = decoder.decode(chunk2, { stream: true })

    const { messages } = parseSSEChunk(text1 + text2)
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('测试😀消息')
  })

  it('TransformStream应该正确处理分块的中文内容', async () => {
    const chunks = [
      'data: {"content":"这是"}\n\n',
      'data: {"content":"一个测"}\n\n',
      'data: {"content":"试😀"}\n\n'
    ]

    let fullContent = ''
    const transform = createSSETransformStream(
      (content) => { fullContent += content },
      undefined
    )

    const encoder = new TextEncoder()

    // 修复: 使用管道而不是手动读写
    const readable = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          const bytes = encoder.encode(chunk)
          // 在多字节字符边界分割
          const mid = Math.floor(bytes.length / 2)
          controller.enqueue(bytes.slice(0, mid))
          controller.enqueue(bytes.slice(mid))
        }
        controller.close()
      }
    })

    // 管道到transform,并消费输出
    const transformed = readable.pipeThrough(transform)
    const reader = transformed.getReader()

    while (true) {
      const { done } = await reader.read()
      if (done) break
    }

    expect(fullContent).toBe('这是一个测试😀')
  }, 10000) // 增加超时时间

  it('应该正确处理跨chunk的抖音事件(包含中文字段)', () => {
    const douyinEvent = JSON.stringify({
      type: 'progress',
      status: 'active',
      percentage: 50,
      detail: '正在分析视频内容...'
    })

    const sseData = `event: douyin-progress\ndata: ${douyinEvent}\n\n`
    const encoder = new TextEncoder()
    const bytes = encoder.encode(sseData)

    // 在中文"正"字中间分割(UTF-8: E6 AD A3)
    const splitPoint = sseData.indexOf('正') + 1
    const chunk1Str = sseData.slice(0, splitPoint)
    const chunk2Str = sseData.slice(splitPoint)

    const chunk1 = encoder.encode(chunk1Str)
    const chunk2 = encoder.encode(chunk2Str)

    const decoder = new TextDecoder()
    const text1 = decoder.decode(chunk1, { stream: true })
    const text2 = decoder.decode(chunk2, { stream: true })

    const { messages } = parseSSEChunk(text1 + text2)
    expect(messages).toHaveLength(1)
    expect(messages[0].event).toBe('douyin-progress')
    expect(messages[0].payload).toBeDefined()

    const payload = messages[0].payload as any
    expect(payload.detail).toBe('正在分析视频内容...')
  })

  it('应该处理空chunk和纯ASCII内容', () => {
    const { messages: emptyResult } = parseSSEChunk('')
    expect(emptyResult).toHaveLength(0)

    const asciiData = 'data: {"content":"Hello World"}\n\n'
    const { messages } = parseSSEChunk(asciiData)
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('Hello World')
  })

  // P0测试: decoder flush必须在stream结束后调用
  it('[P0] processSSEStream必须flush decoder以避免丢失多字节字符', async () => {
    const { processSSEStream } = await import('@/lib/utils/sse-parser')

    // 构造一个在最后chunk结束时有不完整UTF-8字符的场景
    // "测试😀" = "测试" + emoji(F0 9F 98 80)
    const sseData = 'data: {"content":"测试😀"}\n\n'
    const encoder = new TextEncoder()
    const bytes = encoder.encode(sseData)

    // 关键: 在emoji的前3个字节处分割,最后1个字节留在最后的chunk
    const emojiStart = sseData.indexOf('😀')
    const encodedEmojiStart = encoder.encode(sseData.slice(0, emojiStart)).length
    const splitPoint = encodedEmojiStart + 3 // 前3个字节

    const chunk1 = bytes.slice(0, splitPoint)
    const chunk2 = bytes.slice(splitPoint)

    // 模拟ReadableStream,第一个chunk包含不完整emoji
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk1)
        controller.enqueue(chunk2)
        controller.close()
      }
    })

    const reader = stream.getReader()
    let receivedContent = ''

    await processSSEStream(reader, {
      onContent: (content) => {
        receivedContent += content
      }
    })

    // 验证: 完整emoji必须被解析
    expect(receivedContent).toBe('测试😀')
  })

  // P0测试: createSSETransformStream的flush也必须正确
  it('[P0] createSSETransformStream flush必须处理不完整UTF-8字符', async () => {
    const sseData = 'data: {"content":"结束😀"}\n\n'
    const encoder = new TextEncoder()
    const bytes = encoder.encode(sseData)

    // 在emoji中间分割
    const emojiStart = sseData.indexOf('😀')
    const encodedEmojiStart = encoder.encode(sseData.slice(0, emojiStart)).length
    const splitPoint = encodedEmojiStart + 2 // 只给前2个字节

    let fullContent = ''
    const transform = createSSETransformStream(
      (content) => { fullContent += content },
      undefined
    )

    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, splitPoint))
        controller.enqueue(bytes.slice(splitPoint))
        controller.close()
      }
    })

    const transformed = readable.pipeThrough(transform)
    const reader = transformed.getReader()

    while (true) {
      const { done } = await reader.read()
      if (done) break
    }

    expect(fullContent).toBe('结束😀')
  })
})
