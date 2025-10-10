import { describe, expect, it } from 'vitest'
import { chatReducer } from '@/components/chat/chat-reducer'
import { DEFAULT_CHAT_STATE } from '@/types/chat'
import type { ChatMessage } from '@/types/chat'

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

    const state = {
      ...DEFAULT_CHAT_STATE,
      messages: baseMessages
    }

    const nextState = chatReducer(state, {
      type: 'PREPEND_MESSAGES',
      payload: olderMessages
    })

    expect(nextState.messages.map(msg => msg.id)).toEqual(['m0', 'm1', 'm2', 'm3'])
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

    const state = {
      ...DEFAULT_CHAT_STATE,
      messages: baseMessages
    }

    const nextState = chatReducer(state, {
      type: 'PREPEND_MESSAGES',
      payload: duplicateMessages
    })

    expect(nextState.messages).toHaveLength(baseMessages.length)
    expect(nextState.messages[0].id).toBe('m2')
  })
})
