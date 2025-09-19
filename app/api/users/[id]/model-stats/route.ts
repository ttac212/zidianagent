import { NextRequest, NextResponse } from "next/server"

import { getToken } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"
import { 
  getModelDisplayName, 
  getModelProvider, 
  calculateUsagePercentage,
  formatStatsNumber
} from "@/lib/ai/model-stats-helper"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户身份
    const token = await getToken({ req: request as any })
    if (!token?.sub) {
      return NextResponse.json({ error: "未认证" }, { status: 401 })
    }

    const { id: userId } = await params  
    const requesterId = String(token.sub)

    // 验证权限：用户只能查看自己的统计
    if (userId !== requesterId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 })
    }

    // 获取查询参数
    const url = new URL(request.url)
    const days = parseInt(url.searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setUTCHours(0, 0, 0, 0)

    // 查询用户的统计数据（包括按模型分组的数据）
    const usageStats = await prisma.usageStats.findMany({
      where: {
        userId,
        date: {
          gte: startDate
        }
      },
      select: {
        date: true,
        modelId: true,
        modelProvider: true,
        totalTokens: true,
        apiCalls: true,
        promptTokens: true,
        completionTokens: true,
      },
      orderBy: {
        date: 'desc'
      }
    })

    // 分离总量数据和模型数据
    const totalStats = usageStats.filter(stat => stat.modelId === "_total")
    const modelStats = usageStats.filter(stat => stat.modelId && stat.modelId !== "_total")

    // 计算总体统计
    const totalTokens = totalStats.reduce((sum, stat) => sum + stat.totalTokens, 0)
    const totalRequests = totalStats.reduce((sum, stat) => sum + stat.apiCalls, 0)

    // 按模型聚合统计
    const modelAggregated: Record<string, {
      totalTokens: number
      requests: number
      promptTokens: number
      completionTokens: number
      provider: string
      displayName: string
    }> = {}

    modelStats.forEach(stat => {
      if (!stat.modelId || stat.modelId === "_total") return
      
      if (!modelAggregated[stat.modelId]) {
        modelAggregated[stat.modelId] = {
          totalTokens: 0,
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          provider: stat.modelProvider || getModelProvider(stat.modelId),
          displayName: getModelDisplayName(stat.modelId)
        }
      }

      modelAggregated[stat.modelId].totalTokens += stat.totalTokens
      modelAggregated[stat.modelId].requests += stat.apiCalls
      modelAggregated[stat.modelId].promptTokens += stat.promptTokens
      modelAggregated[stat.modelId].completionTokens += stat.completionTokens
    })

    // 计算每个模型的使用量百分比
    const modelStatsWithPercentage = Object.entries(modelAggregated).map(([modelId, stats]) => ({
      modelId,
      ...stats,
      percentage: calculateUsagePercentage(stats.totalTokens, totalTokens),
      formattedTokens: formatStatsNumber(stats.totalTokens),
      formattedRequests: formatStatsNumber(stats.requests)
    }))

    // 按使用量排序
    modelStatsWithPercentage.sort((a, b) => b.totalTokens - a.totalTokens)

    // 按日期整理数据（用于图表）
    const dailyStatsMap: Record<string, Record<string, { tokens: number; requests: number }>> = {}

    modelStats.forEach(stat => {
      if (!stat.modelId) return
      
      const dateKey = stat.date.toISOString().split('T')[0]
      
      if (!dailyStatsMap[dateKey]) {
        dailyStatsMap[dateKey] = {}
      }
      
      if (!dailyStatsMap[dateKey][stat.modelId]) {
        dailyStatsMap[dateKey][stat.modelId] = { tokens: 0, requests: 0 }
      }
      
      dailyStatsMap[dateKey][stat.modelId].tokens += stat.totalTokens
      dailyStatsMap[dateKey][stat.modelId].requests += stat.apiCalls
    })

    const dailyStats = Object.entries(dailyStatsMap).map(([date, models]) => ({
      date,
      models
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // 构造响应数据
    const response = {
      success: true,
      data: {
        totalStats: {
          totalTokens,
          totalRequests,
          formattedTokens: formatStatsNumber(totalTokens),
          formattedRequests: formatStatsNumber(totalRequests),
          avgTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0
        },
        modelStats: modelStatsWithPercentage.reduce((acc, model) => {
          acc[model.modelId] = {
            displayName: model.displayName,
            provider: model.provider,
            totalTokens: model.totalTokens,
            requests: model.requests,
            promptTokens: model.promptTokens,
            completionTokens: model.completionTokens,
            percentage: model.percentage,
            formattedTokens: model.formattedTokens,
            formattedRequests: model.formattedRequests
          }
          return acc
        }, {} as Record<string, any>),
        dailyStats,
        summary: {
          queryDays: days,
          totalModels: Object.keys(modelAggregated).length,
          mostUsedModel: modelStatsWithPercentage[0]?.modelId || null,
          leastUsedModel: modelStatsWithPercentage[modelStatsWithPercentage.length - 1]?.modelId || null,
          hasData: modelStatsWithPercentage.length > 0
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: "获取模型统计失败", 
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined 
      }, 
      { status: 500 }
    )
  }
}