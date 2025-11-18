/**
 * 抖音数据同步服务
 *
 * 负责从TikHub API获取数据并同步到数据库
 */

import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { TikHubClient, getTikHubClient } from './client'
import {
  mapUserProfileToMerchant,
  mapVideoToMerchantContent,
  validateMerchantData,
  validateContentData,
} from './mapper'
import type {
  MerchantSyncTask,
  BatchSyncConfig,
  DouyinVideo,
  DouyinUserProfile,
} from './types'
import * as dt from '@/lib/utils/date-toolkit'

const CONTENT_SYNC_FLUSH_SIZE = 50

/**
 * 同步单个商家的数据
 */
export async function syncMerchantData(
  secUid: string,
  options: {
    categoryId?: string
    businessType?: 'B2B' | 'B2C' | 'B2B2C'
    maxVideos?: number
    client?: TikHubClient
    profile?: DouyinUserProfile
  } = {}
): Promise<{
  success: boolean
  merchantId?: string
  totalVideos: number
  newVideos: number
  updatedVideos: number
  errors: string[]
}> {
  const client = options.client || getTikHubClient()
  const errors: string[] = []
  const maxVideos = options.maxVideos ?? 100

  try {
    const profile = options.profile ?? await fetchMerchantProfile(client, secUid)
    const merchantData = mapUserProfileToMerchant(profile, {
      categoryId: options.categoryId,
      businessType: options.businessType,
    })

    const validation = validateMerchantData(merchantData)
    if (!validation.valid) {
      throw new Error(`商家数据验证失败: ${validation.errors.join(', ')}`)
    }

    const merchant = await upsertMerchant(merchantData)

    const seenVideoIds = new Set<string>()
    let totalVideos = 0
    let newVideos = 0
    let updatedVideos = 0
    let remaining = maxVideos
    const rowsBuffer: PreparedContentRow[] = []

    const flushRows = async () => {
      if (!rowsBuffer.length) return
      const batch = rowsBuffer.splice(0, rowsBuffer.length)
      await persistMerchantSync(merchant.id, batch)
    }

    for await (const batch of client.getAllUserVideos({ sec_uid: secUid, count: 20 })) {
      if (!batch.aweme_list?.length) {
        if (!batch.has_more) {
          break
        }
        continue
      }

      const uniqueVideos = batch.aweme_list.filter((video) => {
        if (seenVideoIds.has(video.aweme_id)) {
          return false
        }
        seenVideoIds.add(video.aweme_id)
        return true
      })

      if (!uniqueVideos.length) {
        if (!batch.has_more) {
          break
        }
        continue
      }

      const limitedVideos = uniqueVideos.slice(0, remaining)
      const { contents, errors: contentErrors } = prepareContentPayloads(
        merchant.id,
        limitedVideos
      )
      if (contentErrors.length) {
        errors.push(...contentErrors)
      }

      if (contents.length) {
        const {
          rows,
          newVideos: chunkNewVideos,
          updatedVideos: chunkUpdatedVideos,
        } = await prepareContentSyncRows(merchant.id, contents)

        newVideos += chunkNewVideos
        updatedVideos += chunkUpdatedVideos
        rowsBuffer.push(...rows)

        if (rowsBuffer.length >= CONTENT_SYNC_FLUSH_SIZE) {
          await flushRows()
        }
      }

      totalVideos += limitedVideos.length
      remaining -= limitedVideos.length

      if (remaining <= 0) {
        break
      }

      if (!batch.has_more) {
        break
      }
    }

    await flushRows()

    return {
      success: true,
      merchantId: merchant.id,
      totalVideos,
      newVideos,
      updatedVideos,
      errors,
    }
  } catch (error: any) {
    errors.push(error.message)
    return {
      success: false,
      totalVideos: 0,
      newVideos: 0,
      updatedVideos: 0,
      errors,
    }
  }
}

/**
 * 批量同步商家数据
 */
