/**
 * 商家客群分析展示组件
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, MapPin, FileText, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { useMerchantAudienceData, useMerchantAudienceAnalysis } from '@/hooks/api/use-merchant-audience-analysis'
import * as dt from '@/lib/utils/date-toolkit'
import { SecureMarkdown } from '@/components/ui/secure-markdown'

interface AudienceAnalysisSectionProps {
  merchantId: string
  isAdmin: boolean
}

export function AudienceAnalysisSection({
  merchantId,
  isAdmin
}: AudienceAnalysisSectionProps) {
  const { data, isLoading, error } = useMerchantAudienceData(merchantId)
  const {
    analyze,
    status,
    progress,
    result,
    error: analyzeError,
    isAnalyzing
  } = useMerchantAudienceAnalysis()

  const handleAnalyze = () => {
    analyze(merchantId, {
      topN: 5,
      maxCommentsPerVideo: 100
    })
  }

  // 加载状态
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            客群分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // 错误状态
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            客群分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            加载失败: {(error as Error).message}
          </p>
        </CardContent>
      </Card>
    )
  }

  // 未生成状态
  if (!data && !isAnalyzing && !result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            客群分析
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            暂无客群分析数据。基于商家TOP视频的评论数据，AI将智能分析客群画像、地域分布、用户需求等多维度洞察。
          </p>
          {isAdmin ? (
            <Button onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  生成客群分析
                </>
              )}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              仅管理员可以生成客群分析
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // 分析中状态
  if (isAnalyzing && progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            客群分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{progress.label}</span>
              <span className="font-medium">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
            {progress.detail && (
              <p className="text-xs text-muted-foreground">{progress.detail}</p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 分析失败状态
  if (analyzeError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            客群分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            分析失败: {analyzeError}
          </p>
          {isAdmin && (
            <Button onClick={handleAnalyze} variant="outline" className="mt-3">
              重试
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // 已生成状态 - 显示完整分析结果
  // 优先使用实时分析的 result，如果没有则使用数据库中的 data
  const analysisData = result || data
  if (!analysisData) return null

  // 调试日志 - 检查数据结构
  console.log('[AudienceAnalysisSection] 分析数据:', {
    hasResult: Boolean(result),
    hasData: Boolean(data),
    analyzedAt: analysisData.analyzedAt,
    tokenUsed: analysisData.tokenUsed,
    modelUsed: analysisData.modelUsed,
    hasRawMarkdown: Boolean(analysisData.rawMarkdown),
    rawMarkdownLength: analysisData.rawMarkdown?.length || 0,
    locationStatsLength: analysisData.locationStats?.length || 0
  })

  // 安全解析时间字符串
  const analyzedDate = analysisData.analyzedAt
    ? dt.parse(analysisData.analyzedAt)
    : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            客群分析
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">已生成</Badge>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                title="重新分析"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`}
                />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 分析概况 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">分析时间</p>
            <p className="text-sm font-medium">
              {analyzedDate?.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              }) ?? '未知'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">分析视频数</p>
            <p className="text-sm font-medium">
              {typeof analysisData.videosAnalyzed === 'number' ? analysisData.videosAnalyzed : 0} 个
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">评论样本数</p>
            <p className="text-sm font-medium">
              {typeof analysisData.commentsAnalyzed === 'number' ? analysisData.commentsAnalyzed : 0} 条
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Token消耗</p>
            <p className="text-sm font-medium">
              {typeof analysisData.tokenUsed === 'number' && analysisData.tokenUsed > 0
                ? analysisData.tokenUsed.toLocaleString()
                : '0'}
            </p>
          </div>
        </div>

        {/* 地域分布 */}
        {analysisData.locationStats && analysisData.locationStats.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium text-sm">地域分布 TOP10</h4>
            </div>
            <div className="space-y-2">
              {analysisData.locationStats.slice(0, 10).map((stat, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {index + 1}. {stat.location}
                    </span>
                    <span className="font-medium">
                      {stat.count}条 ({stat.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={stat.percentage} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 完整分析报告 */}
        {analysisData.rawMarkdown && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium text-sm">完整分析报告</h4>
            </div>
            <SecureMarkdown
              content={analysisData.rawMarkdown}
              enableGfm={true}
              variant="prose"
              className="prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground"
            />
          </div>
        )}

        {/* 元数据 */}
        <div className="text-xs text-muted-foreground pt-3 border-t space-y-1">
          <div>分析模型: {analysisData.modelUsed || '未知'}</div>
          {analyzedDate && (
            <div>
              生成时间: {analyzedDate.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
