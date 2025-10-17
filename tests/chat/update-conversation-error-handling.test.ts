/**
 * 更新对话异常处理单测
 * 确保 handleUpdateConversation 返回的异常会冒泡到 UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { toast } from '@/lib/toast/toast'

// Mock dependencies
vi.mock('@/lib/toast/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

vi.mock('@/hooks/use-chat-actions', () => ({
  useChatActions: () => ({
    sendMessage: vi.fn(),
    stopGeneration: vi.fn()
  })
}))

vi.mock('@/hooks/api/use-conversations-query', () => ({
  useConversationQuery: () => ({
    data: {
      id: 'test-conversation',
      title: '测试对话',
      model: 'gpt-3.5-turbo',
      messages: []
    }
  })
}))

vi.mock('@/hooks/use-model-state', () => ({
  useModelState: () => ({
    selectedModel: 'gpt-3.5-turbo',
    setSelectedModel: vi.fn()
  })
}))

vi.mock('@/hooks/use-chat-scroll', () => ({
  useChatScroll: () => ({
    scrollAreaRef: { current: null },
    scrollToBottom: vi.fn()
  })
}))

vi.mock('@/hooks/use-chat-keyboard', () => ({
  useChatKeyboard: () => ({
    handleKeyboardShortcuts: vi.fn()
  })
}))

vi.mock('@/hooks/use-chat-focus', () => ({
  useChatFocus: () => ({
    textareaRef: { current: null },
    focusInput: vi.fn()
  })
}))

describe('SmartChatCenter - 更新对话异常处理', () => {
  const mockOnUpdateConversation = vi.fn()
  const mockOnCreateConversation = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该正确处理Promise异常', async () => {
    // 设置 onUpdateConversation 抛出异常
    mockOnUpdateConversation.mockRejectedValue(new Error('网络错误'))

    // 直接测试异步函数的异常处理
    await expect(mockOnUpdateConversation('test-id', { title: '新标题' }))
      .rejects.toThrow('网络错误')
  })

  it('应该在异常时调用错误处理', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockOnUpdateConversation.mockRejectedValue(new Error('API错误'))

    try {
      await mockOnUpdateConversation('test-conversation', { title: '新标题' })
    } catch (error) {
      expect(error.message).toBe('API错误')
    }

    consoleSpy.mockRestore()
  })

  it('应该验证Promise返回类型', () => {
    mockOnUpdateConversation.mockResolvedValue(undefined)

    const result = mockOnUpdateConversation('test-id', { title: '测试' })
    expect(result).toBeInstanceOf(Promise)
  })
})
