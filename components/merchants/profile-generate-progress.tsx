/**
 * 商家创作档案生成进度组件
 */

'use client'

import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Check, Loader2, AlertCircle, X } from 'lucide-react'

/**
 * 步骤状态
 */
type StepStatus = 'pending' | 'started' | 'completed' | 'failed'

/**
 * 生成步骤
 */
interface GenerateStep {
  id: string
  label: string
  status: StepStatus
  message?: string
}

/**
 * 内容分析进度
 */
interface ContentAnalysisProgress {
  current: number
  total: number
  items: Array<{
    id: string
    title: string
    status: 'started' | 'completed' | 'failed'
  }>
}

/**
 * 进度状态
 */
export interface ProfileGenerateProgress {
  isGenerating: boolean
  steps: GenerateStep[]
  contentAnalysis: ContentAnalysisProgress | null
  error: string | null
  merchantName?: string
}

/**
 * 初始进度状态
 */
export const initialProgress: ProfileGenerateProgress = {
  isGenerating: false,
  steps: [
    { id: 'fetch_merchant', label: '获取商家信息', status: 'pending' },
    { id: 'validate_transcripts', label: '验证转录状态', status: 'pending' },
    { id: 'content_analysis', label: 'AI内容质量分析', status: 'pending' },
    { id: 'profile_generating', label: '生成创作简报', status: 'pending' }
  ],
  contentAnalysis: null,
  error: null
}

interface ProfileGenerateProgressProps {
  progress: ProfileGenerateProgress
  onCancel?: () => void
}

export function ProfileGenerateProgressPanel({ progress, onCancel }: ProfileGenerateProgressProps) {
  if (!progress.isGenerating && !progress.error) {
    return null
  }

  // 计算总体进度百分比
  const completedSteps = progress.steps.filter(s => s.status === 'completed').length
  const totalSteps = progress.steps.length
  let overallProgress = (completedSteps / totalSteps) * 100

  // 如果正在进行内容分析，加入分析进度
  if (progress.contentAnalysis && progress.contentAnalysis.total > 0) {
    const analysisProgress = (progress.contentAnalysis.current / progress.contentAnalysis.total) * 25 // 占25%权重
    overallProgress = Math.min(overallProgress + analysisProgress, 100)
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          {progress.error ? '生成失败' : '正在生成档案...'}
        </h4>
        {onCancel && progress.isGenerating && (
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 进度条 */}
      <Progress value={overallProgress} className="h-2" />

      {/* 步骤列表 */}
      <div className="space-y-2">
        {progress.steps.map((step) => (
          <div key={step.id} className="flex items-start gap-2">
            <StepIcon status={step.status} />
            <div className="flex-1 min-w-0">
              <div className={cn(
                "text-sm",
                step.status === 'completed' && "text-muted-foreground",
                step.status === 'failed' && "text-destructive"
              )}>
                {step.label}
              </div>
              {step.message && (
                <div className="text-xs text-muted-foreground truncate">
                  {step.message}
                </div>
              )}

              {/* 内容分析详情 */}
              {step.id === 'content_analysis' && progress.contentAnalysis && step.status === 'started' && (
                <ContentAnalysisDetail progress={progress.contentAnalysis} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 错误信息 */}
      {progress.error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{progress.error}</span>
        </div>
      )}
    </div>
  )
}

/**
 * 步骤图标
 */
function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
    case 'started':
      return <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0 mt-0.5" />
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-muted flex-shrink-0 mt-0.5" />
  }
}

/**
 * 内容分析详情
 */
function ContentAnalysisDetail({ progress }: { progress: ContentAnalysisProgress }) {
  return (
    <div className="mt-2 space-y-1">
      <div className="text-xs text-muted-foreground">
        分析进度: {progress.current}/{progress.total}
      </div>
      <div className="max-h-24 overflow-y-auto space-y-0.5">
        {progress.items.map((item) => (
          <div key={item.id} className="flex items-center gap-1.5 text-xs">
            {item.status === 'completed' ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : item.status === 'started' ? (
              <Loader2 className="h-3 w-3 text-primary animate-spin" />
            ) : (
              <AlertCircle className="h-3 w-3 text-destructive" />
            )}
            <span className={cn(
              "truncate max-w-[200px]",
              item.status === 'completed' && "text-muted-foreground"
            )}>
              {item.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
