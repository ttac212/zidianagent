import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const merchantFindMany = vi.fn()
  const merchantCount = vi.fn()

  return {
    prisma: {
      merchant: {
        findMany: merchantFindMany,
        count: merchantCount,
      },
    },
  }
})

global.fetch = vi.fn()

import { GET } from '@/app/api/merchants/route'
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'

describe('GET /api/merchants - 排序逻辑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getToken).mockResolvedValue({ sub: 'test-user' } as any)
  })

  it('当 sortBy=totalEngagement 时应按 totalEngagement 排序并返回该字段', async () => {
    const mockMerchants = [
      {
        id: 'm-1',
        uid: 'uid-1',
        name: '商家A',
        description: null,
        location: '北京',
        businessType: 'B2C',
        status: 'ACTIVE',
        totalContentCount: 10,
        totalDiggCount: 100,
        totalCommentCount: 50,
        totalCollectCount: 20,
        totalShareCount: 10,
        totalEngagement: 180,
        lastCollectedAt: new Date('2024-01-01T00:00:00Z'),
        createdAt: new Date('2023-12-01T00:00:00Z'),
        category: null,
      },
      {
        id: 'm-2',
        uid: 'uid-2',
        name: '商家B',
        description: null,
        location: '上海',
        businessType: 'B2B',
        status: 'ACTIVE',
        totalContentCount: 5,
        totalDiggCount: 300,
        totalCommentCount: 200,
        totalCollectCount: 100,
        totalShareCount: 50,
        totalEngagement: 650,
        lastCollectedAt: new Date('2024-01-02T00:00:00Z'),
        createdAt: new Date('2023-11-01T00:00:00Z'),
        category: {
          id: 'cat-1',
          name: '分类',
          color: '#000',
          icon: null,
        },
      },
    ]

    vi.mocked(prisma.merchant.findMany).mockResolvedValue(mockMerchants as any)
    vi.mocked(prisma.merchant.count).mockResolvedValue(mockMerchants.length)

    const request = new NextRequest('http://localhost/api/merchants?sortBy=totalEngagement&sortOrder=desc')
    const response = await GET(request)

    expect(prisma.merchant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { totalEngagement: 'desc' },
      })
    )

    const payload = await response.json()

    expect(payload.merchants).toHaveLength(2)
    expect(payload.merchants[0].totalEngagement).toBe(mockMerchants[0].totalEngagement)
    expect(payload.merchants[1].totalEngagement).toBe(mockMerchants[1].totalEngagement)
  })
})
