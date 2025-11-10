/**
 * Cron任务: 定时同步商家数据
 * GET /api/cron/sync-merchants
 *
 * 每小时执行一次，扫描需要同步的商家并调用现有的updateMerchantVideos()函数
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateMerchantVideos } from '@/lib/tikhub'
import * as HttpResponse from '@/lib/api/http-response'

export async function GET(request: NextRequest) {
  try {
    // 1. 验证Cron密钥
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
      return HttpResponse.unauthorized('Invalid cron secret')
    }

    const now = new Date()
    const startTime = Date.now()

    // 2. 查询需要同步的商家（直接从Merchant表，无需JOIN）
    const merchants = await prisma.merchant.findMany({
      where: {
        monitoringEnabled: true,
        nextSyncAt: { lte: now },
      },
      take: 10, // 每次最多10个，避免超时
      orderBy: { nextSyncAt: 'asc' },
    })

    if (merchants.length === 0) {
      return HttpResponse.ok('No merchants to sync', {
        total: 0,
        success: 0,
        failed: 0,
        duration: Date.now() - startTime,
      })
    }

    // 3. 批量同步（最多3个并发）
    const results = []
    for (let i = 0; i < merchants.length; i += 3) {
      const batch = merchants.slice(i, Math.min(i + 3, merchants.length))
      const promises = batch.map(async (merchant) => {
        const syncStartTime = Date.now()
        try {
          // 调用现有的增量更新函数（100%复用）
          const result = await updateMerchantVideos(merchant.id, { limit: 50 })

          // 更新下次同步时间
          await prisma.merchant.update({
            where: { id: merchant.id },
            data: {
              nextSyncAt: new Date(
                Date.now() + merchant.syncIntervalSeconds * 1000
              ),
              lastCollectedAt: new Date(),
            },
          })

          return {
            merchantId: merchant.id,
            merchantName: merchant.name,
            success: true,
            newVideos: result.newVideos,
            updatedVideos: result.updatedVideos,
            duration: Date.now() - syncStartTime,
          }
        } catch (error: any) {
          // 失败时延迟1小时后重试
          await prisma.merchant.update({
            where: { id: merchant.id },
            data: { nextSyncAt: new Date(Date.now() + 3600 * 1000) },
          })

          return {
            merchantId: merchant.id,
            merchantName: merchant.name,
            success: false,
            error: error.message,
            duration: Date.now() - syncStartTime,
          }
        }
      })

      const batchResults = await Promise.all(promises)
      results.push(...batchResults)

      // 批次间延迟，避免API限流
      if (i + 3 < merchants.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // 4. 返回结果
    const successCount = results.filter((r) => r.success).length
    const failedCount = results.length - successCount
    const totalDuration = Date.now() - startTime

    return HttpResponse.ok('Sync completed', {
      total: results.length,
      success: successCount,
      failed: failedCount,
      duration: totalDuration,
      results,
    })
  } catch (error: any) {
    console.error('Cron任务执行失败:', error)
    return HttpResponse.serverError('Cron task execution failed', {
      error: error.message,
    })
  }
}
