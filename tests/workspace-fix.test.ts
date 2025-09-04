/**
 * Workspace 页面修复功能测试
 * 测试对话历史刷新和持久化功能
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversations } from '@/hooks/use-conversations'
import { LocalStorage, STORAGE_KEYS } from '@/lib/storage'

// Mock localStorage
const mockLocalStorage = {
  store: new Map<string, string>(),
  getItem: vi.fn((key: string) => mockLocalStorage.store.get(key) || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage.store.set(key, value)
  }),
  removeItem: vi.fn((key: string) => {
    mockLocalStorage.store.delete(key)
  }),
  clear: vi.fn(() => {
    mockLocalStorage.store.clear()
  })
}

// Mock fetch API
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock console methods to reduce noise in tests
const originalConsole = { ...console }
beforeEach(() => {
  console.log = vi.fn()
  console.warn = vi.fn()
  console.error = vi.fn()
})

afterEach(() => {
  Object.assign(console, originalConsole)
})

// Test data
const mockConversations = [
  {
    id: 'conv-1',
    title: '测试对话1',
    modelId: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2000,
    messageCount: 2,
    totalTokens: 150,
    createdAt: '2024-08-28T10:00:00Z',
    updatedAt: '2024-08-28T10:05:00Z',
    lastMessageAt: '2024-08-28T10:05:00Z',
    messages: [
      {
        id: 'msg-1',
        role: 'USER' as const,
        content: '你好',
        modelId: 'gpt-4o-mini',
        temperature: 0.7,
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
        finishReason: null,
        metadata: {},
        createdAt: '2024-08-28T10:00:00Z'
      },
      {
        id: 'msg-2',
        role: 'ASSISTANT' as const,
        content: '你好！有什么可以帮助你的吗？',
        modelId: 'gpt-4o-mini',
        temperature: 0.7,
        promptTokens: 10,
        completionTokens: 15,
        totalTokens: 25,
        finishReason: 'stop',
        metadata: {},
        createdAt: '2024-08-28T10:01:00Z'
      }
    ]
  },
  {
    id: 'conv-2',
    title: '测试对话2',
    modelId: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2000,
    messageCount: 1,
    totalTokens: 50,
    createdAt: '2024-08-28T11:00:00Z',
    updatedAt: '2024-08-28T11:01:00Z',
    lastMessageAt: '2024-08-28T11:01:00Z',
    messages: [
      {
        id: 'msg-3',
        role: 'USER' as const,
        content: '测试消息',
        modelId: 'gpt-4o-mini',
        temperature: 0.7,
        promptTokens: 20,
        completionTokens: 0,
        totalTokens: 20,
        finishReason: null,
        metadata: {},
        createdAt: '2024-08-28T11:00:00Z'
      }
    ]
  }
]

describe('Workspace 修复功能测试', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    mockLocalStorage.store.clear()
    
    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage
    })

    // Mock successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/conversations') && !url.includes('/api/conversations/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { conversations: mockConversations }
          })
        })
      }
      if (url.includes('/api/conversations/conv-1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockConversations[0]
          })
        })
      }
      if (url.includes('/api/conversations/conv-2')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockConversations[1]
          })
        })
      }
      return Promise.reject(new Error('Unknown API endpoint'))
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('LocalStorage 持久化功能', () => {
    test('应该正确保存和读取当前对话ID', () => {
      const testId = 'conv-123'
      
      // 保存对话ID
      LocalStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, testId)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'zhidian_current_conversation_id',
        JSON.stringify(testId)
      )

      // 读取对话ID
      const retrievedId = LocalStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, null)
      expect(retrievedId).toBe(testId)
    })

    test('应该正确处理localStorage不可用的情况', () => {
      // 模拟localStorage抛出异常
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage not available')
      })

      expect(() => {
        LocalStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, 'test')
      }).not.toThrow()
    })

    test('应该正确清除对话ID', () => {
      LocalStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, 'conv-123')
      LocalStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID)
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'zhidian_current_conversation_id'
      )
    })
  })

  describe('对话选择恢复功能', () => {
    test('应该从localStorage恢复上次选中的对话', async () => {
      // 预设localStorage中有保存的对话ID
      mockLocalStorage.store.set('zhidian_current_conversation_id', JSON.stringify('conv-2'))

      const { result } = renderHook(() => useConversations())

      // 等待初始化完成
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // 验证恢复了正确的对话ID
      expect(result.current.currentConversationId).toBe('conv-2')
    })

    test('应该在无保存记录时选择第一个对话', async () => {
      // localStorage中没有保存的对话ID
      const { result } = renderHook(() => useConversations())

      // 等待加载完成
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // 验证选择了第一个对话
      expect(result.current.currentConversationId).toBe('conv-1')
      
      // 验证保存了选择到localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'zhidian_current_conversation_id',
        JSON.stringify('conv-1')
      )
    })

    test('应该处理保存的对话ID不存在的情况', async () => {
      // 预设一个不存在的对话ID
      mockLocalStorage.store.set('zhidian_current_conversation_id', JSON.stringify('conv-nonexistent'))

      const { result } = renderHook(() => useConversations())

      // 等待处理完成
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // 应该回退到选择第一个对话
      expect(result.current.currentConversationId).toBe('conv-1')
    })
  })

  describe('对话切换持久化', () => {
    test('应该在切换对话时保存到localStorage', async () => {
      const { result } = renderHook(() => useConversations())

      // 等待初始化
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // 切换对话
      await act(async () => {
        await result.current.setCurrentConversation('conv-2')
      })

      // 验证保存了新的对话选择
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'zhidian_current_conversation_id',
        JSON.stringify('conv-2')
      )
    })

    test('应该在删除当前对话时更新localStorage', async () => {
      // 预设选中conv-2
      mockLocalStorage.store.set('zhidian_current_conversation_id', JSON.stringify('conv-2'))

      const { result } = renderHook(() => useConversations())

      // 等待初始化
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Mock删除API成功
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({ ok: true })
      )

      // 删除当前对话
      await act(async () => {
        await result.current.deleteConversation('conv-2')
      })

      // 应该选择剩余的第一个对话并保存
      expect(result.current.currentConversationId).toBe('conv-1')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'zhidian_current_conversation_id',
        JSON.stringify('conv-1')
      )
    })
  })

  describe('消息加载逻辑', () => {
    test('应该正确加载对话消息详情', async () => {
      const { result } = renderHook(() => useConversations())

      // 等待初始化和消息加载
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
      })

      // 验证加载了对话和消息
      expect(result.current.conversations).toHaveLength(2)
      const currentConv = result.current.getCurrentConversation()
      expect(currentConv).toBeTruthy()
      expect(currentConv?.messages).toHaveLength(2)
    })

    test('应该在切换对话时正确加载消息', async () => {
      const { result } = renderHook(() => useConversations())

      // 等待初始化
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // 切换到另一个对话
      await act(async () => {
        await result.current.setCurrentConversation('conv-2')
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // 验证切换后的对话消息
      const currentConv = result.current.getCurrentConversation()
      expect(currentConv?.id).toBe('conv-2')
      expect(currentConv?.messages).toHaveLength(1)
    })
  })

  describe('错误处理', () => {
    test('应该处理API加载失败', async () => {
      // Mock API失败
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({ ok: false, status: 500 })
      )

      const { result } = renderHook(() => useConversations())

      // 等待处理完成
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // 验证错误状态
      expect(result.current.error).toBeTruthy()
      expect(result.current.conversations).toHaveLength(0)
    })

    test('应该处理localStorage读取异常', async () => {
      // Mock localStorage.getItem抛出异常
      mockLocalStorage.getItem.mockImplementationOnce(() => {
        throw new Error('localStorage not available')
      })

      // 创建hook时应该不会崩溃，会回退到默认值
      const { result } = renderHook(() => useConversations())

      // 验证hook正常初始化
      expect(result.current.currentConversationId).toBe(null)
      expect(result.current.loading).toBe(true)
    })
  })
})

describe('集成测试场景', () => {
  test('完整的刷新恢复场景', async () => {
    // 模拟用户第一次访问，选择了conv-2
    mockLocalStorage.store.set('zhidian_current_conversation_id', JSON.stringify('conv-2'))

    const { result, unmount } = renderHook(() => useConversations())

    // 等待初始化和数据加载
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    // 验证恢复了正确的对话
    expect(result.current.currentConversationId).toBe('conv-2')
    expect(result.current.getCurrentConversation()?.title).toBe('测试对话2')
    expect(result.current.loading).toBe(false)

    unmount()

    // 模拟页面刷新 - 重新渲染hook
    const { result: result2 } = renderHook(() => useConversations())

    // 等待重新初始化
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    // 验证刷新后仍然保持相同的对话选择
    expect(result2.current.currentConversationId).toBe('conv-2')
    expect(result2.current.getCurrentConversation()?.title).toBe('测试对话2')
  })

  test('用户操作持久化场景', async () => {
    // 确保localStorage为空，测试从头开始
    mockLocalStorage.store.clear()
    
    const { result } = renderHook(() => useConversations())

    // 等待初始化
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // 验证初始化后选择了第一个对话（因为localStorage为空）
    expect(result.current.currentConversationId).toBe('conv-1')

    // 用户选择不同的对话
    await act(async () => {
      await result.current.setCurrentConversation('conv-2')
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // 验证对话切换成功
    expect(result.current.currentConversationId).toBe('conv-2')

    // 用户创建新对话
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            id: 'conv-new',
            title: '新对话',
            modelId: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 2000,
            messageCount: 0,
            totalTokens: 0,
            createdAt: '2024-08-28T12:00:00Z',
            updatedAt: '2024-08-28T12:00:00Z',
            lastMessageAt: null,
            messages: []
          }
        })
      })
    )

    await act(async () => {
      await result.current.createConversation('gpt-4o-mini')
    })

    // 验证新对话被设置为当前对话
    expect(result.current.currentConversationId).toBe('conv-new')
    expect(result.current.conversations).toHaveLength(3) // 原来2个 + 新建1个
  })
})