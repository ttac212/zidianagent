/**
 * 商家客群分析展示组件
 */

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Users, MapPin, FileText, Sparkles, Loader2, RefreshCw, Edit3, History, List, AlignLeft } from 'lucide-react'
import { SegmentedMarkdownEditor } from '@/components/ui/segmented-markdown-editor'
import { InlineEditableMarkdown } from '@/components/ui/inline-editable-markdown'
import {
  useMerchantAudienceData,
  useMerchantAudienceAnalysis,
  useUpdateAudienceManual,
  useAudienceVersions
} from '@/hooks/api/use-merchant-audience-analysis'
import * as dt from '@/lib/utils/date-toolkit'
import { SecureMarkdown } from '@/components/ui/secure-markdown'
import { toast } from 'sonner'

// 长度限制（与后端保持一致）
const MAX_MARKDOWN_LENGTH = 50000  // 50k 字符

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
    progress,
    result,
    error: analyzeError,
    isAnalyzing
  } = useMerchantAudienceAnalysis()
  const updateManual = useUpdateAudienceManual(merchantId)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [manualMarkdown, setManualMarkdown] = useState('')
  const [editMode, setEditMode] = useState<'segmented' | 'plain'>('segmented')
  const versionsQuery = useAudienceVersions(manualDialogOpen ? merchantId : undefined)

  useEffect(() => {
    const source = result || data
    if (source) {
      const nextMarkdown =
        (source as any).manualMarkdown ||
        (source as any).markdown ||
        source.rawMarkdown ||
        ''
      setManualMarkdown(nextMarkdown)
    }
  }, [result, data])

  const handleSaveManual = async () => {
    try {
      await updateManual.mutateAsync({
        manualMarkdown
      })
      setManualDialogOpen(false)
    } catch (e: any) {
      // toast 已在 hook 内处理
      console.error(e)
    }
  }

  const handleAnalyze = () => {
    analyze(merchantId, {
      topN: 5,
      maxCommentsPerVideo: 100
    })
  }

  const showMarkdownLengthError = () => {
    toast.error('报告超出长度', {
      description: `不得超过 ${MAX_MARKDOWN_LENGTH.toLocaleString()} 字符`
    })
  }


  // ✅ 处理 Textarea 变更（带长度校验）
  const handleMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length > MAX_MARKDOWN_LENGTH) {
      showMarkdownLengthError()
      return
    }
    setManualMarkdown(value)
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

  const displayedMarkdown =
    (analysisData as any).manualMarkdown ||
    (analysisData as any).markdown ||
    analysisData.rawMarkdown ||
    ''
  const markdownSource = (analysisData as any).manualMarkdown ? 'manual' : 'ai'
  const hasInlineDraft = manualMarkdown !== displayedMarkdown
  const handleResetInlineChanges = () => {
    setManualMarkdown(displayedMarkdown)
  }


  // 调试日志 - 检查数据结构
  console.info('[AudienceAnalysisSection] 分析数据:', {
    hasResult: Boolean(result),
    hasData: Boolean(data),
    analyzedAt: analysisData.analyzedAt,
    tokenUsed: analysisData.tokenUsed,
    modelUsed: analysisData.modelUsed,
    hasRawMarkdown: Boolean(displayedMarkdown),
    rawMarkdownLength: displayedMarkdown.length || 0,
    locationStatsLength: analysisData.locationStats?.length || 0
  })

  // 安全解析时间字符串
  const analyzedDate = analysisData.analyzedAt
    ? dt.parse(analysisData.analyzedAt)
    : null

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              客群分析
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">已生成</Badge>
              {markdownSource === 'manual' && (
                <Badge variant="outline">人工校对</Badge>
              )}
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
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManualDialogOpen(true)}
                    title="人工修订"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  {/*
                  TODO: "查看历史"功能待实现
                  - 需要添加独立的版本历史查看 Dialog
                  - 支持预览历史版本内容
                  - 支持一键回滚到指定版本

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVersionHistoryOpen(true)}
                    title="查看历史"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  */}
                </>
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

          {/* 分析报告正文 */}
          {(displayedMarkdown || isAdmin) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">
                  分析报告正文
                  {markdownSource === 'manual' && (
                    <Badge variant="secondary" className="ml-2">人工校对</Badge>
                  )}
                  {hasInlineDraft && (
                    <Badge variant="destructive" className="ml-2">未保存</Badge>
                  )}
                </h4>
              </div>
              {isAdmin ? (
                <InlineEditableMarkdown
                  value={manualMarkdown}
                  onChange={setManualMarkdown}
                  maxLength={MAX_MARKDOWN_LENGTH}
                  onExceedLength={showMarkdownLengthError}
                  disabled={updateManual.isPending}
                />
              ) : displayedMarkdown ? (
                <SecureMarkdown
                  content={displayedMarkdown}
                  enableGfm={true}
                  variant="prose"
                  className="prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground"
                />
              ) : (
                <p className="text-sm text-muted-foreground">暂无分析内容</p>
              )}
              {isAdmin && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    {hasInlineDraft ? '存在未保存的修改' : '内容已与服务器同步'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetInlineChanges}
                      disabled={!hasInlineDraft || updateManual.isPending}
                      className="h-7"
                    >
                      撤销修改
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveManual}
                      disabled={!hasInlineDraft || updateManual.isPending}
                      className="h-7"
                    >
                      {updateManual.isPending ? '保存中...' : '保存修改'}
                    </Button>
                  </div>
                </div>
              )}
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

      {isAdmin && (
        <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
          <DialogContent className="max-w-5xl w-[1100px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>人工修订客群分析</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="manualMarkdown">报告正文（Markdown）</Label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-md border p-1">
                      <Button
                        variant={editMode === 'segmented' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setEditMode('segmented')}
                        className="h-7 gap-1 text-xs"
                      >
                        <List className="h-3 w-3" />
                        段落模式
                      </Button>
                      <Button
                        variant={editMode === 'plain' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setEditMode('plain')}
                        className="h-7 gap-1 text-xs"
                      >
                        <AlignLeft className="h-3 w-3" />
                        纯文本
                      </Button>
                    </div>
                    <span className={`text-xs ${
                      manualMarkdown.length > MAX_MARKDOWN_LENGTH * 0.9
                        ? 'text-destructive font-medium'
                        : 'text-muted-foreground'
                    }`}>
                      {manualMarkdown.length.toLocaleString()} / {MAX_MARKDOWN_LENGTH.toLocaleString()} 字符
                    </span>
                  </div>
                </div>
                {editMode === 'segmented' ? (
                  <SegmentedMarkdownEditor
                    value={manualMarkdown}
                    onChange={setManualMarkdown}
                    placeholder="在此输入或粘贴修订后的客群分析报告..."
                    defaultExpandAll={false}
                  />
                ) : (
                  <Textarea
                    id="manualMarkdown"
                    value={manualMarkdown}
                    onChange={handleMarkdownChange}
                    rows={20}
                    placeholder="在此输入或粘贴修订后的客群分析报告..."
                    className="min-h-[420px] text-sm leading-relaxed font-mono"
                  />
                )}
              </div>
              {versionsQuery.data && versionsQuery.data.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">版本历史（最近10条）</p>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto text-xs text-muted-foreground">
                    {versionsQuery.data.map((v) => (
                      <div key={v.id} className="flex items-center justify-between border p-2 rounded">
                        <span>{typeof v.createdAt === 'string' ? v.createdAt : v.createdAt.toISOString?.()}</span>
                        <Badge variant="outline">{v.source}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManualDialogOpen(false)} disabled={updateManual.isPending}>
                取消
              </Button>
              <Button onClick={handleSaveManual} disabled={updateManual.isPending}>
                {updateManual.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
