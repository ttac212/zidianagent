/**
 * Workspace 页面修复功能测试
 * 验证对话 Hook 的持久化、切换、创建、删除等行为
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'

import { useConversations } from '@/hooks/use-conversations'
import { useConversationStore, conversationStoreInitialState } from '@/stores/conversation-store'
import { LocalStorage, STORAGE_KEYS } from '@/lib/storage'

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit]
const mockFetch = vi.fn<FetchArgs, Promise<any>>()
// @ts-expect-error - jsdom 环境覆盖全局 fetch
globalThis.fetch = mockFetch

const activeQueryClients: QueryClient[] = []

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0 },
      mutations: { retry: 0 },
    },
  })
  activeQueryClients.push(queryClient)
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient, children })
  return { Wrapper, queryClient }
}

const renderUseConversations = () => {
  const { Wrapper } = createWrapper()
  return renderHook(() => useConversations(), { wrapper: Wrapper })
}

type RenderResultType = ReturnType<typeof renderUseConversations>
const waitForConversationsReady = async (result: RenderResultType['result']) => {
  await act(async () => {
    await waitFor(() => expect(result.current.loading).toBe(false))
  })
}

const resetConversationStore = () => {
  useConversationStore.setState((state) => ({
    ...state,
    ...conversationStoreInitialState,
    conversations: [],
    currentConversation: null,
  }))
}

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

const originalConsole = { ...console }

type ApiConversation = {
  id: string
  title: string
  modelId: string
  temperature: number
  maxTokens: number
  messageCount: number
  totalTokens: number
  createdAt: string
  updatedAt: string
  lastMessageAt: string | null
  messages: Array<{
    id: string
    role: string
    content: string
    modelId: string
    temperature: number
    totalTokens: number
    createdAt: string
    metadata: Record<string, unknown>
  }>
}

const seedConversations: ApiConversation[] = [
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
        role: 'USER',
        content: '你好',
        modelId: 'gpt-4o-mini',
        temperature: 0.7,
        totalTokens: 10,
        createdAt: '2024-08-28T10:00:00Z',
        metadata: {},
      },
      {
        id: 'msg-2',
        role: 'ASSISTANT',
        content: '你好，需要什么帮助？',
        modelId: 'gpt-4o-mini',
        temperature: 0.7,
        totalTokens: 140,
        createdAt: '2024-08-28T10:05:00Z',
        metadata: {},
      },
    ],
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
    updatedAt: '2024-08-28T11:02:00Z',
    lastMessageAt: '2024-08-28T11:02:00Z',
    messages: [
      {
        id: 'msg-3',
        role: 'USER',
        content: '请帮我整理一下需求',
        modelId: 'gpt-4o-mini',
        temperature: 0.7,
        totalTokens: 50,
        createdAt: '2024-08-28T11:00:00Z',
        metadata: {},
      },
    ],
  },
]

const cloneConversation = (conversation: ApiConversation): ApiConversation => ({
  ...conversation,
  messages: conversation.messages.map((message) => ({ ...message })),
})

let serverConversations: ApiConversation[] = []

const defaultFetchHandler = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString()
  const method = (init?.method ?? 'GET').toUpperCase()

  if (url.startsWith('/api/conversations')) {
    const detailMatch = url.match(/\/api\/conversations\/([^/?]+)/)

    if (!detailMatch) {
      if (method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            data: {
              conversations: serverConversations.map(cloneConversation),
            },
          }),
        }
      }
    } else {
      const conversationId = detailMatch[1]

      if (method === 'GET') {
        const conversation = serverConversations.find((item) => item.id === conversationId)
        if (!conversation) {
          return {
            ok: false,
            status: 404,
            statusText: 'Not Found',
            json: () => Promise.resolve({ success: false, message: '未找到会话' }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: cloneConversation(conversation) }),
        }
      }

      if (method === 'DELETE') {
        serverConversations = serverConversations.filter((item) => item.id !== conversationId)
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        }
      }
    }
  }

  return Promise.reject(new Error(`Unknown API endpoint: ${method} ${url}`))
}

beforeEach(() => {
  vi.clearAllMocks()
  serverConversations = seedConversations.map(cloneConversation)
  mockFetch.mockImplementation(defaultFetchHandler)

  mockLocalStorage.store.clear()
  mockLocalStorage.getItem.mockClear()
  mockLocalStorage.setItem.mockClear()
  mockLocalStorage.removeItem.mockClear()
  mockLocalStorage.clear.mockClear()

  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    configurable: true,
    writable: true,
  })

  resetConversationStore()
  console.log = vi.fn()
  console.warn = vi.fn()
  console.error = vi.fn()
})

afterEach(() => {
  delete (globalThis as any).localStorage
  delete (window as any).localStorage

  activeQueryClients.forEach((client) => client.clear())
  activeQueryClients.length = 0

  resetConversationStore()
  Object.assign(console, originalConsole)
})

describe('LocalStorage 工具行为', () => {
  test('set/get 当前对话 id', () => {
    const testId = 'conv-123'
    LocalStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, testId)

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'zhidian_current_conversation_id',
      JSON.stringify(testId),
    )

    const retrievedId = LocalStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, null)
    expect(retrievedId).toBe(testId)
  })

  test('set 时 localStorage 抛错不会中断', () => {
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new Error('localStorage not available')
    })

    expect(() => {
      LocalStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, 'test')
    }).not.toThrow()
  })

  test('remove 当前对话 id', () => {
    LocalStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, 'conv-123')
    LocalStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID)

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('zhidian_current_conversation_id')
  })
})

describe('useConversations 初始化', () => {
  test('从 localStorage 恢复当前对话', async () => {
    mockLocalStorage.store.set('zhidian_current_conversation_id', JSON.stringify('conv-2'))

    const { result } = renderUseConversations()
    await waitForConversationsReady(result)

    expect(result.current.currentConversationId).toBe('conv-2')
    expect(result.current.getCurrentConversation()?.title).toBe('测试对话2')
  })

  test('没有持久化记录时选择列表第一项', async () => {
    const { result } = renderUseConversations()
    await waitForConversationsReady(result)

    expect(result.current.currentConversationId).toBe('conv-1')
  })

  test('持久化 id 不存在时自动回退', async () => {
    mockLocalStorage.store.set('zhidian_current_conversation_id', JSON.stringify('conv-missing'))

    const { result } = renderUseConversations()
    await waitForConversationsReady(result)

    expect(result.current.currentConversationId).toBe('conv-1')
  })
})

describe('useConversations 操作', () => {
  test('setCurrentConversation 更新 localStorage', async () => {
    const { result } = renderUseConversations()
    await waitForConversationsReady(result)

    await act(async () => {
      await result.current.setCurrentConversation('conv-2')
    })

    await act(async () => {
      await waitFor(() => expect(result.current.currentConversationId).toBe('conv-2'))
    })

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'zhidian_current_conversation_id',
      JSON.stringify('conv-2'),
    )
  })

  test('deleteConversation 选择下一条并更新存储', async () => {
    mockLocalStorage.store.set('zhidian_current_conversation_id', JSON.stringify('conv-2'))

    const { result } = renderUseConversations()
    await waitForConversationsReady(result)

    await act(async () => {
      await result.current.deleteConversation('conv-2')
    })

    await act(async () => {
      await waitFor(() => expect(result.current.currentConversationId).toBe('conv-1'))
    })

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'zhidian_current_conversation_id',
      JSON.stringify('conv-1'),
    )
  })

  test('createConversation 新建后立即选中并持久化', async () => {
    const newConversation: ApiConversation = {
      id: 'conv-new',
      title: '新会话',
      modelId: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 2000,
      messageCount: 0,
      totalTokens: 0,
      createdAt: '2024-08-28T12:00:00Z',
      updatedAt: '2024-08-28T12:00:00Z',
      lastMessageAt: null,
      messages: [],
    }

    const newConversationResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: newConversation }),
    }

    const detailResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: newConversation }),
    }

    const { result } = renderUseConversations()
    await waitForConversationsReady(result)

    mockFetch.mockImplementationOnce(async (_url, init) => {
      expect(init?.method).toBe('POST')
      serverConversations = [cloneConversation(newConversation), ...serverConversations]
      return newConversationResponse
    })
    mockFetch.mockImplementationOnce(async () => detailResponse)

    await act(async () => {
      await result.current.createConversation('gpt-4o-mini')
    })

    await act(async () => {
      await waitFor(() => expect(result.current.currentConversationId).toBe('conv-new'))
    })

    expect(result.current.conversations.length).toBe(3)
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'zhidian_current_conversation_id',
      JSON.stringify('conv-new'),
    )
  })
})

describe('useConversations 错误处理', () => {
  test('API 失败时记录错误并保持空列表', async () => {
    mockFetch.mockImplementation(async () => ({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.resolve({ success: false }),
    }))

    const { result } = renderUseConversations()

    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 5000 })
    expect(result.current.conversations).toHaveLength(0)
  })

  test('localStorage.getItem 抛错时安全回退', async () => {
    mockLocalStorage.getItem.mockImplementationOnce(() => {
      throw new Error('localStorage not available')
    })

    const { result } = renderUseConversations()

    expect(result.current.currentConversationId).toBeNull()
    expect(result.current.loading).toBe(true)
  })
})
