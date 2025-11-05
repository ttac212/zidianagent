/**
 * 使用量统计相关的 React Query hooks
 * 提供缓存、重试和状态管理功能的数据获取
 */

import { useQuery } from '@tanstack/react-query'

// ==================== 查询Keys ====================

export const usageStatsKeys = {
  all: ['usage-stats'] as const,
  detail: (userId: string, days?: number) =>
    [...usageStatsKeys.all, userId, { days }] as const,
}

// ==================== API响应类型 ====================

export interface ModelStats {
  displayName: string
  provider: string
  totalTokens: number
  requests: number
  promptTokens: number
  completionTokens: number
  percentage: number
  formattedTokens: string
  formattedRequests: string
}

export interface DailyStats {
  date: string
  models: Record<string, { tokens: number; requests: number }>
}

export interface UsageStatsData {
  totalStats: {
    totalTokens: number
    totalRequests: number
    formattedTokens: string
    formattedRequests: string
    avgTokensPerRequest: number
  }
  modelStats: Record<string, ModelStats>
  dailyStats: DailyStats[]
  summary: {
    queryDays: number
    totalModels: number
    mostUsedModel: string | null
    leastUsedModel: string | null
    hasData: boolean
  }
}

// ==================== Hooks ====================

/**
 * 获取用户的使用量统计
 */
export function useUsageStats(userId: string, days: number = 30) {
  return useQuery({
    queryKey: usageStatsKeys.detail(userId, days),
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/model-stats?days=${days}`)

      if (!response.ok) {
        throw new Error(`获取使用量统计失败: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data as UsageStatsData
    },
    staleTime: 1000 * 60, // 1分钟
    refetchInterval: 1000 * 60 * 5, // 5分钟自动刷新
  })
}

/**
 * 获取用户配额信息
 */
export function useUserQuota(userId: string) {
  return useQuery({
    queryKey: ['user-quota', userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`)

      if (!response.ok) {
        throw new Error(`获取用户配额失败: ${response.statusText}`)
      }

      const result = await response.json()
      return {
        currentMonthUsage: result.data.currentMonthUsage,
        monthlyTokenLimit: result.data.monthlyTokenLimit,
        totalTokenUsed: result.data.totalTokenUsed,
      }
    },
    staleTime: 1000 * 60, // 1分钟
    refetchInterval: 1000 * 60 * 5, // 5分钟自动刷新
  })
}
