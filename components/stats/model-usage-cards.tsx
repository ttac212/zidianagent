"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Brain, Search, Zap, HelpCircle } from "lucide-react"
import { getProviderColor, formatStatsNumber } from "@/lib/ai/model-stats-helper"

interface ModelUsageData {
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

interface ModelUsageCardsProps {
  modelStats: Record<string, ModelUsageData>
  totalStats: {
    totalTokens: number
    totalRequests: number
    formattedTokens: string
    formattedRequests: string
  }
  loading: boolean
  className?: string
}

// 获取提供商图标组件
function getProviderIconComponent(provider: string) {
  switch (provider.toLowerCase()) {
    case 'claude':
      return Brain
    case 'google':
      return Search
    case 'openai':
      return Zap
    default:
      return HelpCircle
  }
}

// 获取提供商徽章颜色
function getProviderBadgeVariant(provider: string): "default" | "secondary" | "destructive" | "outline" {
  switch (provider.toLowerCase()) {
    case 'claude':
      return 'destructive' // 橙色系
    case 'google':
      return 'default'     // 蓝色系
    case 'openai':
      return 'secondary'   // 绿色系
    default:
      return 'outline'
  }
}

export function ModelUsageCards({ 
  modelStats, 
  totalStats, 
  loading, 
  className = "" 
}: ModelUsageCardsProps) {
  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded-lg"></div>
                  <div>
                    <div className="w-20 h-4 bg-muted rounded mb-1"></div>
                    <div className="w-12 h-3 bg-muted rounded"></div>
                  </div>
                </div>
                <div className="w-10 h-5 bg-muted rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="w-full h-2 bg-muted rounded"></div>
                <div className="flex justify-between">
                  <div className="w-16 h-3 bg-muted rounded"></div>
                  <div className="w-12 h-3 bg-muted rounded"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const modelEntries = Object.entries(modelStats).sort((a, b) => b[1].totalTokens - a[1].totalTokens)

  if (modelEntries.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <HelpCircle className="h-8 w-8" />
            <div>
              <p className="font-medium">暂无模型使用数据</p>
              <p className="text-sm">开始对话后，这里将显示各模型的使用统计</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">模型使用分布</h3>
        <Badge variant="outline" className="text-xs">
          {modelEntries.length} 个模型
        </Badge>
      </div>

      {/* 模型卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modelEntries.map(([modelId, data]) => {
          const IconComponent = getProviderIconComponent(data.provider)
          const badgeVariant = getProviderBadgeVariant(data.provider)
          const providerColor = getProviderColor(data.provider)

          return (
            <Card key={modelId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {/* 模型信息头部 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${providerColor}20` }}
                    >
                      <IconComponent 
                        className="h-4 w-4" 
                        style={{ color: providerColor }}
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm leading-none">
                        {data.displayName}
                      </h4>
                      <Badge variant={badgeVariant} className="mt-1 text-xs">
                        {data.provider}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold">
                      {data.percentage}%
                    </div>
                  </div>
                </div>

                {/* 使用量进度条 */}
                <div className="space-y-2 mb-3">
                  <Progress 
                    value={data.percentage} 
                    className="h-2"
                    style={{
                      '--progress-foreground': providerColor
                    } as React.CSSProperties}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Token用量</span>
                    <span>{data.formattedTokens}</span>
                  </div>
                </div>

                {/* 详细统计 */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">请求数</div>
                    <div className="font-medium">{data.formattedRequests}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">平均Token</div>
                    <div className="font-medium">
                      {data.requests > 0 ? Math.round(data.totalTokens / data.requests) : 0}
                    </div>
                  </div>
                </div>

                {/* Token类型分布（仅在有数据时显示） */}
                {(data.promptTokens > 0 || data.completionTokens > 0) && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-muted-foreground">输入Token</div>
                        <div className="font-medium">
                          {formatStatsNumber(data.promptTokens)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">输出Token</div>
                        <div className="font-medium">
                          {formatStatsNumber(data.completionTokens)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 总计摘要卡片 */}
      <Card className="border-dashed border-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-muted-foreground">总计使用量</h4>
              <div className="flex items-center gap-4 mt-1">
                <div className="text-sm">
                  <span className="text-2xl font-bold">{totalStats.formattedTokens}</span>
                  <span className="text-muted-foreground ml-1">Tokens</span>
                </div>
                <div className="text-sm">
                  <span className="text-2xl font-bold">{totalStats.formattedRequests}</span>
                  <span className="text-muted-foreground ml-1">请求</span>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              累计统计
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}