/**
 * 商家创作档案 - 主容器组件
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useMerchantProfile,
  useGenerateProfile
} from '@/hooks/api/use-merchant-profile'
import { ProfileAISection } from './profile-ai-section'
import { ProfileCustomSection } from './profile-custom-section'
import { ProfileEditDialog } from './profile-edit-dialog'
import { parseStoredProfile } from '@/lib/ai/profile-parser'
import { ChevronDown, ChevronUp, RefreshCw, Edit, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

const MAX_GENERATE_ATTEMPTS = 2

interface MerchantProfileCardProps {
  merchantId: string
  merchantName: string
  totalContentCount: number
  isAdmin: boolean
}

export function MerchantProfileCard({
  merchantId,
  merchantName: _merchantName,
  totalContentCount,
  isAdmin
}: MerchantProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeProgress, setTranscribeProgress] = useState({ processed: 0, total: 0 })
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const transcribeRejectRef = useRef<((error: Error) => void) | null>(null)

  const { data, isLoading, error } = useMerchantProfile(merchantId)
  const generateMutation = useGenerateProfile(merchantId)

  // 组件卸载或 EventSource 变更时确保关闭 SSE，避免内存泄漏
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close()
      }
      if (transcribeRejectRef.current) {
        transcribeRejectRef.current(new Error('转录已取消'))
        transcribeRejectRef.current = null
      }
    }
  }, [eventSource])

  const profile = data?.profile

  // 解析JSON字段
  const parsed = profile ? parseStoredProfile(profile) : { brief: null, source: 'none' as const }

  type TranscribeSummary = {
    total: number
    processed: number
    failed: number
    skipped: number
    failedItems: Array<{
      id: string
      title?: string
      error?: string
    }>
  }

  /**
   * 自动转录流程
   */
  const handleAutoTranscribe = async (contentIds: string[]): Promise<TranscribeSummary> => {
    return new Promise((resolve, reject) => {
      setIsTranscribing(true)
      setTranscribeProgress({ processed: 0, total: 0 })
      transcribeRejectRef.current = reject

      const url = `/api/merchants/${merchantId}/contents/batch-transcribe/stream?contentIds=${contentIds.join(',')}&mode=force&concurrent=100`
      const es = new EventSource(url)
      const failedItems: TranscribeSummary['failedItems'] = []
      let closed = false
      const cleanup = () => {
        if (closed) return
        es.close()
        setEventSource(null)
        setIsTranscribing(false)
        closed = true
        transcribeRejectRef.current = null
      }

      setEventSource(es)

      es.addEventListener('start', (e) => {
        const data = JSON.parse(e.data)
        setTranscribeProgress({ processed: 0, total: data.total })
        toast.info(`检测到 ${data.total} 条内容需要转录，正在自动转录...`)
      })

      es.addEventListener('item', (e) => {
        const data = JSON.parse(e.data)
        setTranscribeProgress({
          total: data.progress.total,
          processed: data.progress.processed
        })

        if (data.status === 'failed') {
          failedItems.push({
            id: data.contentId,
            title: data.title,
            error: data.error
          })
        }
      })

      es.addEventListener('done', (e) => {
        const data = JSON.parse(e.data)
        const summary = {
          ...(data.summary as Omit<TranscribeSummary, 'failedItems'>),
          failedItems
        }
        cleanup()

        if (summary.failed > 0) {
          const preview = summary.failedItems.slice(0, 3).map((item) => item.title || item.id).join('、')
          toast.info(
            `转录完成，成功: ${summary.processed}, 失败: ${summary.failed}, 跳过: ${summary.skipped}${preview ? `。失败示例：${preview}` : ''}`
          )
        } else {
          toast.success(
            `转录完成，成功: ${summary.processed}, 跳过: ${summary.skipped}`
          )
        }

        resolve(summary)
      })

      const handleError = (message: string) => {
        cleanup()
        toast.error(`转录失败: ${message}`)
        reject(new Error(message))
      }

      es.addEventListener('error', (e: any) => {
        const data = e.data ? JSON.parse(e.data) : { message: '连接错误' }
        handleError(data.message || '转录失败')
      })

      es.onerror = () => {
        handleError('转录连接中断')
      }
    })
  }

  // 手动取消自动转录
  const handleCancelTranscribe = () => {
    if (eventSource) {
      eventSource.close()
      setEventSource(null)
    }
    if (isTranscribing) {
      setIsTranscribing(false)
      transcribeRejectRef.current?.(new Error('已取消自动转录'))
      transcribeRejectRef.current = null
      toast.info('已取消自动转录')
    }
  }

  const handleGenerate = async (attempt = 1) => {
    if (attempt > MAX_GENERATE_ATTEMPTS) {
      toast.error('转录后仍检测到缺失，请手动补齐转录后再试')
      return
    }

    if (totalContentCount === 0) {
      toast.error('商家内容为空,无法生成档案')
      return
    }

    toast.loading('正在生成档案...', { id: 'generate-profile' })

    try {
      const result = await generateMutation.mutateAsync()

      // 检查是否需要转录
      if ('requiresTranscription' in result && result.requiresTranscription) {
        toast.dismiss('generate-profile')

        if (attempt >= MAX_GENERATE_ATTEMPTS) {
          toast.error('转录后仍检测到缺失，请手动处理转录再重试')
          return
        }

        const contentIds = result.data.contentsToTranscribe.map((c) => c.id)
        toast.info(
          `发现 ${result.data.missingCount} 条内容缺失有效转录（${result.data.missingPercentage.toFixed(1)}%），正在自动转录...`,
          { duration: 5000 }
        )

        let summary: TranscribeSummary | null = null
        try {
          summary = await handleAutoTranscribe(contentIds)
        } catch (err: any) {
          toast.error(err?.message || '自动转录失败，请稍后重试')
          return
        }

        if (summary && summary.failed > 0) {
          toast.info(`已有 ${summary.failed} 条转录失败，其他内容将继续生成`)
        }

        toast.loading('转录完成，正在重新生成档案...', { id: 'generate-profile' })
        return handleGenerate(attempt + 1)
      }

      // 成功生成档案
      toast.success('档案生成成功', { id: 'generate-profile' })
    } catch (error: any) {
      toast.error(error.message || '生成失败', { id: 'generate-profile' })
    }
  }

  // 用于onClick的包装函数（不接受MouseEvent参数）
  const handleGenerateClick = () => handleGenerate()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>创作档案</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">
            加载失败: {(error as Error).message}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 档案不存在状态
  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            商家创作档案
          </CardTitle>
          <CardDescription>
            为商家生成专属的创作简报,包含爆款分析、创作建议等内容
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalContentCount === 0 ? (
            <div className="text-sm text-muted-foreground">
              暂无内容,无法生成档案。请先添加商家内容。
            </div>
          ) : (
            <>
              <Button
                onClick={handleGenerateClick}
                disabled={generateMutation.isPending || isTranscribing || !isAdmin}
              >
                {generateMutation.isPending || isTranscribing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    {isTranscribing
                      ? `转录中... (${transcribeProgress.processed}/${transcribeProgress.total})`
                      : '生成中...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    生成档案
                  </>
                )}
              </Button>
            </>
          )}
          {!isAdmin && (
            <p className="text-xs text-muted-foreground mt-2">
              仅管理员可以生成档案
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // 档案存在状态
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                商家创作档案
              </CardTitle>
              <Badge variant="secondary">已生成</Badge>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  {isTranscribing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelTranscribe}
                    >
                      取消转录
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateClick}
                    disabled={generateMutation.isPending || isTranscribing}
                    title={isTranscribing ? `转录中 ${transcribeProgress.processed}/${transcribeProgress.total}` : '刷新档案'}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        generateMutation.isPending || isTranscribing ? 'animate-spin' : ''
                      }`}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditDialogOpen(true)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          {!isExpanded && (
            <CardDescription>
              点击展开查看完整档案
            </CardDescription>
          )}
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-6">
            {/* AI生成内容 */}
            <ProfileAISection
              merchantId={merchantId}
              brief={parsed.brief}
              briefSource={parsed.source}
              aiGeneratedAt={profile.aiGeneratedAt}
              aiModelUsed={profile.aiModelUsed}
              aiTokenUsed={profile.aiTokenUsed}
              isAdmin={isAdmin}
            />

            {/* 用户自定义内容 */}
            <ProfileCustomSection profile={profile} />
          </CardContent>
        )}
      </Card>

      {/* 编辑对话框 */}
      {isAdmin && (
        <ProfileEditDialog
          merchantId={merchantId}
          profile={profile}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}
    </>
  )
}
