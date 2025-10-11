import { describe, expect, it, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockedToken = { sub: 'user-1' }

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(() => Promise.resolve(mockedToken))
}))

const merchantMock = {
  findUnique: vi.fn()
}

const creativeBatchMock = {
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn()
}

const merchantMemberMock = {
  findUnique: vi.fn(),
  create: vi.fn()
}

const merchantPromptAssetMock = {
  findMany: vi.fn(),
  findFirst: vi.fn()
}

const referenceAssetMock = {
  findMany: vi.fn()
}

const mockPrisma = {
  merchant: merchantMock,
  creativeBatch: creativeBatchMock,
  merchantMember: merchantMemberMock,
  merchantPromptAsset: merchantPromptAssetMock,
  referenceAsset: referenceAssetMock
} as unknown as typeof import('@/lib/prisma').prisma

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}))

const createBatchWithAssetsMock = vi.fn()

vi.mock('@/lib/repositories/creative-batch-repository', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/repositories/creative-batch-repository')
  >('@/lib/repositories/creative-batch-repository')

  return {
    ...actual,
    createBatchWithAssets: createBatchWithAssetsMock
  }
})

describe('Creative batch API tenant boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockedToken as any).sub = 'user-1'
    merchantMemberMock.findUnique.mockResolvedValue(null)
    creativeBatchMock.findFirst.mockResolvedValue(null)
    creativeBatchMock.findUnique.mockResolvedValue(null)
    merchantPromptAssetMock.findFirst.mockResolvedValue(null)
    referenceAssetMock.findMany.mockResolvedValue([])
    merchantMemberMock.create.mockResolvedValue({ id: 'mm-new' } as any)
  })

  it('filters list by current user and merchant', async () => {
    merchantMock.findUnique.mockResolvedValue({ id: 'merchant-1' })
    merchantMemberMock.findUnique.mockResolvedValue({ id: 'mm-1' })
    creativeBatchMock.findMany.mockResolvedValue([])
    creativeBatchMock.count.mockResolvedValue(0)

    const { GET } = await import('@/app/api/creative/batches/route')
    const request = new NextRequest(
      'http://localhost/api/creative/batches?merchantId=merchant-1'
    )

    const response = await GET(request)
    expect(response.status).toBe(200)
    expect(creativeBatchMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          merchantId: 'merchant-1'
        }
      })
    )
  })

  it('allows shared merchant access across different operators', async () => {
    merchantMock.findUnique.mockResolvedValue({ id: 'merchant-1' })
    merchantMemberMock.findUnique
      .mockResolvedValueOnce({ id: 'mm-user-1' })
      .mockResolvedValueOnce({ id: 'mm-user-2' })
    creativeBatchMock.findMany.mockResolvedValue([
      {
        id: 'batch-1',
        merchantId: 'merchant-1',
        parentBatchId: null,
        parent: null,
        status: 'SUCCEEDED',
        statusVersion: 2,
        modelId: 'claude-sonnet-4-5-20250929',
        triggeredBy: 'user-2',
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
        _count: { copies: 5, exceptions: 0 }
      }
    ])
    creativeBatchMock.count.mockResolvedValue(1)

    const { GET } = await import('@/app/api/creative/batches/route')
    const request = new NextRequest(
      'http://localhost/api/creative/batches?merchantId=merchant-1'
    )

    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data[0].triggeredBy).toBe('user-2')
  })

  it('returns 404 when accessing batch not owned by user', async () => {
    creativeBatchMock.findUnique.mockResolvedValueOnce({ merchantId: 'merchant-1' })
    merchantMemberMock.findUnique.mockResolvedValueOnce(null)

    const { GET } = await import('@/app/api/creative/batches/[batchId]/route')
    const request = new NextRequest(
      'http://localhost/api/creative/batches/batch-1'
    )

    const response = await GET(request, { params: { batchId: 'batch-1' } })
    expect(response.status).toBe(404)
  })

  it('rejects regenerate when parent batch belongs to another user', async () => {
    creativeBatchMock.findUnique.mockResolvedValueOnce({ merchantId: 'merchant-2' })
    merchantMemberMock.findUnique.mockResolvedValueOnce(null)

    const { POST } = await import(
      '@/app/api/creative/batches/[batchId]/regenerate/route'
    )
    const request = new NextRequest(
      'http://localhost/api/creative/batches/batch-2/regenerate'
    )

    const response = await POST(request, { params: { batchId: 'batch-2' } })
    expect(response.status).toBe(404)
    expect(createBatchWithAssetsMock).not.toHaveBeenCalled()
  })

  it('rejects parent batch from other user on create', async () => {
    merchantMock.findUnique.mockResolvedValue({ id: 'merchant-1' })
    merchantMemberMock.findUnique
      .mockResolvedValueOnce({ id: 'mm-1' }) // 当前商家可访问
      .mockResolvedValueOnce(null) // 父批次校验失败
    creativeBatchMock.findFirst.mockResolvedValue(null)

    const { POST } = await import('@/app/api/creative/batches/route')
    const request = new NextRequest('http://localhost/api/creative/batches', {
      method: 'POST',
      body: JSON.stringify({
        merchantId: 'merchant-1',
        parentBatchId: 'batch-foreign',
        assets: [
          { role: 'REPORT', assetId: 'report-1' },
          { role: 'PROMPT', assetId: 'prompt-1' }
        ]
      }),
      headers: {
        'content-type': 'application/json'
      }
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
    expect(createBatchWithAssetsMock).not.toHaveBeenCalled()
  })
})
