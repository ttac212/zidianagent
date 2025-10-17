/**
 * 提示词资产查询接口
 * 用于新的 /prompt-center 页面
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasMerchantAccess } from '@/lib/auth/merchant-access'
import { success, badRequest, unauthorized } from '@/lib/api/http-response'
import type { PromptAssetType } from '@prisma/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/prompt-assets
 * 查询提示词资产列表
 *
 * Query参数:
 * - merchantId: 商家ID(必需)
 * - type: 资产类型 REPORT|PROMPT|ATTACHMENT(可选)
 * - activeOnly: 只显示激活版本(可选,默认false)
 * - page: 页码(可选,默认1)
 * - limit: 每页数量(可选,默认20)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return unauthorized('请先登录')
  }

  const { searchParams } = new URL(request.url)
  const merchantId = searchParams.get('merchantId')
  const type = searchParams.get('type') as PromptAssetType | null
  const activeOnly = searchParams.get('activeOnly') === 'true'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  if (!merchantId) {
    return badRequest('缺少 merchantId 参数')
  }

  // 权限检查
  const hasAccess = await hasMerchantAccess(
    session.user.id,
    merchantId,
    session.user.role
  )

  if (!hasAccess) {
    return unauthorized('无权访问该商家数据')
  }

  // 构建查询条件
  const where: {
    merchantId: string
    type?: PromptAssetType
  } = { merchantId }

  if (type) {
    where.type = type
  }

  // Note: isActive字段已删除，改用version判断激活状态
  // activeOnly过滤将在查询后通过groupBy实现

  // 查询数据（按version降序，方便后续判断激活状态）
  const allAssets = await prisma.merchantPromptAsset.findMany({
    where,
    select: {
      id: true,
      type: true,
      title: true,
      version: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
      parentId: true
    },
    orderBy: [
      { type: 'asc' },
      { version: 'desc' }
    ]
  })

  // 计算每个type的最大version（激活版本）
  const maxVersions = new Map<PromptAssetType, number>()
  allAssets.forEach(asset => {
    const currentMax = maxVersions.get(asset.type) || 0
    if (asset.version > currentMax) {
      maxVersions.set(asset.type, asset.version)
    }
  })

  // 标注isActive状态
  let assetsWithActive = allAssets.map(asset => ({
    ...asset,
    isActive: asset.version === maxVersions.get(asset.type)
  }))

  // 如果只要激活版本，过滤
  if (activeOnly) {
    assetsWithActive = assetsWithActive.filter(a => a.isActive)
  }

  // 分页
  const total = assetsWithActive.length
  const assets = assetsWithActive.slice((page - 1) * limit, page * limit)

  // 统计各类型数量
  const stats = await prisma.merchantPromptAsset.groupBy({
    by: ['type'],
    where: { merchantId },
    _count: {
      id: true
    }
  })

  const typeStats = {
    REPORT: stats.find(s => s.type === 'REPORT')?._count.id || 0,
    PROMPT: stats.find(s => s.type === 'PROMPT')?._count.id || 0,
    ATTACHMENT: stats.find(s => s.type === 'ATTACHMENT')?._count.id || 0
  }

  return success({
    assets,
    total,
    page,
    limit,
    typeStats
  })
}
