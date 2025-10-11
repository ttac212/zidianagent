import { describe, expect, it, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockedToken = { sub: 'user-1', role: 'ADMIN' }

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(() => Promise.resolve(mockedToken))
}))

const creativeCopyMock = {
  findUnique: vi.fn()
}

const creativeBatchMock = {
  findUnique: vi.fn()
}

const mockPrisma = {
  creativeCopy: creativeCopyMock,
  creativeBatch: creativeBatchMock
} as unknown as typeof import('@/lib/prisma').prisma

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}))

const hasMerchantAccessMock = vi.fn(() => Promise.resolve(true))

vi.mock('@/lib/auth/merchant-access', () => ({
  hasMerchantAccess: hasMerchantAccessMock
}))

const createBatchWithAssetsMock = vi.fn(() =>
  Promise.resolve({
    batch: {
      id: 'new-batch-id',
      parentBatchId: 'origin-batch-id',
      status: 'QUEUED',
      statusVersion: 1,
      createdAt: new Date('2025-01-15T00:00:00.000Z')
    }
  })
)

vi.mock('@/lib/repositories/creative-batch-repository', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/repositories/creative-batch-repository')
  >('@/lib/repositories/creative-batch-repository')

  return {
    ...actual,
    createBatchWithAssets: createBatchWithAssetsMock
  }
})

describe('POST /api/creative/copies/[copyId]/route.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    creativeCopyMock.findUnique.mockResolvedValue({
      id: 'copy-1',
      batchId: 'origin-batch-id',
      sequence: 3,
      markdownContent: '原始文案内容',
      rawModelOutput: { originalSequence: 3 },
      batch: {
        merchantId: 'merchant-1',
        assets: [
          {
            role: 'REPORT',
            promptAssetId: 'prompt-report-1',
            referenceAssetId: null,
            isEnabled: true,
            sortOrder: 1
          },
          {
            role: 'PROMPT',
            promptAssetId: 'prompt-template-1',
            referenceAssetId: null,
            isEnabled: true,
            sortOrder: 2
          }
        ]
      }
    })
  })

  it('creates a regeneration batch with targetSequence metadata', async () => {
    const { POST } = await import('@/app/api/creative/copies/[copyId]/route')

    const request = new NextRequest(
      'http://localhost/api/creative/copies/copy-1',
      {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ appendPrompt: '增加数据要点' })
      }
    )

    const response = await POST(request, { params: { copyId: 'copy-1' } })

    expect(response.status).toBe(201)
    expect(createBatchWithAssetsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          targetSequence: 3,
          appendPrompt: '增加数据要点',
          parentCopyId: 'copy-1'
        })
      })
    )

    const json = await response.json()
    expect(json.targetSequence).toBe(3)
    expect(json.appendPrompt).toBe('增加数据要点')
  })

  it('passes edited content flag when provided', async () => {
    const { POST } = await import('@/app/api/creative/copies/[copyId]/route')

    const payload = {
      editedContent: '用户改写后的文案',
      note: '需要突出卖点'
    }

    const request = new NextRequest(
      'http://localhost/api/creative/copies/copy-1',
      {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      }
    )

    const response = await POST(request, { params: { copyId: 'copy-1' } })

    expect(response.status).toBe(201)
    expect(createBatchWithAssetsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          editedContentProvided: true,
          editedContent: '用户改写后的文案'
        })
      })
    )

    const json = await response.json()
    expect(json.targetSequence).toBe(3)
    expect(json.appendPrompt).toBeNull()
  })
})
