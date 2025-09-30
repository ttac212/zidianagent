/**
 * SSE错误处理和生命周期清理测试
 * 确保SSE流中的错误正确触发lifecycle清理，防止用户无法再次发送消息
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseSSEChunk, processSSEStream } from '@/lib/utils/sse-parser'

describe('SSE错误处理和生命周期清理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该正确解析包含错误的SSE块', () => {
    const errorSSEContent = `data: {"error":"API配额已用完"}

data: [DONE]`

    const result = parseSSEChunk(errorSSEContent)

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].error).toBe('API配额已用完')
  })

  it('应该正确解析正常内容的SSE块', () => {
    const normalSSEContent = `data: {"content":"正常内容"}

data: [DONE]`

    const result = parseSSEChunk(normalSSEContent)

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].content).toBe('正常内容')
  })

  it('应该正确解析混合内容的SSE块', () => {
    const mixedSSEContent = `data: {"content":"第一部分内容"}

data: {"content":"第二部分内容"}

data: {"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}

data: [DONE]`

    const result = parseSSEChunk(mixedSSEContent)

    expect(result.messages).toHaveLength(3)
    expect(result.messages[0].content).toBe('第一部分内容')
    expect(result.messages[1].content).toBe('第二部分内容')
    expect(result.messages[2].usage?.total_tokens).toBe(30)
  })

  it('应该正确处理空数据块', () => {
    const emptySSEContent = `data:

data: [DONE]`

    const result = parseSSEChunk(emptySSEContent)

    expect(result.messages).toHaveLength(0)
  })

  it('应该正确处理格式错误的数据', () => {
    const invalidSSEContent = `data: {"invalid json"

data: [DONE]`

    const result = parseSSEChunk(invalidSSEContent)

    expect(result.messages).toHaveLength(0)
    expect(result.remainingBuffer).toBeTruthy()
  })
})