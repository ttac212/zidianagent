/**
 * 聊天 Hooks 重构测试
 * 验证拆分后的 Hook 功能正确性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChatScroll } from '../hooks/use-chat-scroll'
import { useChatKeyboard } from '../hooks/use-chat-keyboard'
import { useChatFocus } from '../hooks/use-chat-focus'
import { useChatEvents } from '../hooks/use-chat-events'
import { useDebounce, useThrottle, useDebouncedCallback } from '../hooks/use-debounce-throttle'

describe('聊天 Hooks 重构测试', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.restoreAllMocks()
  })

  describe('useChatScroll', () => {
    it('应该在新消息时自动滚动', async () => {
      const scrollToMock = vi.fn()
      const mockElement = {
        querySelector: vi.fn().mockReturnValue({
          scrollTo: scrollToMock,
          scrollHeight: 1000,
          clientHeight: 500,
          scrollTop: 0
        })
      }

      const { result, rerender } = renderHook(
        ({ messages }) => useChatScroll({ messages }),
        {
          initialProps: { messages: ['message1'] }
        }
      )

      // 设置 ref
      Object.defineProperty(result.current.scrollAreaRef, 'current', {
        value: mockElement,
        writable: true
      })

      // 添加新消息
      rerender({ messages: ['message1', 'message2'] })

      // 等待延迟滚动
      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(scrollToMock).toHaveBeenCalledWith({
        top: 1000,
        behavior: 'smooth'
      })
    })

    it('应该提供手动滚动功能', () => {
      const scrollToMock = vi.fn()
      const mockElement = {
        querySelector: vi.fn().mockReturnValue({
          scrollTo: scrollToMock,
          scrollHeight: 1000
        })
      }

      const { result } = renderHook(() => useChatScroll({ messages: [] }))

      Object.defineProperty(result.current.scrollAreaRef, 'current', {
        value: mockElement,
        writable: true
      })

      act(() => {
        result.current.scrollToBottom(false)
      })

      expect(scrollToMock).toHaveBeenCalledWith({
        top: 1000,
        behavior: 'auto'
      })
    })
  })

  describe('useChatKeyboard', () => {
    it('应该处理 Ctrl+Enter 发送消息', () => {
      const mockForm = {
        requestSubmit: vi.fn()
      }
      const mockTextarea = {
        closest: vi.fn().mockReturnValue(mockForm)
      }
      const textareaRef = { current: mockTextarea as any }

      const { result } = renderHook(() =>
        useChatKeyboard({
          state: { input: 'test message', isLoading: false } as any,
          textareaRef
        })
      )

      // 模拟 Ctrl+Enter
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(mockForm.requestSubmit).toHaveBeenCalled()
    })

    it('应该处理 Escape 停止生成', () => {
      const onStopGeneration = vi.fn()

      renderHook(() =>
        useChatKeyboard({
          state: { isLoading: true } as any,
          onStopGeneration
        })
      )

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      })

      act(() => {
        document.dispatchEvent(event)
      })

      expect(onStopGeneration).toHaveBeenCalled()
    })

    it('应该获取快捷键列表', () => {
      const { result } = renderHook(() =>
        useChatKeyboard({
          state: {} as any
        })
      )

      expect(result.current.shortcuts).toHaveLength(5)
      expect(result.current.shortcuts[0]).toMatchObject({
        key: 'Enter',
        ctrl: true,
        description: '发送消息'
      })
    })
  })

  describe('useChatFocus', () => {
    it('应该在加载完成后自动聚焦', async () => {
      const focusMock = vi.fn()
      const mockTextarea = {
        focus: focusMock,
        disabled: false
      }

      const { result, rerender } = renderHook(
        ({ isLoading }) => useChatFocus({ isLoading }),
        {
          initialProps: { isLoading: true }
        }
      )

      Object.defineProperty(result.current.textareaRef, 'current', {
        value: mockTextarea,
        writable: true
      })

      // 加载完成
      rerender({ isLoading: false })

      // 等待延迟聚焦
      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(focusMock).toHaveBeenCalled()
    })

    it('应该在页面可见时聚焦', () => {
      const focusMock = vi.fn()
      const mockTextarea = {
        focus: focusMock,
        disabled: false
      }

      const { result } = renderHook(() => useChatFocus())

      Object.defineProperty(result.current.textareaRef, 'current', {
        value: mockTextarea,
        writable: true
      })

      // 手动调用聚焦函数验证功能
      act(() => {
        result.current.focusInput()
      })

      expect(focusMock).toHaveBeenCalled()
    })
  })

  describe('useChatEvents', () => {
    it('应该处理模板注入事件', () => {
      const dispatch = vi.fn()
      const onFocusInput = vi.fn()

      renderHook(() =>
        useChatEvents({
          dispatch,
          onFocusInput
        })
      )

      const event = new CustomEvent('inject-chat-input', {
        detail: { content: 'template content' }
      })

      act(() => {
        window.dispatchEvent(event)
      })

      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_INPUT',
        payload: 'template content'
      })
      expect(onFocusInput).toHaveBeenCalled()
    })

    it('应该处理文本选择', () => {
      const onTextSelected = vi.fn()

      renderHook(() =>
        useChatEvents({
          dispatch: vi.fn(),
          onTextSelected
        })
      )

      // 模拟文本选择
      const mockSelection = {
        toString: () => '  selected text  '
      }
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any)

      const event = new MouseEvent('mouseup', { bubbles: true })
      act(() => {
        document.dispatchEvent(event)
      })

      expect(onTextSelected).toHaveBeenCalledWith('selected text')
    })

    it('应该能触发模板注入', () => {
      const dispatch = vi.fn()

      const { result } = renderHook(() =>
        useChatEvents({
          dispatch
        })
      )

      const listener = vi.fn()
      window.addEventListener('inject-chat-input', listener)

      act(() => {
        result.current.injectTemplate('injected content')
      })

      expect(listener).toHaveBeenCalled()

      window.removeEventListener('inject-chat-input', listener)
    })
  })

  describe('防抖节流工具', () => {
    it('useDebounce 应该延迟更新值', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        {
          initialProps: { value: 'initial' }
        }
      )

      expect(result.current).toBe('initial')

      // 更新值
      rerender({ value: 'updated' })
      expect(result.current).toBe('initial')

      // 等待防抖延迟
      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(result.current).toBe('updated')
    })

    it('useThrottle 应该限制执行频率', () => {
      const callback = vi.fn()
      const { result } = renderHook(() => useThrottle(callback, 500))

      // 第一次调用应该立即执行
      act(() => {
        result.current()
      })

      expect(callback).toHaveBeenCalledTimes(1)

      // 在节流期内的调用不会立即执行
      act(() => {
        result.current()
        result.current()
      })

      // 仍然只执行了一次
      expect(callback).toHaveBeenCalledTimes(1)

      // 等待节流时间
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // 节流期过后可以再次执行
      act(() => {
        result.current()
      })

      expect(callback).toHaveBeenCalledTimes(2)
    })

    it('useDebouncedCallback 应该能取消防抖', () => {
      const callback = vi.fn()
      const { result } = renderHook(() => useDebouncedCallback(callback, 500))

      const [debouncedFn, cancel] = result.current

      act(() => {
        debouncedFn()
      })

      // 取消防抖
      act(() => {
        cancel()
      })

      // 等待延迟
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // 不应该执行
      expect(callback).not.toHaveBeenCalled()
    })
  })
})