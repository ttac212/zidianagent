import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockedToken = { sub: 'user-1', role: 'USER' }

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(() => Promise.resolve(mockedToken))
}))

const copyFindUniqueMock = vi.fn()
const copyUpdateMock = vi.fn()
const copyCreateMock = vi.fn()
const revisionCreateMock = vi.fn()
const batchFindUniqueMock = vi.fn()
const batchFindFirstMock = vi.fn()
const transactionMock = vi.fn()
const merchantMemberFindUniqueMock = vi.fn()
const merchantMemberCreateMock = vi.fn()
const merchantPromptAssetFindFirstMock = vi.fn()
const referenceAssetFindManyMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creativeCopy: {
      findUnique: copyFindUniqueMock,
      update: copyUpdateMock,
      create: copyCreateMock
    },
    creativeCopyRevision: {
      create: revisionCreateMock
    },
    creativeBatch: {
      findUnique: batchFindUniqueMock,
      findFirst: batchFindFirstMock
    },
    merchantMember: {
      findUnique: merchantMemberFindUniqueMock,
      create: merchantMemberCreateMock
    },
    merchantPromptAsset: {
      findFirst: merchantPromptAssetFindFirstMock
    },
    referenceAsset: {
      findMany: referenceAssetFindManyMock
    },
    $transaction: transactionMock
  }
}))

const hasMerchantAccessMock = vi.fn()
vi.mock('@/lib/auth/merchant-access', () => ({
  hasMerchantAccess: hasMerchantAccessMock
}))

const createBatchWithAssetsMock = vi.fn()
vi.mock('@/lib/repositories/creative-batch-repository', async () => {
  const actual = await vi.importActual(
    '@/lib/repositories/creative-batch-repository'
  )
  return {
    ...actual,
    createBatchWithAssets: createBatchWithAssetsMock
  }
})

describe('Creative copy API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasMerchantAccessMock.mockResolvedValue(true)
    batchFindFirstMock.mockResolvedValue(null)
    merchantPromptAssetFindFirstMock.mockResolvedValue(null)
    referenceAssetFindManyMock.mockResolvedValue([])
    merchantMemberFindUniqueMock.mockResolvedValue(null)
    merchantMemberCreateMock.mockResolvedValue({ id: 'mm-new' })
    transactionMock.mockImplementation(async (fn: any) =>
      fn({
        creativeCopy: { update: copyUpdateMock },
        creativeCopyRevision: { create: revisionCreateMock }
      })
    )
  })

  it('returns copy detail when user has access', async () => {
    copyFindUniqueMock
      .mockResolvedValueOnce({
        batch: { merchantId: 'merchant-1' }
      })
      .mockResolvedValueOnce({
        id: 'copy-1',
        batchId: 'batch-1',
        sequence: 1,
        state: 'DRAFT',
        markdownContent: 'content',
        userOverride: null,
        rawModelOutput: null,
        contentVersion: 1,
        regeneratedFromId: null,
        editedBy: null,
        editedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        batch: { id: 'batch-1', merchantId: 'merchant-1', status: 'SUCCEEDED' },
        revisions: []
      })

    const { GET } = await import('@/app/api/creative/copies/[copyId]/route')
    const response = await GET(
      new NextRequest('http://localhost/api/creative/copies/copy-1'),
      { params: { copyId: 'copy-1' } }
    )

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.id).toBe('copy-1')
  })

  it('updates copy content and state via PUT', async () => {
    const now = new Date()
    copyFindUniqueMock.mockResolvedValueOnce({
      id: 'copy-1',
      batchId: 'batch-1',
      contentVersion: 1,
      batch: { merchantId: 'merchant-1' }
    })
    copyUpdateMock.mockResolvedValue({
      id: 'copy-1',
      batchId: 'batch-1',
      sequence: 1,
      state: 'APPROVED',
      markdownContent: 'old',
      userOverride: 'new content',
      contentVersion: 2,
      editedBy: 'user-1',
      editedAt: now,
      updatedAt: now
    })

    const { PUT } = await import('@/app/api/creative/copies/[copyId]/route')
    const request = new NextRequest('http://localhost/api/creative/copies/c1', {
      method: 'PUT',
      body: JSON.stringify({ content: 'new content', state: 'APPROVED' }),
      headers: { 'content-type': 'application/json' }
    })

    const response = await PUT(request, { params: { copyId: 'copy-1' } })
    expect(response.status).toBe(200)
    expect(copyUpdateMock).toHaveBeenCalled()
    expect(revisionCreateMock).toHaveBeenCalled()
  })

  it('denies access when user lacks membership', async () => {
    hasMerchantAccessMock.mockResolvedValueOnce(false)
    copyFindUniqueMock.mockResolvedValueOnce({
      batch: { merchantId: 'merchant-1' }
    })

    const { GET } = await import('@/app/api/creative/copies/[copyId]/route')
    const response = await GET(
      new NextRequest('http://localhost/api/creative/copies/copy-1'),
      { params: { copyId: 'copy-1' } }
    )

    expect(response.status).toBe(404)
  })

  it('creates new batch on single copy regenerate', async () => {
    copyFindUniqueMock.mockResolvedValueOnce({
      id: 'copy-1',
      batchId: 'batch-1',
      sequence: 1,
      markdownContent: 'old',
      contentVersion: 1,
      rawModelOutput: null,
      batch: {
        merchantId: 'merchant-1',
        assets: [
          {
            role: 'REPORT',
            promptAssetId: 'report-1',
            referenceAssetId: null,
            isEnabled: true,
            sortOrder: 0
          },
          {
            role: 'PROMPT',
            promptAssetId: 'prompt-1',
            referenceAssetId: null,
            isEnabled: true,
            sortOrder: 1
          }
        ]
      }
    })

    createBatchWithAssetsMock.mockResolvedValue({
      batch: { id: 'batch-new', parentBatchId: 'batch-1' }
    })

    copyCreateMock.mockResolvedValue({
      id: 'copy-new',
      batchId: 'batch-new',
      sequence: 1,
      state: 'DRAFT',
      markdownContent: 'old',
      userOverride: null,
      rawModelOutput: null,
      contentVersion: 1,
      regeneratedFromId: 'copy-1',
      editedBy: null,
      editedAt: null,
      createdAt: new Date()
    })

    const { POST } = await import('@/app/api/creative/copies/[copyId]/route')
    const request = new NextRequest('http://localhost/api/creative/copies/c1', {
      method: 'POST',
      body: JSON.stringify({ appendPrompt: 'more', editedContent: 'draft' }),
      headers: { 'content-type': 'application/json' }
    })

    const response = await POST(request, { params: { copyId: 'copy-1' } })
    expect(response.status).toBe(201)
    expect(createBatchWithAssetsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          appendPrompt: 'more',
          parentCopyId: 'copy-1'
        })
      })
    )
    
    // Linus: Worker创建copy，不是API。测试不应该验证立即插入
    // expect(copyCreateMock).toHaveBeenCalled()  // ❌ 错误的假设
  })
})
