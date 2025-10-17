import { describe, expect, it } from 'vitest'
import { chatReducer } from '@/components/chat/chat-reducer'
import { DEFAULT_CHAT_STATE } from '@/types/chat'
import type { ChatMessage } from '@/types/chat'

describe('Chat session status state machine', () => {
  it('runs through idle → preparing → requesting → streaming → done', () => {
    let state = DEFAULT_CHAT_STATE
    expect(state.session.status).toBe('idle')

    state = chatReducer(state, {
      type: 'SESSION_TRANSITION',
      payload: { status: 'preparing' }
    })
    expect(state.session.status).toBe('preparing')

    state = chatReducer(state, {
      type: 'SESSION_TRANSITION',
      payload: { status: 'requesting' }
    })
    expect(state.session.status).toBe('requesting')

    state = chatReducer(state, {
      type: 'SESSION_TRANSITION',
      payload: { status: 'streaming' }
    })
    expect(state.session.status).toBe('streaming')

    state = chatReducer(state, {
      type: 'SESSION_TRANSITION',
      payload: { status: 'done' }
    })
    expect(state.session.status).toBe('done')
    expect(state.session.error).toBeNull()
  })

  it('maps legacy SET_RESPONSE_PHASE action to new status values', () => {
    const phases: Array<{ legacy: 'queueing' | 'organizing' | 'requesting' | 'responding'; status: string }> = [
      { legacy: 'queueing', status: 'preparing' },
      { legacy: 'organizing', status: 'preparing' },
      { legacy: 'requesting', status: 'requesting' },
      { legacy: 'responding', status: 'streaming' }
    ]

    phases.forEach(({ legacy, status }) => {
      const state = chatReducer(DEFAULT_CHAT_STATE, {
        type: 'SET_RESPONSE_PHASE',
        payload: legacy
      })

      expect(state.session.status).toBe(status)
    })
  })

  it('handles legacy SET_LOADING toggle', () => {
    let state = chatReducer(DEFAULT_CHAT_STATE, {
      type: 'SET_LOADING',
      payload: true
    })

    expect(state.session.status).toBe('preparing')
    expect(state.session.error).toBeNull()

    state = chatReducer(state, {
      type: 'SET_LOADING',
      payload: false
    })

    expect(state.session.status).toBe('idle')
  })

  it('ADD_MESSAGE adds user message and moves session to requesting', () => {
    const userMessage: ChatMessage = {
      id: 'msg_1',
      role: 'user',
      content: 'hello',
      timestamp: Date.now(),
      status: 'completed'
    }

    // 先设置输入
    let state = chatReducer(DEFAULT_CHAT_STATE, { type: 'SET_INPUT', payload: 'hello' })

    // 添加用户消息
    state = chatReducer(state, {
      type: 'ADD_MESSAGE',
      payload: userMessage
    })

    // 清空输入框
    state = chatReducer(state, { type: 'SET_INPUT', payload: '' })

    // 转换会话状态
    state = chatReducer(state, {
      type: 'SESSION_TRANSITION',
      payload: { status: 'requesting' }
    })

    expect(state.history.messages).toHaveLength(1)
    expect(state.history.messages[0].id).toBe('msg_1')
    expect(state.composer.input).toBe('')
    expect(state.session.status).toBe('requesting')
  })

  it('SESSION_SET_ERROR moves status to error and clears when payload is null', () => {
    let state = chatReducer(DEFAULT_CHAT_STATE, {
      type: 'SESSION_SET_ERROR',
      payload: 'boom'
    })

    expect(state.session.status).toBe('error')
    expect(state.session.error).toBe('boom')

    state = chatReducer(state, {
      type: 'SESSION_SET_ERROR',
      payload: null
    })

    expect(state.session.status).toBe('idle')
    expect(state.session.error).toBeNull()
  })
})
