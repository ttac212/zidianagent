/**
 * SSE错误处理和生命周期清理测试
 * 确保SSE流中的错误正确触发lifecycle清理，防止用户无法再次发送消息
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseSSEStreamWithCallbacks, parseSSEStream } from '@/lib/chat/stream-parser'

describe('SSE错误处理和生命周期清理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该在SSE流错误时抛出异常并正确清理', async () => {
    // 模拟包含错误的SSE响应
    const errorSSEContent = `data: {"choices":[{"delta":{"content":"正常内容"}}]}
data: {"error":{"message":"API配额已用完"}}
data: [DONE]`

    const mockResponse = {
      body: {
        getReader: () => {
          let index = 0
          const chunks = [errorSSEContent]

          return {
            read: async () => {
              if (index >= chunks.length) {
                return { done: true, value: undefined }
              }
              const chunk = chunks[index++]
              return {
                done: false,
                value: new TextEncoder().encode(chunk)
              }
            },
            releaseLock: vi.fn()
          }
        }
      }
    } as unknown as Response

    // 设置回调函数监控
    const callbacks = {
      onStart: vi.fn(),
      onContent: vi.fn(),
      onError: vi.fn(),
      onFinish: vi.fn()
    }

    // 测试：parseSSEStreamWithCallbacks 应该在遇到错误时抛出异常
    await expect(async () => {
      await parseSSEStreamWithCallbacks(mockResponse, callbacks)
    }).rejects.toThrow('SSE stream error: API配额已用完')

    // 验证回调调用顺序
    expect(callbacks.onStart).toHaveBeenCalledTimes(1)
    expect(callbacks.onContent).toHaveBeenCalledWith('正常内容')
    expect(callbacks.onError).toHaveBeenCalledWith('API配额已用完')
    expect(callbacks.onFinish).not.toHaveBeenCalled() // 错误时不应该调用 onFinish
  })

  it('应该通过async generator正确处理错误', async () => {
    const errorSSEContent = `data: {"error":{"message":"模型服务不可用"}}`

    const mockResponse = {
      body: {
        getReader: () => ({
          read: async () => {
            return {
              done: false,
              value: new TextEncoder().encode(errorSSEContent)
            }
          },
          releaseLock: vi.fn()
        })
      }
    } as unknown as Response

    const chunks = []

    try {
      for await (const chunk of parseSSEStream(mockResponse)) {
        chunks.push(chunk)
        // 第一个chunk应该包含错误
        if (chunk.error) {
          break
        }
      }
    } catch (error) {
      // 可能会抛出异常，这是正常的
    }

    // 应该收到错误chunk
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual({
      error: '模型服务不可用',
      finished: false
    })
  })

  it('应该在正常流结束时调用onFinish', async () => {
    const normalSSEContent = `data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" World"}}]}
data: [DONE]`

    const mockResponse = {
      body: {
        getReader: () => {
          let index = 0
          const chunks = [normalSSEContent]

          return {
            read: async () => {
              if (index >= chunks.length) {
                return { done: true, value: undefined }
              }
              const chunk = chunks[index++]
              return {
                done: false,
                value: new TextEncoder().encode(chunk)
              }
            },
            releaseLock: vi.fn()
          }
        }
      }
    } as unknown as Response

    const callbacks = {
      onStart: vi.fn(),
      onContent: vi.fn(),
      onError: vi.fn(),
      onFinish: vi.fn()
    }

    const result = await parseSSEStreamWithCallbacks(mockResponse, callbacks)

    expect(result).toBe('Hello World')
    expect(callbacks.onStart).toHaveBeenCalledTimes(1)
    expect(callbacks.onContent).toHaveBeenCalledTimes(2)
    expect(callbacks.onError).not.toHaveBeenCalled()
    expect(callbacks.onFinish).toHaveBeenCalledTimes(1)
  })

  it('应该正确处理解析错误', async () => {
    const invalidSSEContent = `data: {invalid json}
data: {"choices":[{"delta":{"content":"后续正常内容"}}]}
data: [DONE]`

    const mockResponse = {
      body: {
        getReader: () => {
          let index = 0
          const chunks = [invalidSSEContent]

          return {
            read: async () => {
              if (index >= chunks.length) {
                return { done: true, value: undefined }
              }
              const chunk = chunks[index++]
              return {
                done: false,
                value: new TextEncoder().encode(chunk)
              }
            },
            releaseLock: vi.fn()
          }
        }
      }
    } as unknown as Response

    const callbacks = {
      onStart: vi.fn(),
      onContent: vi.fn(),
      onError: vi.fn(),
      onFinish: vi.fn()
    }

    // 解析错误不应该导致整个流失败
    const result = await parseSSEStreamWithCallbacks(mockResponse, callbacks)

    expect(result).toBe('后续正常内容')
    expect(callbacks.onStart).toHaveBeenCalledTimes(1)
    expect(callbacks.onContent).toHaveBeenCalledWith('后续正常内容')
    expect(callbacks.onFinish).toHaveBeenCalledTimes(1)
    // 解析错误不会触发 onError（因为是JSON解析失败，不是服务端错误）
  })
})