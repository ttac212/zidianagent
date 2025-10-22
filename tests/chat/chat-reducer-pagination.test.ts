import { describe, expect, it } from 'vitest'
import { chatReducer } from '@/components/chat/chat-reducer'
import { DEFAULT_CHAT_STATE } from '@/types/chat'
import type { ChatMessage, ChatState } from '@/types/chat'

function createState(overrides?: Partial<ChatState>): ChatState {
  const base: ChatState = {
    session: {
      ...DEFAULT_CHAT_STATE.session,
      sync: { ...DEFAULT_CHAT_STATE.session.sync }
    },
    history: {
      messages: [...DEFAULT_CHAT_STATE.history.messages],
      pagination: {
        hasMoreBefore: DEFAULT_CHAT_STATE.history.pagination.hasMoreBefore,
        cursor: DEFAULT_CHAT_STATE.history.pagination.cursor
          ? { ...DEFAULT_CHAT_STATE.history.pagination.cursor }
          : null
      }
    },
    composer: {
      ...DEFAULT_CHAT_STATE.composer,
      settings: { ...DEFAULT_CHAT_STATE.composer.settings }
    }
  }

  if (!overrides) {
    return base
  }

  if (overrides.session) {
    base.session = {
      ...base.session,
      ...overrides.session,
      sync: overrides.session.sync
        ? { ...base.session.sync, ...overrides.session.sync }
        : base.session.sync
    }
  }

  if (overrides.history) {
    base.history = {
      ...base.history,
      ...overrides.history,
      messages: overrides.history.messages
        ? overrides.history.messages.slice()
        : base.history.messages,
      pagination: overrides.history.pagination
        ? {
            hasMoreBefore: overrides.history.pagination.hasMoreBefore,
            cursor: overrides.history.pagination.cursor
              ? { ...overrides.history.pagination.cursor }
              : null
          }
        : base.history.pagination
    }
  }

  if (overrides.composer) {
    base.composer = {
      ...base.composer,
      ...overrides.composer,
      settings: overrides.composer.settings
        ? { ...base.composer.settings, ...overrides.composer.settings }
        : base.composer.settings
    }
  }

  return base
}

const baseMessages: ChatMessage[] = [
  {
    id: 'm2',
    role: 'assistant',
    content: 'existing reply',
    timestamp: 2,
    status: 'completed'
  },
  {
    id: 'm3',
    role: 'assistant',
    content: 'latest reply',
    timestamp: 3,
    status: 'completed'
  }
]

describe('chatReducer PREPEND_MESSAGES', () => {
  it('prepends new older messages ahead of existing ones', () => {
    const olderMessages: ChatMessage[] = [
      {
        id: 'm0',
        role: 'user',
        content: 'first question',
        timestamp: 0,
        status: 'completed'
      },
      {
        id: 'm1',
        role: 'assistant',
        content: 'first answer',
        timestamp: 1,
        status: 'completed'
      }
    ]

    const state = createState({
      history: {
        messages: baseMessages.slice(),
        pagination: {
          hasMoreBefore: DEFAULT_CHAT_STATE.history.pagination.hasMoreBefore,
          cursor: DEFAULT_CHAT_STATE.history.pagination.cursor
            ? { ...DEFAULT_CHAT_STATE.history.pagination.cursor }
            : null
        }
      }
    })

    const nextState = chatReducer(state, {
      type: 'PREPEND_MESSAGES',
      payload: olderMessages
    })

    expect(nextState.history.messages.map(msg => msg.id)).toEqual(['m0', 'm1', 'm2', 'm3'])
  })

  it('ignores duplicate messages when prepending', () => {
    const duplicateMessages: ChatMessage[] = [
      {
        id: 'm2',
        role: 'assistant',
        content: 'should be ignored duplicate',
        timestamp: 2,
        status: 'completed'
      }
    ]

    const state = createState({
      history: {
        messages: baseMessages.slice(),
        pagination: {
          hasMoreBefore: DEFAULT_CHAT_STATE.history.pagination.hasMoreBefore,
          cursor: DEFAULT_CHAT_STATE.history.pagination.cursor
            ? { ...DEFAULT_CHAT_STATE.history.pagination.cursor }
            : null
        }
      }
    })

    const nextState = chatReducer(state, {
      type: 'PREPEND_MESSAGES',
      payload: duplicateMessages
    })

    expect(nextState.history.messages).toHaveLength(baseMessages.length)
    expect(nextState.history.messages[0].id).toBe('m2')
  })
})

