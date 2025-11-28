/**
 * 商家详情页面
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { EditMerchantDialog } from '@/components/merchants/edit-merchant-dialog'
import { MerchantProfileCard } from '@/components/merchants/merchant-profile-card'
import { BenchmarkDialog } from '@/components/merchants/benchmark-dialog'
import { BatchTranscribeDialog } from '@/components/merchants/batch-transcribe-dialog'
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
  ArrowDown,
  RefreshCw
} from 'lucide-react'
import type { MerchantContent } from '@/types/merchant'
import {
  BUSINESS_TYPE_LABELS,
  MERCHANT_STATUS_LABELS,
  CONTENT_TYPE_LABELS
} from '@/types/merchant'
import { TagAnalysisModal } from '@/components/merchants/tag-analysis-modal'
import { MonitoringConfig } from '@/components/merchants/monitoring-config'
import {
  useMerchantCategoriesQuery,
  useMerchantContentsQuery,
  useMerchantDetailQuery,
  type MerchantContentQueryFilters
} from '@/hooks/api/use-merchants-query'
import * as dt from '@/lib/utils/date-toolkit'
import { parseStoredProfile } from '@/lib/ai/profile-parser'

export default function MerchantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const merchantId = Array.isArray(params.id) ? params.id[0] : params.id
  const goBackToMerchants = () => {
    router.push('/merchants')
  }
  const [contentFilters, setContentFilters] = useState<MerchantContentQueryFilters>({
    search: '',
    contentType: undefined,
    sortBy: 'publishedAt',
    sortOrder: 'desc',
    page: 1,
    limit: 20
  })
  const merchantQuery = useMerchantDetailQuery(merchantId)
  const merchant = merchantQuery.data
  const merchantLoading = merchantQuery.status === 'pending'
  const loading = merchantLoading
  const contentsQuery = useMerchantContentsQuery(merchantId, contentFilters)
  // 累积加载的内容（用于分页追加模式）
  const [accumulatedContents, setAccumulatedContents] = useState<MerchantContent[]>([])
  const prevFiltersRef = useRef(contentFilters)

  // 当筛选/排序条件变化时重置累积内容，当翻页时追加内容
  useEffect(() => {
    const newContents = contentsQuery.data?.contents ?? []
    const prevFilters = prevFiltersRef.current

    // 判断是否只是翻页（其他条件都相同）
    const isOnlyPageChange =
      prevFilters.search === contentFilters.search &&
      prevFilters.contentType === contentFilters.contentType &&
      prevFilters.sortBy === contentFilters.sortBy &&
      prevFilters.sortOrder === contentFilters.sortOrder &&
      prevFilters.page !== contentFilters.page

    if (isOnlyPageChange && (contentFilters.page ?? 1) > 1) {
      // 翻页：追加新内容（去重）
      setAccumulatedContents(prev => {
        const existingIds = new Set(prev.map(c => c.id))
        const uniqueNew = newContents.filter(c => !existingIds.has(c.id))
        return [...prev, ...uniqueNew]
      })
    } else {
      // 筛选/排序变化或首次加载：重置为新内容
      setAccumulatedContents(newContents)
    }

    prevFiltersRef.current = contentFilters
  }, [contentsQuery.data?.contents, contentFilters])

  const contents = accumulatedContents
  const contentsInitialLoading = contentsQuery.status === 'pending' && !contentsQuery.data
  const contentsFetching = contentsQuery.isFetching
  const contentLoading = contentsInitialLoading || contentsFetching
  const { refetch: refetchMerchant } = merchantQuery
  const { refetch: refetchContents } = contentsQuery
  const categoriesQuery = useMerchantCategoriesQuery()
  const categories = categoriesQuery.data ?? []
  const [tagAnalysisOpen, setTagAnalysisOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [syncingContentId, setSyncingContentId] = useState<string | null>(null)
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([])
  const [selectMode, setSelectMode] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [aligning, setAligning] = useState(false)

  const getEngagementScore = useCallback((content: MerchantContent) => {
    return content.diggCount + content.commentCount * 2 + content.collectCount * 3 + content.shareCount * 4
  }, [])


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

  const buildAlignmentPrompt = (payload: any) => {
    const m = payload.merchant
    const p = payload.profile
    const audience = payload.audience
    const briefParsed = p ? parseStoredProfile(p).brief : null
    const manualNotes = p?.manualNotes || '无'

    const briefLines = briefParsed ? [
      `简介：${briefParsed.intro || '无'}`,
      `核心卖点：${(briefParsed.sellingPoints || []).join('；') || '无'}`,
      `使用场景：${(briefParsed.usageScenarios || []).join('；') || '无'}`,
      `目标用户：年龄 ${briefParsed.audienceProfile?.age || '未知'} / 性别 ${briefParsed.audienceProfile?.gender || '未知'} / 兴趣 ${(briefParsed.audienceProfile?.interests || []).join('、') || '无'} / 行为 ${briefParsed.audienceProfile?.behaviors || '无'}`,
      `品牌语调：${briefParsed.brandTone || '未指定'}`
    ] : ['暂无Brief（请补充后再用AI对齐）']

    // 提取结构化客群分析数据
    let audienceSection = ''
    if (audience) {
      const sections = []

      // 1. 聚合统计摘要
      if (audience.videosAnalyzed || audience.commentsAnalyzed) {
        sections.push(`数据来源：分析了${audience.videosAnalyzed || 0}个视频的${audience.commentsAnalyzed || 0}条评论`)
      }

      // 2. 地域分布（JSON解析）
      if (audience.locationStats) {
        try {
          const locations = JSON.parse(audience.locationStats)
          if (Array.isArray(locations) && locations.length > 0) {
            const topLocations = locations.slice(0, 5).map((loc: any) =>
              `${loc.location}(${loc.percentage || 0}%)`
            ).join('、')
            sections.push(`地域分布TOP5：${topLocations}`)
          }
        } catch (_e) {
          // 解析失败则跳过
        }
      }

      // 3. 用户痛点（JSON解析）
      if (audience.painPoints) {
        try {
          const painPoints = JSON.parse(audience.painPoints)
          if (Array.isArray(painPoints) && painPoints.length > 0) {
            const points = painPoints.slice(0, 3).join('；')
            sections.push(`核心痛点：${points}`)
          }
        } catch (_e) {
          // 解析失败则跳过
        }
      }

      // 4. 改进建议（JSON解析）
      if (audience.suggestions) {
        try {
          const suggestions = JSON.parse(audience.suggestions)
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            const items = suggestions.slice(0, 3).map((s: any) =>
              s.suggestion || s
            ).join('；')
            sections.push(`优化建议：${items}`)
          }
        } catch (_e) {
          // 解析失败则跳过
        }
      }

      // 5. 完整Markdown报告（优先人工修订版）
      const fullMarkdown = audience.manualMarkdown || audience.rawMarkdown
      if (fullMarkdown) {
        sections.push('')
        sections.push('【完整分析报告】')
        sections.push(fullMarkdown)
      }

      audienceSection = sections.length > 0 ? sections.join('\n') : '暂无客群分析'
    } else {
      audienceSection = '暂无客群分析（建议先在商家详情页进行客群分析）'
    }

    return [
      '你是编导对齐助手。目标：基于下方数据快速理解商家，输出创作前对齐结论。',
      '输出格式：1) 商家定位与卖点 2) 受众画像/场景 3) 禁忌与注意事项 4) 对接提问清单（给编导提问的具体问题，简短）。',
      '【商家基本信息】',
      `名称：${m?.name ?? ''} | 类目：${m?.category?.name ?? '未分类'} | 地区：${m?.location ?? '未指定'} | 状态：${m?.status ?? ''}`,
      `描述：${m?.description || '无'}`,
      '【Brief（优先人工校对）】',
      ...briefLines,
      '【人工补充信息（真实沟通高频问题）】',
      manualNotes,
      '【客群分析】',
      audienceSection
    ].join('\n')
  }

  const handleAlignToWorkspace = async () => {
    if (!merchant) return

    // ✅ 权限检查：确保用户已登录
    if (!session?.user) {
      toast.error('请先登录', {
        description: '需要登录后才能使用对齐功能'
      })
      router.push('/login')
      return
    }

    try {
      setAligning(true)
      const res = await fetch(`/api/merchants/${merchant.id}/briefing`)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || '获取对齐数据失败')
      }
      const payload = await res.json()
      const briefing = payload.data || payload
      const message = buildAlignmentPrompt(briefing)
      const key = `prefill-${merchant.id}-${Date.now()}`
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(key, JSON.stringify({
          message,
          title: `商家对齐-${merchant.name}`
        }))
        // 使用 window.location.href 确保 sessionStorage 写入完成后再导航
        window.location.href = `/workspace?prefill=${encodeURIComponent(key)}`
      }
    } catch (error: any) {
      toast.error(error?.message || '推送失败')
    } finally {
      setAligning(false)
    }
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
        toast.error('导出失败', {
          description: response.statusText || '无法导出数据，请稍后重试'
        })
      }
    } catch (error: any) {
      toast.error('导出失败', {
        description: error?.message || '网络错误，请稍后重试'
      })
    } finally {
      setExportLoading(false)
    }
  }

  // 批量选择功能
  const toggleSelectContent = (contentId: string) => {
    setSelectedContentIds((prev) =>
      prev.includes(contentId)
        ? prev.filter((id) => id !== contentId)
        : [...prev, contentId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedContentIds.length === contents.length) {
      setSelectedContentIds([])
    } else {
      setSelectedContentIds(contents.map((c: MerchantContent) => c.id))
    }
  }

  const clearSelection = () => {
    setSelectedContentIds([])
    setSelectMode(false)
  }

  // 立即同步商家数据
  const handleSyncMerchant = async () => {
    if (!merchant || syncing) return

    try {
      setSyncing(true)
      toast.info('开始同步数据...', {
        description: '正在从抖音获取最新数据'
      })

      const response = await fetch('/api/merchants/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantIds: [merchant.id],
          limit: 50
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '同步失败')
      }

      const data = await response.json()
      const result = data.data?.results?.[0]

      if (result?.success) {
        toast.success('数据同步成功', {
          description: `新增 ${result.newVideos} 个视频，更新 ${result.updatedVideos} 个视频`
        })
        // 刷新商家和内容数据
        await Promise.all([refetchMerchant(), refetchContents()])
      } else {
        const errorMsg = result?.errors?.[0] || '同步失败'
        toast.error('同步失败', {
          description: errorMsg
        })
      }
    } catch (error: any) {
      console.error('同步商家数据失败:', error)
      toast.error('同步失败', {
        description: error.message || '无法同步数据，请稍后重试'
      })
    } finally {
      setSyncing(false)
    }
  }

  // 同步单个视频数据
  const handleSyncContent = async (contentId: string) => {
    if (!merchant) return

    try {
      setSyncingContentId(contentId)
      const response = await fetch(
        `/api/merchants/${merchant.id}/contents/${contentId}/sync`,
        { method: 'POST' }
      )

      if (response.ok) {
        const _result = await response.json()
        // 刷新内容列表
        await refetchContents()
        toast.success('视频数据已更新', {
          description: '标题、互动数据已同步为最新版本'
        })
      } else {
        const error = await response.text()
        console.error('同步失败:', error)
        toast.error('同步失败', {
          description: error || '无法更新视频数据'
        })
      }
    } catch (error) {
      console.error('同步异常:', error)
      toast.error('同步异常', {
        description: '网络错误或服务异常'
      })
    } finally {
      setSyncingContentId(null)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* 固定骨架屏高度避免布局偏移 */}
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!merchant) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold text-muted-foreground">商家不存在</h1>
        <Button className="mt-4" onClick={goBackToMerchants}>
          返回
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={goBackToMerchants}>
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
        {/* 立即同步按钮（仅管理员可见） */}
        {session?.user?.role === 'ADMIN' && (
          <Button
            onClick={handleSyncMerchant}
            disabled={syncing}
            className="gap-2"
            variant="default"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '同步中...' : '立即同步数据'}
          </Button>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>AI对齐助手</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            聚合商家基本信息、创作档案（优先人工校对）、人工补充、高频客群分析，一键推送到工作台并自动触发AI回复，帮助编导创作前对齐。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleAlignToWorkspace}
              disabled={aligning || loading}
            >
              {aligning ? '准备对齐中...' : '一键推送到工作台并对齐'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 商家创作档案 */}
      <MerchantProfileCard
        merchantId={merchant.id}
        merchantName={merchant.name}
        totalContentCount={merchant.totalContentCount}
        isAdmin={session?.user?.role === 'ADMIN'}
      />

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
                    refetchMerchant()
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
                  <div className="font-medium">{dt.parse(merchant.createdAt)?.toLocaleString() ?? '未知'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">更新时间</label>
                  <div className="font-medium">{dt.parse(merchant.updatedAt)?.toLocaleString() ?? '未知'}</div>
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
                <div className="flex items-center gap-2">
                  {selectedContentIds.length > 0 && (
                    <Badge variant="secondary">
                      已选择 {selectedContentIds.length} 个视频
                    </Badge>
                  )}
                  <Badge variant="outline">{merchant.totalContentCount} 条内容</Badge>
                </div>
              </CardTitle>
              <div className="flex gap-2 items-center flex-wrap">
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

                {/* 批量选择控制 */}
                {session?.user?.role === 'ADMIN' && (
                  <>
                    <Button
                      variant={selectMode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectMode(!selectMode)
                        if (selectMode) {
                          clearSelection()
                        }
                      }}
                    >
                      {selectMode ? '取消选择' : '批量选择'}
                    </Button>

                    {selectMode && contents.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleSelectAll}
                      >
                        {selectedContentIds.length === contents.length ? '取消全选' : '全选'}
                      </Button>
                    )}

                    {selectedContentIds.length > 0 && (
                      <BatchTranscribeDialog
                        merchantId={merchant.id}
                        merchantName={merchant.name}
                        contentIds={selectedContentIds}
                        onSuccess={() => {
                          clearSelection()
                          refetchContents()
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {contentLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2 h-[60px]">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Separator />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {contents.map((content: MerchantContent) => {
                    const isSelected = selectedContentIds.includes(content.id)
                    return (
                      <div
                        key={content.id}
                        className={`space-y-3 rounded-lg p-4 transition-all ${
                          selectMode && session?.user?.role === 'ADMIN'
                            ? 'cursor-pointer hover:bg-accent/50 border-2'
                            : 'border-2 border-transparent'
                        } ${
                          isSelected
                            ? 'bg-primary/15 border-primary shadow-sm'
                            : 'bg-background border-border/40'
                        }`}
                        onClick={() => {
                          if (selectMode && session?.user?.role === 'ADMIN') {
                            toggleSelectContent(content.id)
                          }
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-start gap-3 mb-1">
                              {/* 选中状态指示器 */}
                              {selectMode && session?.user?.role === 'ADMIN' && (
                                <div className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-primary border-primary'
                                    : 'border-muted-foreground/30 bg-background'
                                }`}>
                                  {isSelected && (
                                    <svg
                                      className="w-3.5 h-3.5 text-primary-foreground"
                                      fill="none"
                                      strokeWidth="3"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  )}
                                </div>
                              )}
                              <h4 className="font-medium line-clamp-2 flex-1">
                                {content.title || '无标题'}
                              </h4>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {dt.parse(content.publishedAt)?.toLocaleDateString() ?? '未知'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {CONTENT_TYPE_LABELS[content.contentType as keyof typeof CONTENT_TYPE_LABELS]}
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
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => {
                              // 防止点击按钮时触发选择
                              if (selectMode && session?.user?.role === 'ADMIN') {
                                e.stopPropagation()
                              }
                            }}
                          >
                          {/* 仅管理员可见的更新按钮 */}
                          {session?.user?.role === 'ADMIN' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSyncContent(content.id)}
                              disabled={syncingContentId === content.id}
                              title="更新视频数据"
                            >
                              <RefreshCw
                                className={`h-4 w-4 ${
                                  syncingContentId === content.id ? 'animate-spin' : ''
                                }`}
                              />
                            </Button>
                          )}
                          {content.shareUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={content.shareUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
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

                      {/* 转录文本完整显示 */}
                      {content.transcript && (
                        <details className="group">
                          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                            查看转录文本 ({content.transcript.length} 字)
                          </summary>
                          <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm max-h-64 overflow-y-auto whitespace-pre-wrap">
                            {content.transcript}
                          </div>
                        </details>
                      )}
                    </div>
                    )
                  })}
                </div>
              )}

              {/* 分页信息和加载更多 */}
              {!contentLoading && contents.length > 0 && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <div className="text-sm text-muted-foreground">
                    显示 {contents.length} / {contentsQuery.data?.total ?? 0} 条内容
                  </div>
                  {contentsQuery.data?.hasMore && (
                    <Button
                      variant="outline"
                      onClick={() => setContentFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                      disabled={contentsFetching}
                    >
                      {contentsFetching ? '加载中...' : '加载更多'}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 自动同步配置 */}
          {session?.user?.role === 'ADMIN' && (
            <MonitoringConfig
              merchantId={merchant.id}
              initialEnabled={merchant.monitoringEnabled || false}
              initialInterval={merchant.syncIntervalSeconds || 21600}
            />
          )}

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
                    {dt.parse(merchant.lastCollectedAt)?.toLocaleDateString() ?? '未知'}
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
              <BenchmarkDialog
                merchantId={merchant.id}
                merchantName={merchant.name}
              />
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










