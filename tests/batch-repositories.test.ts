import { describe, expect, beforeEach, it, vi } from 'vitest'
import {
  CreativeAssetRole,
  CreativeBatchStatus,
  Prisma,
  PromptAssetType
} from '@prisma/client'

const merchantPromptAssetMock = {
  findFirst: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn()
}

const creativeBatchMock = {
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn()
}

const creativeBatchAssetMock = {
  createMany: vi.fn()
}

const mockPrisma = {
  $transaction: vi.fn(),
  merchantPromptAsset: merchantPromptAssetMock,
  creativeBatch: creativeBatchMock,
  creativeBatchAsset: creativeBatchAssetMock
} as unknown as {
  $transaction: ReturnType<typeof vi.fn>
  merchantPromptAsset: typeof merchantPromptAssetMock
  creativeBatch: typeof creativeBatchMock
  creativeBatchAsset: typeof creativeBatchAssetMock
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}))

const { createPromptAssetVersion } = await import(
  '@/lib/repositories/prompt-asset-repository'
)
const { createBatchWithAssets, updateBatchStatus } = await import(
  '@/lib/repositories/creative-batch-repository'
)

describe('Batch repositories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retries prompt asset creation when hitting unique constraint', async () => {
    merchantPromptAssetMock.findFirst.mockResolvedValue({ version: 41 })

    const uniqueError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test'
      }
    )

    merchantPromptAssetMock.create
      .mockRejectedValueOnce(uniqueError)
      .mockResolvedValueOnce({
        id: 'asset-42',
        merchantId: 'merchant-1',
        type: PromptAssetType.REPORT,
        version: 42
      })

    merchantPromptAssetMock.updateMany.mockResolvedValue({ count: 1 })
    merchantPromptAssetMock.update.mockResolvedValue({})

    mockPrisma.$transaction.mockImplementation(async fn => {
      return fn({
        merchantPromptAsset: merchantPromptAssetMock
      } as any)
    })

    const asset = await createPromptAssetVersion({
      merchantId: 'merchant-1',
      type: PromptAssetType.REPORT,
      title: '测试报告',
      content: '报告正文',
      createdBy: 'user-1',
      activate: true
    })

    expect(asset.version).toBe(42)
    expect(merchantPromptAssetMock.create).toHaveBeenCalledTimes(2)
    expect(merchantPromptAssetMock.updateMany).toHaveBeenCalledTimes(1)
    expect(merchantPromptAssetMock.update).toHaveBeenCalledTimes(1)
  })

  it('creates batch with normalized assets in a transaction', async () => {
    creativeBatchMock.create.mockResolvedValue({
      id: 'batch-1',
      merchantId: 'merchant-1'
    } as any)
    creativeBatchAssetMock.createMany.mockResolvedValue({ count: 3 })
    creativeBatchMock.findUnique.mockResolvedValue(undefined)

    mockPrisma.$transaction.mockImplementation(async fn => {
      return fn({
        creativeBatch: creativeBatchMock,
        creativeBatchAsset: creativeBatchAssetMock
      } as any)
    })

    const { batch, parentBatch } = await createBatchWithAssets({
      merchantId: 'merchant-1',
      triggeredBy: 'user-1',
      assets: [
        { role: CreativeAssetRole.REPORT, assetId: 'report-1' },
        { role: CreativeAssetRole.PROMPT, assetId: 'prompt-2' },
        {
          role: CreativeAssetRole.ATTACHMENT,
          assetId: 'ref-3',
          enabled: false,
          sortOrder: 2
        }
      ]
    })

    expect(batch.id).toBe('batch-1')
    expect(parentBatch).toBeUndefined()
    expect(creativeBatchMock.create).toHaveBeenCalledWith({
      data: {
        merchantId: 'merchant-1',
        parentBatchId: null,
        triggeredBy: 'user-1',
        modelId: undefined,
        status: CreativeBatchStatus.QUEUED
      }
    })

    expect(creativeBatchAssetMock.createMany).toHaveBeenCalledWith({
      data: [
        {
          batchId: 'batch-1',
          role: CreativeAssetRole.REPORT,
          promptAssetId: 'report-1',
          referenceAssetId: null,
          isEnabled: true,
          sortOrder: 0
        },
        {
          batchId: 'batch-1',
          role: CreativeAssetRole.PROMPT,
          promptAssetId: 'prompt-2',
          referenceAssetId: null,
          isEnabled: true,
          sortOrder: 1
        },
        {
          batchId: 'batch-1',
          role: CreativeAssetRole.ATTACHMENT,
          promptAssetId: null,
          referenceAssetId: 'ref-3',
          isEnabled: false,
          sortOrder: 2
        }
      ]
    })
  })

  it('rejects when parent batch belongs to another merchant', async () => {
    creativeBatchMock.findUnique.mockResolvedValue({
      id: 'parent-1',
      merchantId: 'other-merchant',
      parentBatchId: null,
      status: CreativeBatchStatus.SUCCEEDED
    })

    mockPrisma.$transaction.mockImplementation(async fn => {
      return fn({
        creativeBatch: creativeBatchMock,
        creativeBatchAsset: creativeBatchAssetMock
      } as any)
    })

    await expect(
      createBatchWithAssets({
        merchantId: 'merchant-1',
        triggeredBy: 'user-1',
        parentBatchId: 'parent-1',
        assets: [
          { role: CreativeAssetRole.REPORT, assetId: 'report-1' },
          { role: CreativeAssetRole.PROMPT, assetId: 'prompt-2' }
        ]
      })
    ).rejects.toThrow('Parent batch parent-1 does not belong to merchant merchant-1')
  })

  it('updates batch status with version increment and nullable fields', async () => {
    creativeBatchMock.update.mockResolvedValue({
      id: 'batch-1',
      statusVersion: 2
    } as any)

    await updateBatchStatus({
      batchId: 'batch-1',
      status: CreativeBatchStatus.RUNNING,
      startedAt: new Date('2024-06-01T00:00:00Z'),
      completedAt: null,
      errorCode: null,
      tokenUsage: { prompt: 100, completion: 200 }
    })

    expect(creativeBatchMock.update).toHaveBeenCalledTimes(1)
    const updateArgs = creativeBatchMock.update.mock.calls[0][0]
    expect(updateArgs.where).toEqual({ id: 'batch-1' })
    expect(updateArgs.data.status).toBe(CreativeBatchStatus.RUNNING)
    expect(updateArgs.data.statusVersion).toEqual({ increment: 1 })
    expect(updateArgs.data.startedAt).toEqual(new Date('2024-06-01T00:00:00Z'))
    expect(updateArgs.data.completedAt).toBeNull()
    expect(updateArgs.data.errorCode).toBeNull()
    expect(updateArgs.data.tokenUsage).toEqual({ prompt: 100, completion: 200 })
  })
})
