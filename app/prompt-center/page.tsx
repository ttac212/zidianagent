/**
 * 提示词管理中心
 * 替代原 /merchants 列表页,专注于 MerchantPromptAsset 管理
 */

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText,
  Sparkles,
  Paperclip,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import type { PromptAssetType } from '@prisma/client'

// 最简类型定义
type PromptAsset = {
  id: string
  type: PromptAssetType
  title: string
  version: number
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  parentId: string | null
}

type ApiResponse = {
  assets: PromptAsset[]
  total: number
  page: number
  limit: number
  typeStats: {
    REPORT: number
    PROMPT: number
    ATTACHMENT: number
  }
}

const TYPE_LABELS: Record<PromptAssetType, string> = {
  REPORT: '分析报告',
  PROMPT: '提示词模板',
  ATTACHMENT: '附件资产'
}

const TYPE_ICONS: Record<PromptAssetType, typeof FileText> = {
  REPORT: FileText,
  PROMPT: Sparkles,
  ATTACHMENT: Paperclip
}

export default function PromptCenterPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [currentType, setCurrentType] = useState<PromptAssetType | 'ALL'>('ALL')
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 从URL参数获取merchantId
  const merchantId = searchParams.get('merchantId') || ''

  // 获取资产列表
  const fetchAssets = async () => {
    if (!merchantId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        merchantId,
        page: '1',
        limit: '50'
      })

      if (currentType !== 'ALL') {
        params.append('type', currentType)
      }

      const response = await fetch(`/api/prompt-assets?${params.toString()}`)

      if (!response.ok) {
        let message = '获取数据失败'
        try {
          const errorData = await response.json()
          message = errorData.error || message
        } catch (parseError) {
          console.error('[PromptCenter] Failed to parse error response', parseError)
        }

        if (response.status === 401 || response.status === 403) {
          message = '你没有访问该商家的权限，请联系管理员为你分配成员资格'
        }

        throw new Error(message)
      }

      const responseData = await response.json()
      setData(responseData.data)
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      fetchAssets()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, currentType, merchantId])

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>请先登录</CardTitle>
            </CardHeader>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-6 space-y-6">
        {/* 返回按钮 */}
        {merchantId && (
          <div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/merchants">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回商家列表
              </Link>
            </Button>
          </div>
        )}

        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">提示词管理中心</h1>
            <p className="text-muted-foreground mt-1">
              管理商家分析报告、提示词模板和附件资产
            </p>
          </div>
          {data && (
            <Badge variant="outline" className="px-3 py-1">
              共 {data.total} 项资产
            </Badge>
          )}
        </div>

        {/* 未选择商家提示 */}
        {!merchantId && (
          <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <AlertCircle className="h-5 w-5" />
                请先选择商家
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300">
                提示词管理功能需要关联到具体商家才能使用。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/merchants">
                  前往商家列表选择
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 统计卡片 - 仅在有merchantId时显示 */}
        {merchantId && data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">分析报告</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.typeStats.REPORT}</div>
                <p className="text-xs text-muted-foreground">商家深度分析报告</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">提示词模板</CardTitle>
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.typeStats.PROMPT}</div>
                <p className="text-xs text-muted-foreground">AI生成模板</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">附件资产</CardTitle>
                <Paperclip className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.typeStats.ATTACHMENT}</div>
                <p className="text-xs text-muted-foreground">参考附件</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab切换 - 仅在有merchantId时显示 */}
        {merchantId && (
          <Tabs value={currentType} onValueChange={(v) => setCurrentType(v as typeof currentType)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ALL">全部</TabsTrigger>
            <TabsTrigger value="REPORT">分析报告</TabsTrigger>
            <TabsTrigger value="PROMPT">提示词</TabsTrigger>
            <TabsTrigger value="ATTACHMENT">附件</TabsTrigger>
          </TabsList>

          <TabsContent value={currentType} className="mt-6">
            {/* 加载状态 */}
            {loading && (
              <div className="grid gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}

            {/* 错误状态 */}
            {error && (
              <Card className="border-red-500">
                <CardHeader>
                  <CardTitle className="text-red-600">加载失败</CardTitle>
                  <CardDescription>{error}</CardDescription>
                </CardHeader>
                {error.includes('权限') && (
                  <CardContent>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/merchants">
                        返回商家列表
                      </Link>
                    </Button>
                  </CardContent>
                )}
              </Card>
            )}

            {/* 资产列表 */}
            {!loading && !error && data && (
              <div className="grid gap-4">
                {data.assets.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>暂无数据</CardTitle>
                      <CardDescription>
                        该商家还没有{currentType !== 'ALL' ? TYPE_LABELS[currentType] : '资产'}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : (
                  data.assets.map((asset) => {
                    const Icon = TYPE_ICONS[asset.type]
                    return (
                      <Card key={asset.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <CardTitle className="flex items-center gap-2">
                                <Icon className="h-5 w-5" />
                                {asset.title}
                                <Badge variant="outline">v{asset.version}</Badge>
                                {asset.isActive && (
                                  <Badge variant="default" className="bg-green-600">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    激活
                                  </Badge>
                                )}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(asset.createdAt)}
                                </span>
                                <span>创建者: {asset.createdBy}</span>
                              </CardDescription>
                            </div>
                            <Badge variant="secondary">
                              {TYPE_LABELS[asset.type]}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              查看详情
                            </Button>
                            {!asset.isActive && (
                              <Button variant="ghost" size="sm">
                                设为激活
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
        )}
      </main>
    </div>
  )
}