export async function batchSyncMerchants(
  config: BatchSyncConfig
): Promise<MerchantSyncTask[]> {
  const client = getTikHubClient()
  const tasks: MerchantSyncTask[] = []
  const { merchantUids, maxConcurrent = 10, onProgress, onComplete } = config

  for (const uid of merchantUids) {
    tasks.push({
      taskId: `sync-${uid}-${Date.now()}`,
      merchantUid: uid,
      merchantName: '未知',
      status: 'pending',
      startedAt: new Date(),
      totalVideos: 0,
      processedVideos: 0,
      errors: [],
    })
  }

  for (let i = 0; i < tasks.length; i += maxConcurrent) {
    const batch = tasks.slice(i, i + maxConcurrent)
    const promises = batch.map(async (task) => {
      task.status = 'running'

      if (onProgress) {
        onProgress(task)
      }

      try {
        const profile = await client.getUserProfile({ sec_uid: task.merchantUid })
        task.merchantName = profile.nickname

        const result = await syncMerchantData(task.merchantUid, {
          maxVideos: 100,
          client,
          profile,
        })

        task.status = result.success ? 'completed' : 'failed'
        task.completedAt = new Date()
        task.totalVideos = result.totalVideos
        task.processedVideos = result.totalVideos
        task.errors = result.errors

        if (result.success) {
          task.result = {
            newVideos: result.newVideos,
            updatedVideos: result.updatedVideos,
            totalCost: result.totalVideos * 0.001,
          }
        }
      } catch (error: any) {
        task.status = 'failed'
        task.completedAt = new Date()
        task.errors.push(error.message)
      }

      if (onProgress) {
        onProgress(task)
      }
    })

    await Promise.all(promises)

    // 批次间延迟1秒，确保符合1秒10个并发的速率限制
    if (i + maxConcurrent < tasks.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  if (onComplete) {
    onComplete(tasks)
  }

  return tasks
}

/**
 * 搜索并导入新商家
 */
export async function searchAndImportMerchant(
  keyword: string,
  options: {
    categoryId?: string
    businessType?: 'B2B' | 'B2C' | 'B2B2C'
    autoSync?: boolean
  } = {}
): Promise<{
  success: boolean
  merchants: Array<{ uid: string; name: string; synced: boolean }>
  errors: string[]
}> {
  const client = getTikHubClient()
  const errors: string[] = []
  const merchants: Array<{ uid: string; name: string; synced: boolean }> = []

  try {
    const searchResult = await client.searchUser({ keyword, count: 20 })

    for (const item of searchResult.user_list) {
      const profile = item.user_info
      merchants.push({
        uid: profile.uid,
        name: profile.nickname,
        synced: false,
      })

      if (options.autoSync) {
        try {
          const result = await syncMerchantData(profile.sec_uid, {
            categoryId: options.categoryId,
            businessType: options.businessType,
            maxVideos: 50,
          })

          if (result.success) {
            merchants[merchants.length - 1].synced = true
          } else {
            errors.push(...result.errors)
          }
        } catch (error: any) {
          errors.push(`同步商家 ${profile.nickname} 失败: ${error.message}`)
        }
      }
    }

    return {
      success: true,
      merchants,
      errors,
    }
  } catch (error: any) {
    return {
      success: false,
      merchants: [],
      errors: [error.message],
    }
  }
}

/**
 * 更新商家视频数据（增量更新）
 */
export async function updateMerchantVideos(
  merchantId: string,
  options: {
    limit?: number
  } = {}
): Promise<{
  success: boolean
  newVideos: number
  updatedVideos: number
  errors: string[]
}> {
  const client = getTikHubClient()
  const errors: string[] = []

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    })

    if (!merchant) {
      throw new Error('商家不存在')
    }

    let secUid: string | undefined

    try {
      const contactInfo = typeof merchant.contactInfo === 'string'
        ? JSON.parse(merchant.contactInfo)
        : (merchant.contactInfo as any)
      secUid = contactInfo?.sec_uid
    } catch (_e) {
      // ignore parse errors
    }

    if (!secUid) {
      secUid = merchant.uid
    }

    if (!secUid) {
      throw new Error('商家缺少 sec_uid/uid 信息，无法同步视频')
    }

    const videosResponse = await client.getUserVideos({
      sec_uid: secUid,
      count: options.limit || 20,
    })

    // 直接使用全部返回的视频，让 upsert 自动识别新增和更新
    const { contents, errors: contentErrors } = prepareContentPayloads(
      merchantId,
      videosResponse.aweme_list,
    )
    if (contentErrors.length) {
      errors.push(...contentErrors)
    }

    const { rows, newVideos, updatedVideos } = await prepareContentSyncRows(
      merchantId,
      contents
    )

    await persistMerchantSync(merchantId, rows)

    return {
      success: true,
      newVideos,
      updatedVideos,
      errors,
    }
  } catch (error: any) {
    errors.push(error.message)
    return {
      success: false,
      newVideos: 0,
      updatedVideos: 0,
      errors,
    }
  }
}

