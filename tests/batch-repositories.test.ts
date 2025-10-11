import { describe, expect, beforeAll, beforeEach, it, vi } from 'vitest'
import {
  CreativeAssetRole,
  CreativeBatchStatus,
  Prisma,
  PromptAssetType
} from '@prisma/client'

const merchantPromptAssetMock = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
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

const referenceAssetMock = {
  findMany: vi.fn()
}

const mockPrisma = {
  $transaction: vi.fn(),
  merchantPromptAsset: merchantPromptAssetMock,
  creativeBatch: creativeBatchMock,
  creativeBatchAsset: creativeBatchAssetMock,
  referenceAsset: referenceAssetMock
} as unknown as {
  $transaction: ReturnType<typeof vi.fn>
  merchantPromptAsset: typeof merchantPromptAssetMock
  creativeBatch: typeof creativeBatchMock
  creativeBatchAsset: typeof creativeBatchAssetMock
  referenceAsset: typeof referenceAssetMock
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  toJsonInput: (value: unknown) => value
}))

let createPromptAssetVersion: typeof import('@/lib/repositories/prompt-asset-repository')['createPromptAssetVersion']
let createBatchWithAssets: typeof import('@/lib/repositories/creative-batch-repository')['createBatchWithAssets']
let updateBatchStatus: typeof import('@/lib/repositories/creative-batch-repository')['updateBatchStatus']

beforeAll(async () => {
  const promptRepo = await import('@/lib/repositories/prompt-asset-repository')
  createPromptAssetVersion = promptRepo.createPromptAssetVersion

  const batchRepo = await import('@/lib/repositories/creative-batch-repository')
  createBatchWithAssets = batchRepo.createBatchWithAssets
  updateBatchStatus = batchRepo.updateBatchStatus
})

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

    // Mock 资产归属校验
    merchantPromptAssetMock.findMany.mockResolvedValue([
      { id: 'report-1', type: PromptAssetType.REPORT },
      { id: 'prompt-2', type: PromptAssetType.PROMPT }
    ])
    referenceAssetMock.findMany.mockResolvedValue([
      { id: 'ref-3', kind: 'RAW_ATTACHMENT' }
    ])

    mockPrisma.$transaction.mockImplementation(async fn => {
      return fn({
        merchantPromptAsset: merchantPromptAssetMock,
        creativeBatch: creativeBatchMock,
        creativeBatchAsset: creativeBatchAssetMock,
        referenceAsset: referenceAssetMock
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

    // Mock 资产归属校验（会先执行）
    merchantPromptAssetMock.findMany.mockResolvedValue([
      { id: 'report-1', type: PromptAssetType.REPORT },
      { id: 'prompt-2', type: PromptAssetType.PROMPT }
    ])

    mockPrisma.$transaction.mockImplementation(async fn => {
      return fn({
        merchantPromptAsset: merchantPromptAssetMock,
        creativeBatch: creativeBatchMock,
        creativeBatchAsset: creativeBatchAssetMock,
        referenceAsset: referenceAssetMock
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

  it('rejects when prompt asset does not belong to merchant', async () => {
    merchantPromptAssetMock.findMany.mockResolvedValue([
      // 只返回一个资产，另一个不属于该商家
      { id: 'prompt-1', type: PromptAssetType.PROMPT }
    ])

    creativeBatchMock.findUnique.mockResolvedValue(undefined)

    mockPrisma.$transaction.mockImplementation(async fn => {
      return fn({
        merchantPromptAsset: merchantPromptAssetMock,
        creativeBatch: creativeBatchMock,
        creativeBatchAsset: creativeBatchAssetMock,
        referenceAsset: referenceAssetMock
      } as any)
    })

    await expect(
      createBatchWithAssets({
        merchantId: 'merchant-A',
        triggeredBy: 'user-1',
        assets: [
          { role: CreativeAssetRole.REPORT, assetId: 'report-from-merchant-B' },
          { role: CreativeAssetRole.PROMPT, assetId: 'prompt-1' }
        ]
      })
    ).rejects.toThrow(/do not belong to merchant/)

    expect(creativeBatchMock.create).not.toHaveBeenCalled()
  })

  it('rejects when reference asset does not belong to merchant', async () => {
    merchantPromptAssetMock.findMany.mockResolvedValue([
      { id: 'report-1', type: PromptAssetType.REPORT },
      { id: 'prompt-1', type: PromptAssetType.PROMPT }
    ])

    referenceAssetMock.findMany.mockResolvedValue([
      // 缺少一个资产
    ])

    creativeBatchMock.findUnique.mockResolvedValue(undefined)

    mockPrisma.$transaction.mockImplementation(async fn => {
      return fn({
        merchantPromptAsset: merchantPromptAssetMock,
        creativeBatch: creativeBatchMock,
        creativeBatchAsset: creativeBatchAssetMock,
        referenceAsset: referenceAssetMock
      } as any)
    })

    await expect(
      createBatchWithAssets({
        merchantId: 'merchant-A',
        triggeredBy: 'user-1',
        assets: [
          { role: CreativeAssetRole.REPORT, assetId: 'report-1' },
          { role: CreativeAssetRole.PROMPT, assetId: 'prompt-1' },
          { role: CreativeAssetRole.ATTACHMENT, assetId: 'attachment-from-merchant-B' }
        ]
      })
    ).rejects.toThrow(/do not belong to merchant/)

    expect(creativeBatchMock.create).not.toHaveBeenCalled()
  })

  it('rejects when asset type does not match role', async () => {
    merchantPromptAssetMock.findMany.mockResolvedValue([
      { id: 'report-1', type: PromptAssetType.PROMPT },  // 类型错误
      { id: 'prompt-1', type: PromptAssetType.PROMPT }
    ])

    creativeBatchMock.findUnique.mockResolvedValue(undefined)

    mockPrisma.$transaction.mockImplementation(async fn => {
      return fn({
        merchantPromptAsset: merchantPromptAssetMock,
        creativeBatch: creativeBatchMock,
        creativeBatchAsset: creativeBatchAssetMock,
        referenceAsset: referenceAssetMock
      } as any)
    })

    await expect(
      createBatchWithAssets({
        merchantId: 'merchant-A',
        triggeredBy: 'user-1',
        assets: [
          { role: CreativeAssetRole.REPORT, assetId: 'report-1' },  // 期望 REPORT 类型
          { role: CreativeAssetRole.PROMPT, assetId: 'prompt-1' }
        ]
      })
    ).rejects.toThrow(/type mismatch/)

    expect(creativeBatchMock.create).not.toHaveBeenCalled()
  })
})
