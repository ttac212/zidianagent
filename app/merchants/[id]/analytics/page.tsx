/**
 * 商家数据分析页面
 * /merchants/[id]/analytics
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Heart,
  MessageCircle,
  Share2,
  Star,
  Eye
} from 'lucide-react'
import { unwrapApiResponse } from '@/lib/api/http-response'
import type { MerchantWithDetails } from '@/types/merchant'

// 分析数据类型
interface AnalyticsData {
  merchant: MerchantWithDetails
  engagementStats: {
    totalEngagement: number
    avgEngagementPerContent: number
    engagementTrend: number // 增长率
  }
  contentStats: {
    totalContent: number
    videoCount: number
    otherCount: number
    withTranscript: number
  }
  timelineStats: {
    date: string
    diggCount: number
    commentCount: number
    collectCount: number
    shareCount: number
    contentCount: number
  }[]
  topContent: Array<{
    id: string
    title: string
    diggCount: number
    commentCount: number
    collectCount: number
    shareCount: number
    engagementScore: number
    publishedAt: string | null
  }>
  tagStats: Array<{
    tag: string
    count: number
    engagementSum: number
  }>
}

export default function MerchantAnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const merchantId = Array.isArray(params.id) ? params.id[0] : params.id

  // 获取分析数据
  const fetchAnalytics = useCallback(async () => {
    if (!merchantId) return
    try {
      setLoading(true)
      const response = await fetch(`/api/merchants/${merchantId}/analytics`)
      if (!response.ok) {
        console.error('获取商户分析失败', await response.text())
        return
      }

      const result = await response.json()
      const data = unwrapApiResponse<AnalyticsData>(result)
      setAnalytics(data)
    } catch (error) {
      console.error('获取商户分析异常', error)
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    return num.toLocaleString()
  }

  // 计算互动评分
  const getEngagementScore = (content: any) => {
    return content.diggCount + content.commentCount * 2 + content.collectCount * 3 + content.shareCount * 4
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold text-muted-foreground">数据分析加载失败</h1>
        <Button className="mt-4" onClick={() => router.back()}>
          返回
        </Button>
      </div>
    )
  }

  const { merchant, engagementStats, contentStats, topContent, tagStats } = analytics

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{merchant.name} - 数据分析</h1>
          <p className="text-muted-foreground mt-1">
            深度分析商家内容表现和用户互动数据
          </p>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总互动量</CardTitle>
            <Heart className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(engagementStats.totalEngagement)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {engagementStats.engagementTrend >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={engagementStats.engagementTrend >= 0 ? "text-green-500" : "text-red-500"}>
                {engagementStats.engagementTrend >= 0 ? '+' : ''}{engagementStats.engagementTrend.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均互动率</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(engagementStats.avgEngagementPerContent)}</div>
            <p className="text-xs text-muted-foreground">每条内容平均互动</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">内容总量</CardTitle>
            <Eye className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contentStats.totalContent}</div>
            <p className="text-xs text-muted-foreground">
              视频 {contentStats.videoCount} · 其他 {contentStats.otherCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">转录覆盖率</CardTitle>
            <MessageCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contentStats.totalContent > 0 
                ? Math.round((contentStats.withTranscript / contentStats.totalContent) * 100)
                : 0
              }%
            </div>
            <Progress 
              value={contentStats.totalContent > 0 
                ? (contentStats.withTranscript / contentStats.totalContent) * 100 
                : 0
              } 
              className="mt-2" 
            />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="engagement" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="engagement">互动分析</TabsTrigger>
          <TabsTrigger value="content">内容分析</TabsTrigger>
          <TabsTrigger value="tags">标签分析</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 互动分布 */}
            <Card>
              <CardHeader>
                <CardTitle>互动类型分布</CardTitle>
                <CardDescription>不同互动行为的统计分析</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm flex items-center gap-2">
                      <Heart className="h-3 w-3 text-red-500" />
                      点赞
                    </span>
                    <span className="font-medium">{formatNumber(merchant.totalDiggCount)}</span>
                  </div>
                  <Progress value={(merchant.totalDiggCount / engagementStats.totalEngagement) * 100} />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm flex items-center gap-2">
                      <MessageCircle className="h-3 w-3 text-blue-500" />
                      评论
                    </span>
                    <span className="font-medium">{formatNumber(merchant.totalCommentCount)}</span>
                  </div>
                  <Progress value={(merchant.totalCommentCount / engagementStats.totalEngagement) * 100} />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm flex items-center gap-2">
                      <Star className="h-3 w-3 text-yellow-500" />
                      收藏
                    </span>
                    <span className="font-medium">{formatNumber(merchant.totalCollectCount)}</span>
                  </div>
                  <Progress value={(merchant.totalCollectCount / engagementStats.totalEngagement) * 100} />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm flex items-center gap-2">
                      <Share2 className="h-3 w-3 text-green-500" />
                      分享
                    </span>
                    <span className="font-medium">{formatNumber(merchant.totalShareCount)}</span>
                  </div>
                  <Progress value={(merchant.totalShareCount / engagementStats.totalEngagement) * 100} />
                </div>
              </CardContent>
            </Card>

            {/* 热门内容 */}
            <Card>
              <CardHeader>
                <CardTitle>热门内容 TOP 5</CardTitle>
                <CardDescription>按互动评分排名的高表现内容</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topContent.slice(0, 5).map((content, index) => (
                    <div key={content.id} className="space-y-2">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="text-xs shrink-0">#{index + 1}</Badge>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-sm line-clamp-2 mb-1">
                            {content.title || '无标题'}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {formatNumber(content.diggCount)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {formatNumber(content.commentCount)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {formatNumber(content.collectCount)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            互动评分: {formatNumber(getEngagementScore(content))}
                          </div>
                        </div>
                      </div>
                      {index < 4 && <Separator />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>内容表现概览</CardTitle>
              <CardDescription>内容数量和类型分析</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-blue-600">{contentStats.videoCount}</div>
                  <p className="text-sm text-muted-foreground">视频内容</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-purple-600">{contentStats.otherCount}</div>
                  <p className="text-sm text-muted-foreground">其他内容</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-green-600">{contentStats.withTranscript}</div>
                  <p className="text-sm text-muted-foreground">带转录内容</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <h4 className="font-medium">内容质量指标</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>转录覆盖率</span>
                      <span>{Math.round((contentStats.withTranscript / contentStats.totalContent) * 100)}%</span>
                    </div>
                    <Progress value={(contentStats.withTranscript / contentStats.totalContent) * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>视频内容占比</span>
                      <span>{Math.round((contentStats.videoCount / contentStats.totalContent) * 100)}%</span>
                    </div>
                    <Progress value={(contentStats.videoCount / contentStats.totalContent) * 100} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>热门标签</CardTitle>
              <CardDescription>标签使用频率和互动表现分析</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tagStats.slice(0, 10).map((tag, index) => (
                  <div key={tag.tag} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs">#{index + 1}</Badge>
                      <div>
                        <div className="font-medium">#{tag.tag}</div>
                        <div className="text-xs text-muted-foreground">
                          {tag.count} 次使用 · {formatNumber(tag.engagementSum)} 互动
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{formatNumber(Math.round(tag.engagementSum / tag.count))}</div>
                      <div className="text-xs text-muted-foreground">平均互动</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