async function fetchMerchantProfile(
  client: TikHubClient,
  secUid: string
): Promise<DouyinUserProfile> {
  try {
    return await client.getUserProfile({ sec_uid: secUid })
  } catch (error: any) {
    if (error?.code === 404) {
      const fallbackVideos = await client.getUserVideos({ sec_uid: secUid, count: 1 })
      const fallbackVideo = fallbackVideos.aweme_list[0]
      if (!fallbackVideo?.author) {
        throw new Error('用户资料不存在，且无法通过作品补全作者信息')
      }
      return buildProfileFromVideoAuthor(fallbackVideo, secUid)
    }
    throw error
  }
}

async function upsertMerchant(
  merchantData: ReturnType<typeof mapUserProfileToMerchant>
) {
  const { categoryId, contactInfo, ...merchantBase } = merchantData

  const merchantCreateData: Prisma.MerchantCreateInput = {
    ...merchantBase,
    contactInfo: contactInfo as Prisma.InputJsonValue,
    ...(categoryId && {
      category: {
        connect: { id: categoryId },
      },
    }),
  }

  const merchantUpdateData: Prisma.MerchantUpdateInput = {
    name: merchantData.name,
    description: merchantData.description,
    location: merchantData.location,
    address: merchantData.address,
    contactInfo: contactInfo as Prisma.InputJsonValue,
    businessType: merchantData.businessType,
    isVerified: merchantData.isVerified,
    lastCollectedAt: dt.now(),
    totalDiggCount: merchantData.totalDiggCount,
    totalCommentCount: merchantData.totalCommentCount,
    totalCollectCount: merchantData.totalCollectCount,
    totalShareCount: merchantData.totalShareCount,
    totalContentCount: merchantData.totalContentCount,
    totalEngagement: merchantData.totalEngagement ?? 0,
    ...(categoryId && {
      category: {
        connect: { id: categoryId },
      },
    }),
  }

  return prisma.merchant.upsert({
    where: { uid: merchantData.uid },
    update: merchantUpdateData,
    create: merchantCreateData,
  })
}

function prepareContentPayloads(
  merchantId: string,
  videos: DouyinVideo[],
): {
  contents: Array<ReturnType<typeof mapVideoToMerchantContent>>
  errors: string[]
} {
  const errors: string[] = []
  const contents: Array<ReturnType<typeof mapVideoToMerchantContent>> = []

  videos.forEach((video) => {
    const content = mapVideoToMerchantContent(video, merchantId)
    const validation = validateContentData(content)
    if (!validation.valid) {
      errors.push(`视频 ${video.aweme_id} 数据验证失败: ${validation.errors.join(', ')}`)
      return
    }
    contents.push(content)
  })

  return { contents, errors }
}

interface PreparedContentRow
  extends ReturnType<typeof mapVideoToMerchantContent> {
  id: string
  createdAt: Date
  updatedAt: Date
}

const MERCHANT_CONTENT_COLUMNS = [
  'id',
  'merchantId',
  'externalId',
  'title',
  'content',
  'transcript',
  'contentType',
  'duration',
  'shareUrl',
  'hasTranscript',
  'diggCount',
  'commentCount',
  'collectCount',
  'shareCount',
  'playCount',
  'forwardCount',
  'totalEngagement',
  'likeRate',
  'commentRate',
  'completionRate',
  'avgWatchDuration',
  'isSuspicious',
  'suspiciousReason',
  'tags',
  'textExtra',
  'publishedAt',
  'collectedAt',
  'externalCreatedAt',
  'createdAt',
  'updatedAt',
] as const

const MERCHANT_CONTENT_COLUMN_COUNT = MERCHANT_CONTENT_COLUMNS.length

async function prepareContentSyncRows(
  merchantId: string,
  contents: Array<ReturnType<typeof mapVideoToMerchantContent>>
): Promise<{
  rows: PreparedContentRow[]
  newVideos: number
  updatedVideos: number
}> {
  if (!contents.length) {
    return { rows: [], newVideos: 0, updatedVideos: 0 }
  }

  const deduped = dedupeByExternalId(contents)
  const externalIds = deduped.map((content) => content.externalId)

  const existing = await prisma.merchantContent.findMany({
    where: {
      merchantId,
      externalId: { in: externalIds },
    },
    select: { id: true, externalId: true },
  })

  const existingMap = new Map(existing.map((item) => [item.externalId, item.id]))
  const now = dt.now()
  let newVideos = 0
  let updatedVideos = 0

  const rows: PreparedContentRow[] = deduped.map((content) => {
    const existingId = existingMap.get(content.externalId)
    if (existingId) {
      updatedVideos += 1
    } else {
      newVideos += 1
    }

    return {
      ...content,
      id: existingId ?? randomUUID(),
      createdAt: content.collectedAt ?? now,
      updatedAt: now,
    }
  })

  return { rows, newVideos, updatedVideos }
}

