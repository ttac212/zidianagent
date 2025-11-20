/**
 * 商家创作档案 - 主容器组件
 */

'use client'

import { useState } from 'react'
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

  const { data, isLoading, error } = useMerchantProfile(merchantId)
  const generateMutation = useGenerateProfile(merchantId)

  const profile = data?.profile

  // 解析JSON字段
  const parsed = profile ? parseStoredProfile(profile) : { brief: null, source: 'none' as const }

  /**
   * 自动转录流程
   */
  const handleAutoTranscribe = async (contentIds: string[]): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      setIsTranscribing(true)
      setTranscribeProgress({ processed: 0, total: 0 })

      // 创建 SSE 连接 - 使用'force'模式确保转录无效文本
      const url = `/api/merchants/${merchantId}/contents/batch-transcribe/stream?contentIds=${contentIds.join(',')}&mode=force&concurrent=100`
      const es = new EventSource(url)

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
      })

      es.addEventListener('done', (e) => {
        const data = JSON.parse(e.data)
        setIsTranscribing(false)
        es.close()
        setEventSource(null)

        toast.success(
          `转录完成！成功: ${data.summary.processed}, 失败: ${data.summary.failed}`
        )

        resolve(true)
      })

      es.addEventListener('error', (e: any) => {
        const data = e.data ? JSON.parse(e.data) : { message: '连接错误' }
        setIsTranscribing(false)
        es.close()
        setEventSource(null)
        toast.error(`转录失败: ${data.message}`)
        reject(new Error(data.message))
      })

      es.onerror = () => {
        setIsTranscribing(false)
        es.close()
        setEventSource(null)
        toast.error('转录连接断开')
        reject(new Error('转录连接断开'))
      }
    })
  }

  const handleGenerate = async () => {
    if (totalContentCount === 0) {
      toast.error('商家暂无内容,无法生成档案')
      return
    }

    toast.loading('正在生成档案,预计10-15秒...', { id: 'generate-profile' })

    try {
      const result = await generateMutation.mutateAsync()

      // 检测是否需要转录
      if ('requiresTranscription' in result && result.requiresTranscription) {
        toast.dismiss('generate-profile')

        const contentIds = result.data.contentsToTranscribe.map(c => c.id)
        toast.info(
          `发现 ${result.data.missingCount} 条内容缺少有效转录（${result.data.missingPercentage.toFixed(1)}%），正在自动转录...`,
          { duration: 5000 }
        )

        // 执行自动转录
        await handleAutoTranscribe(contentIds)

        // 转录完成后，递归重试档案生成
        toast.loading('转录完成，正在重新生成档案...', { id: 'generate-profile' })
        return handleGenerate()
      }

      // 成功生成档案
      toast.success('档案已生成', { id: 'generate-profile' })
    } catch (error: any) {
      toast.error(error.message || '生成失败', { id: 'generate-profile' })
    }
  }

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
            <Button
              onClick={handleGenerate}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
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
