import { describe, expect, it } from 'vitest'
import { transformApiConversation } from '@/hooks/api/use-conversations-query'

describe('transformApiConversation', () => {
  const baseTimestamp = new Date().toISOString()

  const basePayload = {
    id: 'conv_123',
    title: '测试对话',
    modelId: 'gpt-3.5-turbo',
    createdAt: baseTimestamp,
    updatedAt: baseTimestamp,
    messageCount: 2,
    totalTokens: 42,
    metadata: {
      tags: ['pinned']
    },
    messages: [],
    lastMessage: null
  }

  it('should throw when updatedAt is missing', () => {
    const invalidPayload: any = { ...basePayload }
    delete invalidPayload.updatedAt

    expect(() => transformApiConversation(invalidPayload)).toThrowError(/updatedAt/)
  })

  it('should transform payload with all required fields', () => {
    const result = transformApiConversation(basePayload)

    expect(result.id).toBe(basePayload.id)
    expect(result.title).toBe(basePayload.title)
    expect(result.updatedAt).toBeTypeOf('number')
    expect(result.metadata?.messageCount).toBe(basePayload.messageCount)
  })
})
