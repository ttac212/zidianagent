/**
 * 商家创作档案 - 主容器组件
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useMerchantProfile } from '@/hooks/api/use-merchant-profile'
import { useGenerateProfileStream } from '@/hooks/api/use-generate-profile-stream'
import { useBatchTranscription } from '@/hooks/api/use-batch-transcription'
import { ProfileAISection } from './profile-ai-section'
import { ProfileCustomSection } from './profile-custom-section'
import { ProfileEditDialog } from './profile-edit-dialog'
import { TranscriptionProgressPanel } from './transcription-progress-panel'
import { ProfileGenerateProgressPanel } from './profile-generate-progress'
import { parseStoredProfile } from '@/lib/ai/profile-parser'
import { ChevronDown, ChevronUp, RefreshCw, Edit, Sparkles, FileText } from 'lucide-react'
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
  const [generateAttempt, setGenerateAttempt] = useState(0)

  const { data, isLoading, error } = useMerchantProfile(merchantId)

  // 使用新的流式生成hook
  const {
    generate: generateStream,
    cancel: cancelGenerate,
    progress: generateProgress,
    isGenerating,
    transcriptionRequired,
    resetProgress
  } = useGenerateProfileStream(merchantId)

  // 使用批量转录hook
  const {
    startTranscription,
    cancelTranscription,
    isTranscribing,
    progress: transcriptionProgress,
    error: transcriptionError
  } = useBatchTranscription(merchantId, {
    mode: 'force',
    concurrent: 100,
    showToast: true
  })

  const profile = data?.profile

  // 解析JSON字段
  const parsed = profile ? parseStoredProfile(profile) : { brief: null, source: 'none' as const }

  /**
   * 生成档案（支持自动转录和重试）
   */
  const handleGenerate = async (attempt = 1) => {
    if (attempt > MAX_GENERATE_ATTEMPTS) {
      toast.error('转录后仍检测到缺失，请手动补齐转录后再试')
      return
    }

    if (totalContentCount === 0) {
      toast.error('商家内容为空,无法生成档案')
      return
    }

    setGenerateAttempt(attempt)

    // 使用流式生成
    await generateStream()

    // 生成完成后检查是否需要转录
    // 注意：transcriptionRequired会在SSE事件中更新
  }

  /**
   * 处理转录需求后重新生成
   */
  const handleTranscriptionAndRetry = async () => {
    if (!transcriptionRequired || generateAttempt >= MAX_GENERATE_ATTEMPTS) {
      toast.error('转录后仍检测到缺失，请手动处理转录再重试')
      return
    }

    const contentIds = transcriptionRequired.contentsToTranscribe.map((c) => c.id)
    toast.info(
      `发现 ${transcriptionRequired.missingCount} 条内容缺失有效转录（${transcriptionRequired.missingPercentage.toFixed(1)}%），正在自动转录...`,
      { duration: 5000 }
    )

    try {
      const summary = await startTranscription(contentIds)

      if (summary.failed > 0) {
        toast.info(`已有 ${summary.failed} 条转录失败，其他内容将继续生成`)
      }

      toast.info('转录完成，正在重新生成档案...')
      resetProgress()
      return handleGenerate(generateAttempt + 1)
    } catch (err: any) {
      if (!err?.message?.includes('取消')) {
        toast.error(err?.message || '自动转录失败，请稍后重试')
      }
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
        <CardContent className="space-y-4">
          {/* 生成进度面板 */}
          {(isGenerating || generateProgress.error) && (
            <ProfileGenerateProgressPanel
              progress={generateProgress}
              onCancel={cancelGenerate}
            />
          )}

          {/* 转录需求提示 */}
          {transcriptionRequired && !isTranscribing && (
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                发现 {transcriptionRequired.missingCount} 条内容缺失有效转录
                （{transcriptionRequired.missingPercentage.toFixed(1)}%），需要先完成转录。
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleTranscriptionAndRetry}>
                  自动转录并继续
                </Button>
                <Button size="sm" variant="outline" onClick={resetProgress}>
                  取消
                </Button>
              </div>
            </div>
          )}

          {/* 转录进度面板 */}
          {isTranscribing && (
            <TranscriptionProgressPanel
              progress={transcriptionProgress}
              isTranscribing={isTranscribing}
              error={transcriptionError}
              onCancel={cancelTranscription}
            />
          )}

          {/* 生成按钮 */}
          {totalContentCount === 0 ? (
            <div className="text-sm text-muted-foreground">
              暂无内容,无法生成档案。请先添加商家内容。
            </div>
          ) : !isGenerating && !transcriptionRequired && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleGenerateClick}
                disabled={isGenerating || isTranscribing || !isAdmin}
              >
                {isTranscribing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    转录中... ({transcriptionProgress.current}/{transcriptionProgress.total})
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    生成档案
                  </>
                )}
              </Button>
            </div>
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
                  {(isTranscribing || isGenerating) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={isGenerating ? cancelGenerate : cancelTranscription}
                    >
                      取消
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateClick}
                    disabled={isGenerating || isTranscribing}
                    title={isTranscribing ? `转录中 ${transcriptionProgress.current}/${transcriptionProgress.total}` : '刷新档案'}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        isGenerating || isTranscribing ? 'animate-spin' : ''
                      }`}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    title="文档模式编辑"
                  >
                    <Link href={`/merchants/${merchantId}/profile/document`}>
                      <FileText className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditDialogOpen(true)}
                    title="快速编辑"
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
            {/* 生成进度面板 */}
            {(isGenerating || generateProgress.error) && (
              <ProfileGenerateProgressPanel
                progress={generateProgress}
                onCancel={cancelGenerate}
              />
            )}

            {/* 转录需求提示 */}
            {transcriptionRequired && !isTranscribing && (
              <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  发现 {transcriptionRequired.missingCount} 条内容缺失有效转录
                  （{transcriptionRequired.missingPercentage.toFixed(1)}%），需要先完成转录。
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleTranscriptionAndRetry}>
                    自动转录并继续
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetProgress}>
                    取消
                  </Button>
                </div>
              </div>
            )}

            {/* 转录进度面板 */}
            {isTranscribing && (
              <TranscriptionProgressPanel
                progress={transcriptionProgress}
                isTranscribing={isTranscribing}
                error={transcriptionError}
                onCancel={cancelTranscription}
              />
            )}

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
