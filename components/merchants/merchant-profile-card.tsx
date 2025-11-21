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
import {
  useMerchantProfile,
  useGenerateProfile,
  isTranscriptionRequired
} from '@/hooks/api/use-merchant-profile'
import { useBatchTranscription } from '@/hooks/api/use-batch-transcription'
import { ProfileAISection } from './profile-ai-section'
import { ProfileCustomSection } from './profile-custom-section'
import { ProfileEditDialog } from './profile-edit-dialog'
import { TranscriptionProgressPanel } from './transcription-progress-panel'
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

  const { data, isLoading, error } = useMerchantProfile(merchantId)
  const generateMutation = useGenerateProfile(merchantId)

  // 使用新的批量转录hook
  const {
    startTranscription,
    cancelTranscription,
    isTranscribing,
    progress,
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

    toast.loading('正在生成档案...', { id: 'generate-profile' })

    try {
      const result = await generateMutation.mutateAsync()

      // 检查是否需要转录（使用类型守卫）
      if (isTranscriptionRequired(result)) {
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

        // 使用新的批量转录hook
        try {
          const summary = await startTranscription(contentIds)

          if (summary.failed > 0) {
            toast.info(`已有 ${summary.failed} 条转录失败，其他内容将继续生成`)
          }

          toast.loading('转录完成，正在重新生成档案...', { id: 'generate-profile' })
          return handleGenerate(attempt + 1)
        } catch (err: any) {
          // 用户取消或转录失败
          toast.dismiss('generate-profile')
          if (!err?.message?.includes('取消')) {
            toast.error(err?.message || '自动转录失败，请稍后重试')
          }
          return
        }
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
        <CardContent className="space-y-4">
          {/* 转录进度面板 */}
          {isTranscribing && (
            <TranscriptionProgressPanel
              progress={progress}
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
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleGenerateClick}
                disabled={generateMutation.isPending || isTranscribing || !isAdmin}
              >
                {generateMutation.isPending || isTranscribing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    {isTranscribing
                      ? `转录中... (${progress.current}/${progress.total})`
                      : '生成中...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    生成档案
                  </>
                )}
              </Button>
              {isTranscribing && (
                <Button variant="outline" onClick={cancelTranscription}>
                  取消转录
                </Button>
              )}
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
                  {isTranscribing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelTranscription}
                    >
                      取消转录
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateClick}
                    disabled={generateMutation.isPending || isTranscribing}
                    title={isTranscribing ? `转录中 ${progress.current}/${progress.total}` : '刷新档案'}
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
            {/* 转录进度面板 */}
            {isTranscribing && (
              <TranscriptionProgressPanel
                progress={progress}
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
