/**
 * 抖音数据同步服务
 *
 * 负责从TikHub API获取数据并同步到数据库
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { TikHubClient, getTikHubClient } from './client'
import {
  mapUserProfileToMerchant,
  mapVideosToMerchantContents,
  aggregateMerchantStats,
  validateMerchantData,
  validateContentData,
} from './mapper'
import type {
  MerchantSyncTask,
  BatchSyncConfig,
  DouyinVideo,
} from './types'
import * as dt from '@/lib/utils/date-toolkit'

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

  try {
    // 1. 获取用户资料
    const profile = await client.getUserProfile({ sec_uid: secUid })

    // 2. 映射并验证商家数据
    const merchantData = mapUserProfileToMerchant(profile, {
      categoryId: options.categoryId,
      businessType: options.businessType,
    })

    const validation = validateMerchantData(merchantData)
    if (!validation.valid) {
      throw new Error(`商家数据验证失败: ${validation.errors.join(', ')}`)
    }

    // 3. 创建或更新商家
    const { categoryId, ...merchantBase } = merchantData

    const merchantCreateData: Prisma.MerchantCreateInput = {
      ...merchantBase,
      contactInfo: merchantData.contactInfo as Prisma.InputJsonValue,
      ...(categoryId && {
        category: {
          connect: { id: categoryId }
        }
      })
    }

    const merchantUpdateData: Prisma.MerchantUpdateInput = {
      name: merchantData.name,
      description: merchantData.description,
      location: merchantData.location,
      address: merchantData.address,
      contactInfo: merchantData.contactInfo as Prisma.InputJsonValue,
      businessType: merchantData.businessType,
      isVerified: merchantData.isVerified,
      lastCollectedAt: dt.now(),
      ...(options.categoryId && {
        category: {
          connect: { id: options.categoryId },
        },
      }),
    }

    const merchant = await prisma.merchant.upsert({
      where: { uid: merchantData.uid },
      update: merchantUpdateData,
      create: merchantCreateData,
    })

    // 4. 获取视频列表
    let allVideos: DouyinVideo[] = []
    let processedCount = 0
    const maxVideos = options.maxVideos || 100

    for await (const batch of client.getAllUserVideos({ sec_uid: secUid, count: 20 })) {
      allVideos.push(...batch.aweme_list)
      processedCount += batch.aweme_list.length

      if (processedCount >= maxVideos) {
        allVideos = allVideos.slice(0, maxVideos)
        break
      }

      if (!batch.has_more) break
    }

    // 5. 同步视频数据
    let newVideos = 0
    let updatedVideos = 0

    for (const video of allVideos) {
      try {
        const contentData = mapVideosToMerchantContents(
          { aweme_list: [video], has_more: false, max_cursor: 0, min_cursor: 0, status_code: 0 },
          merchant.id
        )[0]

        const validation = validateContentData(contentData)
        if (!validation.valid) {
          errors.push(`视频 ${video.aweme_id} 数据验证失败: ${validation.errors.join(', ')}`)
          continue
        }

        // 检查是否已存在
        const existing = await prisma.merchantContent.findUnique({
          where: {
            externalId_merchantId: {
              externalId: contentData.externalId,
              merchantId: merchant.id,
            },
          },
        })

        if (existing) {
          // 更新现有记录
          await prisma.merchantContent.update({
            where: { id: existing.id },
            data: {
              title: contentData.title,
              diggCount: contentData.diggCount,
              commentCount: contentData.commentCount,
              collectCount: contentData.collectCount,
              shareCount: contentData.shareCount,
              collectedAt: dt.now(),
            },
          })
          updatedVideos++
        } else {
          // 创建新记录
          await prisma.merchantContent.create({
            data: contentData,
          })
          newVideos++
        }
      } catch (error: any) {
        errors.push(`处理视频 ${video.aweme_id} 失败: ${error.message}`)
      }
    }

    // 6. 更新商家聚合统计
    const contents = await prisma.merchantContent.findMany({
      where: { merchantId: merchant.id },
      select: {
        diggCount: true,
        commentCount: true,
        collectCount: true,
        shareCount: true,
      },
    })

    const stats = aggregateMerchantStats(contents)

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        totalContentCount: contents.length,
        ...stats,
      },
    })

    return {
      success: true,
      merchantId: merchant.id,
      totalVideos: allVideos.length,
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
  const { merchantUids, maxConcurrent = 3, onProgress, onComplete } = config

  // 创建任务
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

  // 分批处理
  for (let i = 0; i < tasks.length; i += maxConcurrent) {
    const batch = tasks.slice(i, i + maxConcurrent)
    const promises = batch.map(async (task) => {
      task.status = 'running'

      if (onProgress) {
        onProgress(task)
      }

      try {
        // 获取用户资料（先获取名称）
        const profile = await client.getUserProfile({ sec_uid: task.merchantUid })
        task.merchantName = profile.nickname

        // 同步数据
        const result = await syncMerchantData(task.merchantUid, {
          maxVideos: 100,
          client,
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
            totalCost: result.totalVideos * 0.001, // 简化计费
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

    // 批次间延迟
    if (i + maxConcurrent < tasks.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
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
    // 搜索用户
    const searchResult = await client.searchUser({ keyword, count: 20 })

    for (const item of searchResult.user_list) {
      const profile = item.user_info
      merchants.push({
        uid: profile.uid,
        name: profile.nickname,
        synced: false,
      })

      // 如果启用自动同步
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
    // 获取商家信息
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        contents: {
          orderBy: { publishedAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!merchant) {
      throw new Error('商家不存在')
    }

    // 安全地提取 sec_uid，支持向后兼容
    // 1. 优先从 contactInfo 中提取（新数据格式）
    // 2. 如果 contactInfo 是字符串，先解析
    // 3. 如果 contactInfo.sec_uid 不存在，回退到 merchant.uid（旧数据格式）
    let secUid: string | undefined

    try {
      const contactInfo = typeof merchant.contactInfo === 'string'
        ? JSON.parse(merchant.contactInfo)
        : merchant.contactInfo as any

      secUid = contactInfo?.sec_uid
    } catch (_e) {
      // JSON 解析失败，忽略错误
    }

    // 回退策略：旧的 CSV 导入脚本可能直接将 sec_uid 存在 merchant.uid 中
    if (!secUid) {
      secUid = merchant.uid
    }

    if (!secUid) {
      throw new Error('商家缺少 sec_uid/uid 信息，无法同步视频')
    }

    // 获取最新视频的发布时间
    const latestPublishedAt = merchant.contents[0]?.publishedAt

    // 获取用户视频
    const videosResponse = await client.getUserVideos({
      sec_uid: secUid,
      count: options.limit || 20,
    })

    let newVideos = 0
    let updatedVideos = 0

    for (const video of videosResponse.aweme_list) {
      const videoPublishedAt = dt.parse(new Date(video.create_time * 1000).toISOString())

      // 如果视频早于最新记录，跳过（已经同步过）
      if (latestPublishedAt && videoPublishedAt && videoPublishedAt <= latestPublishedAt) {
        continue
      }

      const contentData = mapVideosToMerchantContents(
        { aweme_list: [video], has_more: false, max_cursor: 0, min_cursor: 0, status_code: 0 },
        merchantId
      )[0]

      try {
        const existing = await prisma.merchantContent.findUnique({
          where: {
            externalId_merchantId: {
              externalId: contentData.externalId,
              merchantId,
            },
          },
        })

        if (existing) {
          await prisma.merchantContent.update({
            where: { id: existing.id },
            data: {
              diggCount: contentData.diggCount,
              commentCount: contentData.commentCount,
              collectCount: contentData.collectCount,
              shareCount: contentData.shareCount,
              collectedAt: dt.now(),
            },
          })
          updatedVideos++
        } else {
          await prisma.merchantContent.create({ data: contentData })
          newVideos++
        }
      } catch (error: any) {
        errors.push(`处理视频 ${video.aweme_id} 失败: ${error.message}`)
      }
    }

    // 更新商家统计
    const contents = await prisma.merchantContent.findMany({
      where: { merchantId },
      select: {
        diggCount: true,
        commentCount: true,
        collectCount: true,
        shareCount: true,
      },
    })

    const stats = aggregateMerchantStats(contents)

    await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        totalContentCount: contents.length,
        lastCollectedAt: dt.now(),
        ...stats,
      },
    })

    return {
      success: true,
      newVideos,
      updatedVideos,
      errors,
    }
  } catch (error: any) {
    return {
      success: false,
      newVideos: 0,
      updatedVideos: 0,
      errors: [error.message],
    }
  }
}

