/**
 * 商家内容TOP5洞察 React Query Hook
 * 获取近6个月内容的TOP5数据（点赞/评论/互动）
 */

import { useQuery } from '@tanstack/react-query'

// ==================== Types ====================

export interface TopInsightComment {
  id: string
  text: string
  diggCount: number
  replyCount: number
  createdAt: Date | string
}

export interface TopInsightEntry {
  id: string
  title: string
  diggCount: number
  commentCount: number
  collectCount: number
  shareCount: number
  engagementScore: number
  publishedAt: Date | string | null
  shareUrl: string | null
  comments: TopInsightComment[]
}

export interface TopInsightsResponse {
  topLikes: TopInsightEntry[]
  topComments: TopInsightEntry[]
  topEngagement: TopInsightEntry[]
  totalContents: number
  dateRange: {
    from: string
    to: string
  }
}

// ==================== Query Keys ====================

export const topInsightsKeys = {
  all: ['merchant-top-insights'] as const,
  detail: (merchantId: string) => [...topInsightsKeys.all, merchantId] as const,
}

// ==================== API Functions ====================

async function fetchTopInsights(merchantId: string): Promise<TopInsightsResponse> {
  const response = await fetch(`/api/merchants/${merchantId}/top-insights`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = '获取TOP5洞察失败'

    try {
      const errorData = JSON.parse(errorText)
      errorMessage = errorData.error || errorMessage
    } catch {
      errorMessage = errorText || errorMessage
    }

    throw new Error(errorMessage)
  }

  const data = await response.json()
  return data.data
}

// ==================== React Query Hook ====================

export function useMerchantTopInsights(merchantId: string) {
  return useQuery({
    queryKey: topInsightsKeys.detail(merchantId),
    queryFn: () => fetchTopInsights(merchantId),
    staleTime: 5 * 60 * 1000, // 5分钟内数据被认为是新鲜的
    gcTime: 10 * 60 * 1000, // 10分钟后清除缓存
    retry: 1,
    enabled: Boolean(merchantId), // 只有当merchantId存在时才执行查询
  })
}