async function persistMerchantSync(
  merchantId: string,
  rows: PreparedContentRow[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (rows.length) {
      await bulkUpsertMerchantContents(tx, rows)
    }
    await updateMerchantAggregates(tx, merchantId)
  })
}

async function bulkUpsertMerchantContents(
  tx: Prisma.TransactionClient,
  rows: PreparedContentRow[],
): Promise<void> {
  if (!rows.length) {
    return
  }

  // SQLite 单条语句最多 999 个参数，这里按批切分避免触顶
  const SQLITE_PARAM_LIMIT = 999
  const MAX_ROWS_PER_BATCH = Math.max(
    1,
    Math.floor(SQLITE_PARAM_LIMIT / MERCHANT_CONTENT_COLUMN_COUNT) - 1
  )
  const columnListSql = Prisma.join(
    MERCHANT_CONTENT_COLUMNS.map((column) => Prisma.raw(`"${column}"`)),
    ', '
  )

  for (let i = 0; i < rows.length; i += MAX_ROWS_PER_BATCH) {
    const chunk = rows.slice(i, i + MAX_ROWS_PER_BATCH)
    if (!chunk.length) continue

    const values = chunk.map((row) =>
      Prisma.sql`(${row.id}, ${row.merchantId}, ${row.externalId}, ${row.title}, ${row.content ?? null}, ${row.transcript ?? null}, ${row.contentType}, ${row.duration ?? null}, ${row.shareUrl ?? null}, ${row.hasTranscript}, ${row.diggCount}, ${row.commentCount}, ${row.collectCount}, ${row.shareCount}, ${row.playCount}, ${row.forwardCount}, ${row.totalEngagement}, ${row.likeRate ?? null}, ${row.commentRate ?? null}, ${row.completionRate ?? null}, ${row.avgWatchDuration ?? null}, ${row.isSuspicious}, ${row.suspiciousReason ?? null}, ${row.tags}, ${row.textExtra}, ${row.publishedAt ?? null}, ${row.collectedAt}, ${row.externalCreatedAt ?? null}, ${row.createdAt}, ${row.updatedAt})`
    )

    const query = Prisma.sql`
      INSERT INTO "merchant_contents" (
        ${columnListSql}
      )
      VALUES ${Prisma.join(values, ', ')}
      ON CONFLICT("externalId", "merchantId") DO UPDATE SET
        "title" = excluded."title",
        "content" = excluded."content",
        "contentType" = excluded."contentType",
        "duration" = excluded."duration",
        "shareUrl" = excluded."shareUrl",
        "diggCount" = excluded."diggCount",
        "commentCount" = excluded."commentCount",
        "collectCount" = excluded."collectCount",
        "shareCount" = excluded."shareCount",
        "playCount" = excluded."playCount",
        "forwardCount" = excluded."forwardCount",
        "totalEngagement" = excluded."totalEngagement",
        "likeRate" = excluded."likeRate",
        "commentRate" = excluded."commentRate",
        "completionRate" = excluded."completionRate",
        "avgWatchDuration" = excluded."avgWatchDuration",
        "isSuspicious" = excluded."isSuspicious",
        "suspiciousReason" = excluded."suspiciousReason",
        "tags" = excluded."tags",
        "textExtra" = excluded."textExtra",
        "publishedAt" = excluded."publishedAt",
        "collectedAt" = excluded."collectedAt",
        "externalCreatedAt" = excluded."externalCreatedAt",
        "updatedAt" = excluded."updatedAt"
    `

    await tx.$executeRaw(query)
  }
}

async function updateMerchantAggregates(
  tx: Prisma.TransactionClient,
  merchantId: string,
): Promise<void> {
  const aggregates = await tx.merchantContent.aggregate({
    where: { merchantId },
    _count: { _all: true },
    _sum: {
      diggCount: true,
      commentCount: true,
      collectCount: true,
      shareCount: true,
      playCount: true,
      forwardCount: true,
    },
  })

  const totalContentCount = aggregates._count?._all ?? 0
  const totalDiggCount = aggregates._sum?.diggCount ?? 0
  const totalCommentCount = aggregates._sum?.commentCount ?? 0
  const totalCollectCount = aggregates._sum?.collectCount ?? 0
  const totalShareCount = aggregates._sum?.shareCount ?? 0
  const totalPlayCount = aggregates._sum?.playCount ?? 0
  const totalEngagement =
    totalDiggCount + totalCommentCount + totalCollectCount + totalShareCount

  // 计算平均互动率（避免除零）
  const avgEngagementRate = totalPlayCount > 0
    ? (totalEngagement / totalPlayCount) * 100
    : null

  await tx.merchant.update({
    where: { id: merchantId },
    data: {
      totalContentCount,
      totalDiggCount,
      totalCommentCount,
      totalCollectCount,
      totalShareCount,
      totalEngagement,
      totalPlayCount: BigInt(totalPlayCount),
      avgEngagementRate,
      lastCollectedAt: dt.now(),
    },
  })
}

