/**
 * 商家详情页面
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { EditMerchantDialog } from '@/components/merchants/edit-merchant-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Star,
  ExternalLink,
  Play,
  Clock,
  Hash,
  BarChart3,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import type {
  MerchantWithDetails,
  MerchantContent,
  MerchantDetailResponse,
  ContentListResponse,
  MerchantCategory
} from '@/types/merchant'
import {
  BUSINESS_TYPE_LABELS,
  MERCHANT_STATUS_LABELS,
  CONTENT_TYPE_LABELS
} from '@/types/merchant'
import { TagAnalysisModal } from '@/components/merchants/tag-analysis-modal'
import { unwrapApiResponse } from '@/lib/api/http-response'
import * as dt from '@/lib/utils/date-toolkit'

export default function MerchantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const merchantId = Array.isArray(params.id) ? params.id[0] : params.id
  const [merchant, setMerchant] = useState<MerchantWithDetails | null>(null)
  const [contents, setContents] = useState<MerchantContent[]>([])
  const [categories, setCategories] = useState<MerchantCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentFilters, setContentFilters] = useState({
    search: '',
    contentType: '',
    sortBy: 'publishedAt' as 'publishedAt' | 'diggCount' | 'commentCount' | 'collectCount' | 'shareCount' | 'engagement',
    sortOrder: 'desc' as 'asc' | 'desc',
    page: 1,
    limit: 20
  })
  const [tagAnalysisOpen, setTagAnalysisOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  // 获取商家详情
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchMerchant = useCallback(async () => {
    if (!merchantId) return

    try {
      setLoading(true)
      const response = await fetch(`/api/merchants/${merchantId}`)
      if (!response.ok) {
        console.error('加载商户详情失败', await response.text())
        return
      }

      const result = await response.json()
      const data = unwrapApiResponse<MerchantDetailResponse>(result)
      setMerchant(data.merchant)
      setContents(data.merchant.contents || [])
    } catch (error) {
      console.error('加载商户详情异常', error)
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  // 计算互动评分
  const getEngagementScore = useCallback((content: MerchantContent) => {
    return content.diggCount + content.commentCount * 2 + content.collectCount * 3 + content.shareCount * 4
  }, [])

  // 获取商家内容
  const fetchContents = useCallback(async () => {
    const targetId = merchant?.id ?? merchantId
    if (!targetId) return

    try {
      setContentLoading(true)
      const params = new URLSearchParams()

      // 保持与 API 兼容的排序字段
      let apiSortBy = contentFilters.sortBy
      if (contentFilters.sortBy === 'engagement' || contentFilters.sortBy === 'shareCount') {
        apiSortBy = 'publishedAt'
      }

      Object.entries(contentFilters).forEach(([key, value]) => {
        if (value && value !== '' && key !== 'sortBy') {
          if (key === 'sortBy' && (contentFilters.sortBy === 'engagement' || contentFilters.sortBy === 'shareCount')) {
            return
          }
          params.append(key, String(value))
        }
      })

      params.append('sortBy', apiSortBy)
      params.append('sortOrder', contentFilters.sortOrder)

      const response = await fetch(`/api/merchants/${targetId}/contents?${params.toString()}`)
      if (!response.ok) {
        console.error('加载商户内容失败', await response.text())
        return
      }

      const result = await response.json()
      const data = unwrapApiResponse<ContentListResponse>(result)
      let sortedContents = data.contents || []

      if (contentFilters.sortBy === 'engagement') {
        sortedContents = [...sortedContents].sort((a, b) => {
          const scoreA = getEngagementScore(a)
          const scoreB = getEngagementScore(b)
          return contentFilters.sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB
        })
      } else if (contentFilters.sortBy === 'shareCount') {
        sortedContents = [...sortedContents].sort((a, b) => {
          return contentFilters.sortOrder === 'desc'
            ? b.shareCount - a.shareCount
            : a.shareCount - b.shareCount
        })
      }

      setContents(sortedContents)
    } catch (error) {
      console.error('加载商户内容异常', error)
    } finally {
      setContentLoading(false)
    }
  }, [contentFilters, merchant?.id, merchantId, getEngagementScore])

  useEffect(() => {
    fetchMerchant()
    fetchCategories()
  }, [fetchMerchant])

  useEffect(() => {
    if (merchant) {
      fetchContents()
    }
  }, [fetchContents, merchant])

  // 获取分类列表
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/merchants/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('获取分类列表失败', error)
    }
  }

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    return num.toLocaleString()
  }

  // 格式化时长
  const formatDuration = (duration: string | null) => {
    if (!duration) return '未知'
    return duration.replace(/^00:/, '')  // 移除开头的00:
  }

  // 导出数据
  const handleExport = async (type: 'content' | 'analytics' | 'tags') => {
    if (!merchant) return
    
    try {
      setExportLoading(true)
      const response = await fetch(`/api/merchants/${merchant.id}/export?type=${type}&format=csv`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // 从响应头获取文件名
        const contentDisposition = response.headers.get('content-disposition')
        let filename = `${merchant.name}_${type}_${dt.toISO().split('T')[0]}.csv`
        
        if (contentDisposition) {
          const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
          if (matches && matches[1]) {
            filename = decodeURIComponent(matches[1].replace(/['"]/g, ''))
          }
        }
        
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        }
    } catch (_error) {
      } finally {
      setExportLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    )
  }

  if (!merchant) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold text-muted-foreground">商家不存在</h1>
        <Button className="mt-4" onClick={() => router.back()}>
          返回
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{merchant.name}</h1>
          <p className="text-muted-foreground mt-1">
            商家详情和内容分析
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主要内容区域 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  基本信息
                </CardTitle>
                <EditMerchantDialog
                  merchant={{
                    id: merchant.id,
                    name: merchant.name,
                    description: merchant.description,
                    location: merchant.location,
                    address: merchant.address,
                    businessType: merchant.businessType,
                    status: merchant.status,
                    categoryId: merchant.categoryId,
                  }}
                  categories={categories}
                  onSuccess={() => {
                    fetchMerchant()
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">商家名称</label>
                  <div className="font-medium">{merchant.name}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">业务类型</label>
                  <div className="font-medium">{BUSINESS_TYPE_LABELS[merchant.businessType]}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">所在地区</label>
                  <div className="font-medium">{merchant.location || '未指定'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">详细地址</label>
                  <div className="font-medium">{merchant.address || '未指定'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">状态</label>
                  <Badge
                    variant={merchant.status === 'ACTIVE' ? 'default' : 'secondary'}
                    className="ml-1"
                  >
                    {MERCHANT_STATUS_LABELS[merchant.status]}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">数据来源</label>
                  <div className="font-medium">{merchant.dataSource}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">创建时间</label>
                  <div className="font-medium">{new Date(merchant.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">更新时间</label>
                  <div className="font-medium">{new Date(merchant.updatedAt).toLocaleString()}</div>
                </div>
              </div>

              {merchant.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">描述</label>
                  <div className="mt-1 whitespace-pre-wrap">{merchant.description}</div>
                </div>
              )}

              {merchant.category && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">分类</label>
                  <Badge
                    variant="outline"
                    className="ml-1"
                    style={{
                      borderColor: merchant.category.color || '#6366f1',
                      color: merchant.category.color || '#6366f1'
                    }}
                  >
                    {merchant.category.name}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 内容列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  内容列表
                </span>
                <Badge variant="outline">{merchant.totalContentCount} 条内容</Badge>
              </CardTitle>
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="搜索内容..."
                  value={contentFilters.search}
                  onChange={(e) => setContentFilters({ ...contentFilters, search: e.target.value, page: 1 })}
                  className="flex-1 max-w-sm"
                />
                
                <Select
                  value={contentFilters.sortBy}
                  onValueChange={(value: any) => setContentFilters({ ...contentFilters, sortBy: value, page: 1 })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="选择排序方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="publishedAt">发布时间</SelectItem>
                    <SelectItem value="diggCount">点赞数</SelectItem>
                    <SelectItem value="commentCount">评论数</SelectItem>
                    <SelectItem value="collectCount">收藏数</SelectItem>
                    <SelectItem value="shareCount">分享数</SelectItem>
                    <SelectItem value="engagement">互动评分</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setContentFilters({ 
                    ...contentFilters, 
                    sortOrder: contentFilters.sortOrder === 'desc' ? 'asc' : 'desc',
                    page: 1 
                  })}
                  title={contentFilters.sortOrder === 'desc' ? '降序' : '升序'}
                >
                  {contentFilters.sortOrder === 'desc' ? (
                    <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {contentLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Separator />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {contents.map((content) => (
                    <div key={content.id} className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium line-clamp-2 mb-1">
                            {content.title || '无标题'}
                          </h4>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {content.publishedAt ? new Date(content.publishedAt).toLocaleDateString() : '未知'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {CONTENT_TYPE_LABELS[content.contentType]}
                            </span>
                            {content.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(content.duration)}
                              </span>
                            )}
                            {content.hasTranscript && (
                              <Badge variant="outline" className="text-xs">
                                有转录
                              </Badge>
                            )}
                          </div>
                        </div>
                        {content.shareUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={content.shareUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-5 gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Heart className="h-3 w-3 text-red-500" />
                          <span>{formatNumber(content.diggCount)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3 text-blue-500" />
                          <span>{formatNumber(content.commentCount)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          <span>{formatNumber(content.collectCount)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Share2 className="h-3 w-3 text-green-500" />
                          <span>{formatNumber(content.shareCount)}</span>
                        </div>
                        <div className="flex items-center gap-1" title="互动评分">
                          <BarChart3 className="h-3 w-3 text-purple-500" />
                          <span className="font-medium">{formatNumber(getEngagementScore(content))}</span>
                        </div>
                      </div>
                      
                      {/* 标签 */}
                      {content.parsedTags && content.parsedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {content.parsedTags.map((tag: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {/* 转录文本预览 */}
                      {content.transcript && (
                        <details className="group">
                          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                            查看转录文本
                          </summary>
                          <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm max-h-32 overflow-y-auto">
                            {content.transcript.substring(0, 200)}
                            {content.transcript.length > 200 && '...'}
                          </div>
                        </details>
                      )}
                      
                      <Separator />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 统计数据 */}
          <Card>
            <CardHeader>
              <CardTitle>数据统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">总内容数</span>
                  <span className="font-medium">{merchant.totalContentCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">总点赞数</span>
                  <span className="font-medium text-red-600">{formatNumber(merchant.totalDiggCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">总评论数</span>
                  <span className="font-medium text-blue-600">{formatNumber(merchant.totalCommentCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">总收藏数</span>
                  <span className="font-medium text-yellow-600">{formatNumber(merchant.totalCollectCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">总分享数</span>
                  <span className="font-medium text-green-600">{formatNumber(merchant.totalShareCount)}</span>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">平均互动率</span>
                  <span className="font-medium">
                    {merchant.totalContentCount > 0 
                      ? Math.round(
                          (merchant.totalEngagement ?? (
                            merchant.totalDiggCount +
                            merchant.totalCommentCount +
                            merchant.totalCollectCount +
                            merchant.totalShareCount
                          )) / merchant.totalContentCount
                        ).toLocaleString()
                      : 0
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">最后采集</span>
                  <span className="text-sm">
                    {merchant.lastCollectedAt 
                      ? new Date(merchant.lastCollectedAt).toLocaleDateString() 
                      : '未知'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 快捷操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快捷操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" asChild>
                <a href={`/merchants/${merchant.id}/analytics`}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  数据分析
                </a>
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setTagAnalysisOpen(true)}>
                <Hash className="h-4 w-4 mr-2" />
                标签分析
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full" disabled={exportLoading}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {exportLoading ? '导出中...' : '导出数据'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('content')}>
                    导出内容数据
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('analytics')}>
                    导出分析数据
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('tags')}>
                    导出标签数据
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 标签分析模态框 */}
      <TagAnalysisModal
        open={tagAnalysisOpen}
        onOpenChange={setTagAnalysisOpen}
        merchantId={merchant.id}
        merchantName={merchant.name}
      />
    </div>
  )
}










