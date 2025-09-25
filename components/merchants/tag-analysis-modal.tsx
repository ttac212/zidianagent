/**
 * 标签分析模态对话框组件
 */

'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tag,
  Hash,
  BarChart3,
  Star
} from 'lucide-react'

interface TagStats {
  tag: string
  count: number
  engagementSum: number
  avgEngagement: number
  contentIds: string[]
}

interface TagAnalysisData {
  totalTags: number
  uniqueTags: number
  topTags: TagStats[]
  categoryTags: Array<{
    category: string
    tags: string[]
    count: number
  }>
  engagementAnalysis: {
    highPerformingTags: TagStats[]
    growingTags: TagStats[]
  }
}

interface TagAnalysisModalProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  merchantId: string
  merchantName: string
}

export function TagAnalysisModal({ 
  open, 
  onOpenChange, 
  merchantId, 
  merchantName 
}: TagAnalysisModalProps) {
  const [data, setData] = useState<TagAnalysisData | null>(null)
  const [loading, setLoading] = useState(false)

  // 获取标签分析数据
  const fetchTagAnalysis = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/merchants/${merchantId}/tags`)
      const result = await response.json()
      
      if (response.ok) {
        setData(result)
      } else {
        }
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      } finally {
      setLoading(false)
    }
  }

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    return num.toLocaleString()
  }

  useEffect(() => {
    if (open && merchantId) {
      fetchTagAnalysis()
    }
  }, [open, merchantId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            {merchantName} - 标签分析
          </DialogTitle>
          <DialogDescription>
            深度分析商家内容标签使用情况和表现
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">标签总数</CardTitle>
                  <Hash className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalTags}</div>
                  <p className="text-xs text-muted-foreground">所有内容标签数量</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">独特标签</CardTitle>
                  <Tag className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.uniqueTags}</div>
                  <p className="text-xs text-muted-foreground">不重复标签种类</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">平均标签</CardTitle>
                  <BarChart3 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.uniqueTags > 0 ? Math.round(data.totalTags / data.uniqueTags) : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">每个标签平均使用次数</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="popular" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="popular">热门标签</TabsTrigger>
                <TabsTrigger value="performance">表现分析</TabsTrigger>
                <TabsTrigger value="categories">分类标签</TabsTrigger>
              </TabsList>

              <TabsContent value="popular" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>使用频率最高的标签</CardTitle>
                    <CardDescription>按使用次数排序的热门标签</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {data.topTags.slice(0, 10).map((tag, index) => (
                        <div key={tag.tag} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                            <div>
                              <div className="font-medium">#{tag.tag}</div>
                              <div className="text-xs text-muted-foreground">
                                {tag.count} 次使用 · 平均互动 {formatNumber(tag.avgEngagement)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{formatNumber(tag.engagementSum)}</div>
                            <div className="text-xs text-muted-foreground">总互动</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>高表现标签</CardTitle>
                      <CardDescription>平均互动量最高的标签</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {data.engagementAnalysis.highPerformingTags.slice(0, 8).map((tag, _index) => (
                          <div key={tag.tag} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Star className="h-3 w-3 text-yellow-500" />
                              <span className="text-sm font-medium">#{tag.tag}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{formatNumber(tag.avgEngagement)}</div>
                              <div className="text-xs text-muted-foreground">{tag.count}次使用</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>标签互动分布</CardTitle>
                      <CardDescription>不同标签的互动表现对比</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {data.topTags.slice(0, 6).map((tag, _index) => {
                          const maxEngagement = Math.max(...data.topTags.map(t => t.avgEngagement))
                          const percentage = (tag.avgEngagement / maxEngagement) * 100
                          
                          return (
                            <div key={tag.tag} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>#{tag.tag}</span>
                                <span>{formatNumber(tag.avgEngagement)}</span>
                              </div>
                              <Progress value={percentage} className="h-2" />
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="categories" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>标签分类分析</CardTitle>
                    <CardDescription>按内容类型分组的标签使用情况</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {data.categoryTags.map((category, _index) => (
                        <div key={category.category} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{category.category}</h4>
                            <Badge variant="secondary">{category.count} 个标签</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {category.tags.slice(0, 10).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                #{tag}
                              </Badge>
                            ))}
                            {category.tags.length > 10 && (
                              <Badge variant="outline" className="text-xs">
                                +{category.tags.length - 10} 更多
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">暂无标签分析数据</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}