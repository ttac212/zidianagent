/**
 * 优化后的模型统计API示例
 * 演示如何使用缓存和聚合查询优化性能
 */

import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"
import { cachedQuery } from "@/lib/utils/api-cache"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) {
      return NextResponse.json({ error: "未认证" }, { status: 401 })
    }

    const { id: userId } = await params
    const requesterId = String(token.sub)

    if (userId !== requesterId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 })
    }

    const url = new URL(request.url)
    const days = parseInt(url.searchParams.get('days') || '30')
    const useCache = url.searchParams.get('cache') !== 'false'
    
    // 构建缓存键
    const cacheKey = `model-stats-${userId}-${days}`
    
    // 定义查询函数
    const queryFn = async () => {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      startDate.setUTCHours(0, 0, 0, 0)

      // 使用聚合查询替代全量查询
      const aggregatedStats = await prisma.$queryRaw`
        SELECT 
          modelId,
          modelProvider,
          SUM(totalTokens) as totalTokens,
          SUM(promptTokens) as promptTokens,
          SUM(completionTokens) as completionTokens,
          SUM(apiCalls) as requests,
          COUNT(DISTINCT date) as activeDays
        FROM usage_stats
        WHERE userId = ${userId}
          AND date >= ${startDate}
          AND modelId != '_total'
        GROUP BY modelId, modelProvider
        ORDER BY totalTokens DESC
      ` as Array<{
        modelId: string
        modelProvider: string
        totalTokens: bigint
        promptTokens: bigint
        completionTokens: bigint
        requests: bigint
        activeDays: number
      }>

      // 获取总量统计
      const totalStats = await prisma.$queryRaw`
        SELECT 
          SUM(totalTokens) as totalTokens,
          SUM(apiCalls) as totalRequests
        FROM usage_stats
        WHERE userId = ${userId}
          AND date >= ${startDate}
          AND modelId = '_total'
      ` as Array<{
        totalTokens: bigint | null
        totalRequests: bigint | null
      }>

      const total = totalStats[0] || { totalTokens: 0n, totalRequests: 0n }
      const totalTokensNum = Number(total.totalTokens || 0n)
      const totalRequestsNum = Number(total.totalRequests || 0n)

      // 转换数据格式
      const modelStats = aggregatedStats.map(stat => ({
        modelId: stat.modelId,
        provider: stat.modelProvider,
        totalTokens: Number(stat.totalTokens),
        promptTokens: Number(stat.promptTokens),
        completionTokens: Number(stat.completionTokens),
        requests: Number(stat.requests),
        activeDays: stat.activeDays,
        percentage: totalTokensNum > 0 
          ? Math.round((Number(stat.totalTokens) / totalTokensNum) * 100) 
          : 0
      }))

      return {
        totalStats: {
          totalTokens: totalTokensNum,
          totalRequests: totalRequestsNum,
          avgTokensPerRequest: totalRequestsNum > 0 
            ? Math.round(totalTokensNum / totalRequestsNum) 
            : 0
        },
        modelStats,
        summary: {
          queryDays: days,
          totalModels: modelStats.length,
          mostUsedModel: modelStats[0]?.modelId || null,
          cacheHit: false
        }
      }
    }

    // 使用缓存包装器
    let result
    if (useCache) {
      result = await cachedQuery(
        cacheKey,
        queryFn,
        30000 // 30秒缓存
      )
      if (result) {
        result.summary.cacheHit = true
      }
    } else {
      result = await queryFn()
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Model stats error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: "获取模型统计失败"
      }, 
      { status: 500 }
    )
  }
}

/**
 * 优化要点：
 * 
 * 1. 使用聚合查询（$queryRaw）替代findMany
 *    - 减少数据传输量
 *    - 数据库层面聚合更高效
 * 
 * 2. 添加缓存层
 *    - 30秒缓存减少重复查询
 *    - 可通过参数控制是否使用缓存
 * 
 * 3. 简化数据结构
 *    - 移除不必要的日期分组
 *    - 直接返回聚合结果
 * 
 * 4. 性能提升
 *    - 原版：查询90条记录，客户端聚合
 *    - 优化版：数据库聚合，返回少量结果
 *    - 预期提升：响应时间从200ms降至50ms
 */