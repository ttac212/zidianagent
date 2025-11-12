/**
 * 商家同步进度对话框组件
 * 显示实时同步进度和统计信息
 */

'use client'

import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { SyncProgress, SyncResult, SyncStatus } from '@/hooks/use-merchant-sync-stream'

interface MerchantSyncProgressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: SyncStatus
  progress: SyncProgress | null
  result: SyncResult | null
  error: string | null
  onCancel: () => void
}

export function MerchantSyncProgressDialog({
  open,
  onOpenChange,
  status,
  progress,
  result,
  error,
  onCancel,
}: MerchantSyncProgressDialogProps) {
  const progressPercentage =
    progress ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'syncing' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                正在同步商家数据
              </>
            )}
            {status === 'done' && (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                同步完成
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                同步失败
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {status === 'syncing' && '正在从抖音 API 获取最新数据...'}
            {status === 'done' && '所有商家数据已成功更新'}
            {status === 'error' && error}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 进度条 */}
          {status === 'syncing' && progress && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    进度: {progress.current} / {progress.total}
                  </span>
                  <span className="font-medium">{progressPercentage}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {/* 当前同步的商家 */}
              <div className="rounded-md border bg-muted/50 p-3">
                <div className="text-sm font-medium">正在同步:</div>
                <div className="mt-1 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm">{progress.merchantName}</span>
                </div>
                {progress.success && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    新增 {progress.newVideos || 0} 条，更新 {progress.updatedVideos || 0} 条
                  </div>
                )}
                {!progress.success && progress.errors && progress.errors.length > 0 && (
                  <div className="mt-2 text-xs text-destructive">
                    {progress.errors[0]}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 完成统计 */}
          {status === 'done' && result && (
            <div className="space-y-3 rounded-md border bg-muted/50 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">同步总数</div>
                  <div className="text-2xl font-bold">{result.total}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">成功/失败</div>
                  <div className="text-2xl font-bold">
                    <span className="text-green-600">{result.success}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-destructive">{result.failed}</span>
                  </div>
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="text-xs text-muted-foreground">内容变化</div>
                <div className="mt-1 text-sm">
                  新增 <span className="font-medium">{result.totalNewVideos}</span> 条
                  视频，更新 <span className="font-medium">{result.totalUpdatedVideos}</span>{' '}
                  条视频
                </div>
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {status === 'error' && error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                <div className="text-sm text-destructive">{error}</div>
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          {status === 'syncing' && (
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              取消同步
            </Button>
          )}
          {(status === 'done' || status === 'error') && (
            <Button onClick={() => onOpenChange(false)}>关闭</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
