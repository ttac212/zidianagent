/**
 * 商家详情API路由
 * GET /api/merchants/[id] - 获取商家详情
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { MerchantDetailResponse } from '@/types/merchant'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import {
  validationError,
  notFound,
  success
} from '@/lib/api/http-response'
import { withMerchantAuth, withMerchantAdminAuth } from '@/lib/api/merchant-auth'


// GET /api/merchants/[id] - 获取商家详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAuth(request, params, async (_userId, _req, params) => {
    try {
      const { id } = await params

      if (!id) {
        return validationError('商家ID不能为空')
      }

      const merchant = await prisma.merchant.findUnique({
        where: { id },
        include: {
          category: true,
          contents: {
            orderBy: {
              publishedAt: 'desc'
            },
            take: 20 // 默认只返回最新的20条内容
          },
          _count: {
            select: { contents: true }
          }
        }
      })

      if (!merchant) {
        return notFound('商家不存在')
      }

      // 处理内容数据，解析JSON字段
      const processedContents = merchant.contents.map(content => ({
        ...content,
        parsedTags: (() => {
          try {
            return JSON.parse(content.tags)
          } catch {
            return []
          }
        })(),
        parsedTextExtra: (() => {
          try {
            return JSON.parse(content.textExtra)
          } catch {
            return []
          }
        })()
      }))

      const response: MerchantDetailResponse = {
        merchant: {
          ...merchant,
          contents: processedContents
        }
      }

      return success(response)

    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}

// PATCH /api/merchants/[id] - 更新商家信息
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAdminAuth(request, params, async (_userId, req, params) => {
    try {
      const { id } = await params

      if (!id) {
        return validationError('商家ID不能为空')
      }

      // 检查商家是否存在
      const existingMerchant = await prisma.merchant.findUnique({
        where: { id }
      })

      if (!existingMerchant) {
        return notFound('商家不存在')
      }

      // 解析请求体
      const body = await req.json()
      const {
        name,
        description,
        location,
        address,
        businessType,
        status,
        categoryId,
        monitoringEnabled,
        syncIntervalSeconds,
      } = body

      // 验证必填字段
      if (name !== undefined && !name.trim()) {
        return validationError('商家名称不能为空')
      }

      // 如果指定了分类ID，检查分类是否存在
      if (categoryId && categoryId !== null) {
        const categoryExists = await prisma.merchantCategory.findUnique({
          where: { id: categoryId }
        })
        if (!categoryExists) {
          return validationError('指定的分类不存在')
        }
      }

      // 智能计算nextSyncAt（不允许前端直接传递）
      let nextSyncAt: Date | null | undefined = undefined

      if (monitoringEnabled !== undefined || syncIntervalSeconds !== undefined) {
        const currentEnabled = existingMerchant.monitoringEnabled
        const currentInterval = existingMerchant.syncIntervalSeconds
        const newEnabled = monitoringEnabled ?? currentEnabled
        const newInterval = syncIntervalSeconds ?? currentInterval
        const lastSync = existingMerchant.lastCollectedAt

        if (newEnabled) {
          // 启用监控
          if (!currentEnabled) {
            // 首次启用 → 立即执行
            nextSyncAt = new Date()
          } else if (syncIntervalSeconds !== undefined && syncIntervalSeconds !== currentInterval) {
            // 只修改了频率 → 基于最后同步时间重新计算
            if (lastSync) {
              const calculatedNextSync = new Date(lastSync.getTime() + newInterval * 1000)
              const now = new Date()
              // 如果计算出的时间已过期，使用当前时间（立即执行）
              nextSyncAt = calculatedNextSync > now ? calculatedNextSync : now
            } else {
              // 没有最后同步时间，立即执行
              nextSyncAt = new Date()
            }
          }
          // 否则保持现有的nextSyncAt不变
        } else {
          // 禁用监控 → 清空nextSyncAt
          nextSyncAt = null
        }
      }

      // 更新商家信息
      const updatedMerchant = await prisma.merchant.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(location !== undefined && { location: location?.trim() || null }),
          ...(address !== undefined && { address: address?.trim() || null }),
          ...(businessType !== undefined && { businessType }),
          ...(status !== undefined && { status }),
          ...(categoryId !== undefined && { categoryId: categoryId || null }),
          // 监控配置字段
          ...(monitoringEnabled !== undefined && { monitoringEnabled }),
          ...(syncIntervalSeconds !== undefined && { syncIntervalSeconds }),
          // nextSyncAt由后端智能计算，只在需要时更新
          ...(nextSyncAt !== undefined && { nextSyncAt }),
          updatedAt: new Date(),
        },
        include: {
          category: true,
        },
      })

      return success({
        merchant: updatedMerchant
      })

    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}

export const dynamic = 'force-dynamic'