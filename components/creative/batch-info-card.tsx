/**
 * 批次信息卡片
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BatchStatusBadge } from './batch-status-badge'
import { RefreshCw } from 'lucide-react'
import { toLocal } from '@/lib/utils/date-toolkit'

interface BatchInfoCardProps {
  batch: {
    id: string
    status: string
    statusVersion: number
    modelId: string
    triggeredBy: string
    startedAt: string | null
    completedAt: string | null
    createdAt: string
    errorMessage?: string | null
    tokenUsage?: any
    copyCount: number
  }
  onRegenerateAll?: () => void
}

export function BatchInfoCard({ batch, onRegenerateAll }: BatchInfoCardProps) {
  const tokenUsage = batch.tokenUsage as any
  const totalTokens = tokenUsage?.total || 
    (tokenUsage?.prompt || 0) + (tokenUsage?.completion || 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BatchStatusBadge 
              status={batch.status as any} 
              copyCount={batch.copyCount}
            />
            <code className="text-xs text-muted-foreground">
              {batch.id}
            </code>
          </div>
          
          <Button 
            variant="outline"
            onClick={onRegenerateAll}
            disabled={batch.status === 'RUNNING' || batch.status === 'QUEUED'}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            整批重新生成
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">模型</div>
            <div className="text-sm font-medium mt-1">
              {batch.modelId.replace('claude-sonnet-4-5-20250929', 'Sonnet 4.5')}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground">创建时间</div>
            <div className="text-sm mt-1">
              {toLocal(new Date(batch.createdAt), 'zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground">Token用量</div>
            <div className="text-sm mt-1">
              {totalTokens > 0 ? totalTokens.toLocaleString() : '-'}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground">文案数量</div>
            <div className="text-sm mt-1">
              {batch.copyCount}/5
            </div>
          </div>
        </div>

        {batch.completedAt && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              完成时间: {toLocal(new Date(batch.completedAt), 'zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        )}

        {batch.errorMessage && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-red-600">
              错误: {batch.errorMessage}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