describe('chatReducer ADD_MESSAGE 去重机制', () => {
  it('[P0回归] 重复ADD同ID消息应该替换而不是追加', () => {
    const initialMessage: ChatMessage = {
      id: 'pending_douyin_123',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'pending',
      metadata: {
        douyinProgress: {
          steps: [],
          percentage: 0,
          status: 'running',
          updatedAt: Date.now()
        }
      }
    }

    // 第一次 ADD
    let state = chatReducer(DEFAULT_CHAT_STATE, {
      type: 'ADD_MESSAGE',
      payload: initialMessage
    })

    expect(state.history.messages).toHaveLength(1)
    expect(state.history.messages[0].id).toBe('pending_douyin_123')
    expect(state.history.messages[0].status).toBe('pending')

    // 第二次 ADD 同ID，但状态更新
    const updatedMessage: ChatMessage = {
      ...initialMessage,
      status: 'streaming',
      metadata: {
        douyinProgress: {
          steps: [],
          percentage: 50,
          status: 'running',
          updatedAt: Date.now()
        }
      }
    }

    state = chatReducer(state, {
      type: 'ADD_MESSAGE',
      payload: updatedMessage
    })

    // 关键验证：长度保持1，没有重复
    expect(state.history.messages).toHaveLength(1)
    expect(state.history.messages[0].id).toBe('pending_douyin_123')
    expect(state.history.messages[0].status).toBe('streaming')
    expect(state.history.messages[0].metadata?.douyinProgress?.percentage).toBe(50)
  })

  it('[P0回归] 不同ID的消息应该正常追加', () => {
    const message1: ChatMessage = {
      id: 'msg1',
      role: 'user',
      content: 'test 1',
      timestamp: Date.now(),
      status: 'completed'
    }

    const message2: ChatMessage = {
      id: 'msg2',
      role: 'assistant',
      content: 'response 1',
      timestamp: Date.now(),
      status: 'completed'
    }

    let state = chatReducer(DEFAULT_CHAT_STATE, {
      type: 'ADD_MESSAGE',
      payload: message1
    })

    state = chatReducer(state, {
      type: 'ADD_MESSAGE',
      payload: message2
    })

    // 验证：两个不同ID正常追加
    expect(state.history.messages).toHaveLength(2)
    expect(state.history.messages.map(m => m.id)).toEqual(['msg1', 'msg2'])
  })

  it('[P0回归] 模拟抖音流程多次触发ADD场景', () => {
    // 模拟前端因事件重复触发导致多次dispatch ADD_MESSAGE
    const douyinPendingMsg: ChatMessage = {
      id: 'pending_douyin_video_abc',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'pending'
    }

    // 第一次dispatch
    let state = chatReducer(DEFAULT_CHAT_STATE, {
      type: 'ADD_MESSAGE',
      payload: douyinPendingMsg
    })

    // 意外的第二次dispatch（重复事件）
    state = chatReducer(state, {
      type: 'ADD_MESSAGE',
      payload: douyinPendingMsg
    })

    // 第三次（再次重复）
    state = chatReducer(state, {
      type: 'ADD_MESSAGE',
      payload: douyinPendingMsg
    })

    // 验证：即使ADD了3次，数组中只有1个消息
    expect(state.history.messages).toHaveLength(1)
    expect(state.history.messages[0].id).toBe('pending_douyin_video_abc')

    // React渲染不会因为重复key而爆炸
    const messageIds = state.history.messages.map(m => m.id)
    const uniqueIds = new Set(messageIds)
    expect(messageIds.length).toBe(uniqueIds.size) // 无重复key
  })
})
