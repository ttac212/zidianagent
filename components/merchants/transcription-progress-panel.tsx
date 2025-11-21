/**
 * 转录进度面板组件
 * 实时显示批量转录进度，支持取消操作
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, X, Loader2 } from 'lucide-react'
import type { TranscriptionProgress } from '@/hooks/api/use-batch-transcription'

interface TranscriptionProgressPanelProps {
  /** 转录进度 */
  progress: TranscriptionProgress
  /** 是否正在转录 */
  isTranscribing: boolean
  /** 错误信息 */
  error?: string | null
  /** 取消回调 */
  onCancel: () => void
  /** 是否显示为紧凑模式 */
  compact?: boolean
}

/**
 * 转录进度面板
 */
export function TranscriptionProgressPanel({
  progress,
  isTranscribing,
  error,
  onCancel,
  compact = false
}: TranscriptionProgressPanelProps) {
  const { current, total, message } = progress
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  // 如果没有在转录且没有错误，不显示面板
  if (!isTranscribing && !error) {
    return null
  }

  // 紧凑模式 - 用于按钮内联显示
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">
          转录中 {current}/{total} ({percentage}%)
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-6 px-2">
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  // 完整模式 - 独立卡片显示
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {error ? (
              <>
                <AlertCircle className="h-4 w-4 text-destructive" />
                转录失败
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                正在转录内容
              </>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 错误信息 */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
            {error}
          </div>
        )}

        {/* 进度信息 */}
        {!error && (
          <>
            {/* 进度条 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  已处理 {current} / {total}
                </span>
                <span className="font-medium">{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>

            {/* 当前处理消息 */}
            {message && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                {message}
              </div>
            )}

            {/* 提示信息 */}
            <p className="text-xs text-muted-foreground">
              转录完成后将自动重新生成档案，请耐心等待...
            </p>
          </>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="w-full">
            {error ? '关闭' : '取消转录'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