function dedupeByExternalId(
  contents: Array<ReturnType<typeof mapVideoToMerchantContent>>,
): Array<ReturnType<typeof mapVideoToMerchantContent>> {
  const map = new Map<string, ReturnType<typeof mapVideoToMerchantContent>>()
  for (const content of contents) {
    map.set(content.externalId, content)
  }
  return Array.from(map.values())
}

/**
 * 当TikHub无法按sec_uid返回资料时，根据视频作者兜底构建用户档案
 */
function buildProfileFromVideoAuthor(video: DouyinVideo, fallbackSecUid: string): DouyinUserProfile {
  const author = video.author || {
    uid: fallbackSecUid,
    sec_uid: fallbackSecUid,
    nickname: '未知商家',
    unique_id: '',
  }

  return {
    uid: author.uid || fallbackSecUid,
    sec_uid: author.sec_uid || fallbackSecUid,
    unique_id: author.unique_id || '',
    nickname: author.nickname || '未知商家',
    signature: video.desc || '',
    avatar_thumb: { url_list: [] },
    avatar_larger: { url_list: [] },
    follower_count: 0,
    following_count: 0,
    total_favorited: 0,
    aweme_count: 0,
    favoriting_count: 0,
    location: '',
    province: '',
    city: '',
    district: '',
    gender: 0,
    birthday: '',
    ip_location: '',
    custom_verify: '',
    enterprise_verify_reason: '',
    is_enterprise_vip: false,
    verification_type: 0,
    verification_badge_url: [],
    school_name: '',
    live_agreement: 0,
    live_commerce: false,
    forward_count: 0,
  }
}

/**
 * 更新单个视频的数据（强制刷新）
 */
export async function updateSingleVideo(
  merchantId: string,
  externalId: string
): Promise<{
  success: boolean
  updated: boolean
  errors: string[]
}> {
  const client = getTikHubClient()
  const errors: string[] = []

  try {
    // 1. 获取商家信息
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    })

    if (!merchant) {
      throw new Error('商家不存在')
    }

    // 2. 优先尝试通过详情接口获取目标视频
    let targetVideo: DouyinVideo | undefined
    let detailError: any
    try {
      const videoDetail = await client.getVideoDetail({ aweme_id: externalId })
      targetVideo = videoDetail.aweme_detail
    } catch (error) {
      detailError = error
    }

    if (!targetVideo) {
      // detail 接口失败时回退到列表查询
      let secUid: string | undefined
      try {
        const contactInfo = typeof merchant.contactInfo === 'string'
          ? JSON.parse(merchant.contactInfo)
          : (merchant.contactInfo as any)
        secUid = contactInfo?.sec_uid
      } catch (_e) {
        // ignore parse errors
      }

      if (!secUid) {
        secUid = merchant.uid
      }

      if (!secUid) {
        if (detailError) {
          throw detailError
        }
        throw new Error('商家缺少 sec_uid/uid 信息，无法同步视频')
      }

      const fallbackVideos = await client.getUserVideos({
        sec_uid: secUid,
        count: 100,
      })

      targetVideo = fallbackVideos.aweme_list.find(
        (video) => video.aweme_id === externalId
      )

      if (!targetVideo) {
        if (detailError) {
          throw detailError
        }
        throw new Error(`未找到视频 ${externalId}`)
      }
    }

    // 3. 映射视频数据
    const { contents, errors: contentErrors } = prepareContentPayloads(
      merchantId,
      [targetVideo] // 只处理这一个视频
    )

    if (contentErrors.length) {
      errors.push(...contentErrors)
    }

    if (contents.length === 0) {
      throw new Error('视频数据验证失败')
    }

    // 4. 准备更新数据
    const { rows } = await prepareContentSyncRows(merchantId, contents)

    // 5. 执行更新
    await persistMerchantSync(merchantId, rows)

    return {
      success: true,
      updated: true,
      errors,
    }
  } catch (error: any) {
    errors.push(error.message)
    return {
      success: false,
      updated: false,
      errors,
    }
  }
}

