import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import * as nextAuthJwt from 'next-auth/jwt'
import * as rateLimiter from '@/lib/security/rate-limiter'
import { prisma } from '@/lib/prisma'
import { transformApiConversation } from '@/hooks/api/use-conversations-query'

describe('GET /api/conversations integration contract', () => {
  const userId = 'user-test'
  const now = new Date('2024-01-02T10:00:00.000Z')
  const earlier = new Date('2024-01-01T08:30:00.000Z')

  let getTokenSpy: ReturnType<typeof vi.spyOn>
  let rateLimitSpy: ReturnType<typeof vi.spyOn>
  let findManySpy: ReturnType<typeof vi.spyOn>
  let countSpy: ReturnType<typeof vi.spyOn>
  let capturedSelect: any

  beforeEach(() => {
    getTokenSpy = vi
      .spyOn(nextAuthJwt, 'getToken')
      .mockResolvedValue({ sub: userId } as any) as ReturnType<typeof vi.spyOn>
    rateLimitSpy = vi
      .spyOn(rateLimiter, 'checkRateLimit')
      .mockResolvedValue({ allowed: true, remaining: 10, resetTime: Date.now() + 60000 }) as ReturnType<
      typeof vi.spyOn
    >

    capturedSelect = undefined
    findManySpy = vi.spyOn(prisma.conversation, 'findMany').mockImplementation((args: any) => {
      capturedSelect = args?.select
      const result = [
        {
          id: 'conv-latest',
          title: '最新对话',
          modelId: 'gpt-4.1-mini',
          temperature: 0.6,
          maxTokens: 4096,
          contextAware: true,
          messageCount: 3,
          totalTokens: 1200,
          metadata: { tags: ['pinned'] },
          createdAt: earlier,
          updatedAt: now,
          lastMessageAt: now,
          messages: [
            {
              id: 'msg-last',
              role: 'assistant',
              content: 'hello world',
              createdAt: now
            }
          ]
        },
        {
          id: 'conv-old',
          title: '旧对话',
          modelId: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 2000,
          contextAware: false,
          messageCount: 1,
          totalTokens: 300,
          metadata: {},
          createdAt: earlier,
          updatedAt: earlier,
          lastMessageAt: earlier,
          messages: []
        }
      ] as any

      const prismaPromise = Promise.resolve(result) as unknown as Prisma.PrismaPromise<typeof result>
      Object.defineProperty(prismaPromise, Symbol.toStringTag, { value: 'PrismaPromise' })
      return prismaPromise
    }) as ReturnType<typeof vi.spyOn>

    countSpy = vi.spyOn(prisma.conversation, 'count').mockResolvedValue(2) as ReturnType<typeof vi.spyOn>
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns required columns for downstream transformers', async () => {
    const { GET } = await import('@/app/api/conversations/route')

    const request = {
      url: 'http://localhost/api/conversations?page=1&limit=10',
      headers: new Headers(),
      method: 'GET'
    } as any

    const response = await GET(request)
    const payload = await response.json()

    expect(getTokenSpy).toHaveBeenCalledOnce()
    expect(rateLimitSpy).toHaveBeenCalledOnce()
    expect(findManySpy).toHaveBeenCalledOnce()
    expect(countSpy).toHaveBeenCalledOnce()

    expect(capturedSelect?.updatedAt).toBe(true)
    expect(capturedSelect?.temperature).toBe(true)
    expect(capturedSelect?.maxTokens).toBe(true)
    expect(capturedSelect?.contextAware).toBe(true)

    const conversations = payload.data.conversations
    expect(Array.isArray(conversations)).toBe(true)
    expect(conversations[0]).toHaveProperty('updatedAt')
    expect(conversations[0]).toHaveProperty('temperature')
    expect(conversations[0]).toHaveProperty('contextAware')

    const transformed = transformApiConversation(conversations[0])
    expect(transformed.updatedAt).toBeGreaterThan(0)
    expect(transformed.metadata?.messageCount).toBe(3)
  })
})
