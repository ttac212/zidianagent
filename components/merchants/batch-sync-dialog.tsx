'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Loader2,
} from 'lucide-react'

interface Merchant {
  id: string
  name: string
}

interface SyncResult {
  merchantId: string
  merchantName: string
  success: boolean
  newVideos: number
  updatedVideos: number
  errors: string[]
}

interface BatchSyncDialogProps {
  merchants: Merchant[]
  onSuccess?: () => void
}

export function BatchSyncDialog({ merchants, onSuccess }: BatchSyncDialogProps) {
  const [open, setOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState<SyncResult[]>([])
  const [progress, setProgress] = useState(0)

  const handleSync = async () => {
    if (merchants.length === 0) {
      toast.error('请至少选择一个商家')
      return
    }

    setSyncing(true)
    setResults([])
    setProgress(0)

    try {
      const response = await fetch('/api/merchants/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantIds: merchants.map((m) => m.id),
          limit: 50, // 每个商家同步最多50个视频
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '同步失败')
      }

      setResults(data.data.results || [])
      setProgress(100)

      const summary = data.data.summary
      if (summary.failed === 0) {
        toast.success(
          `同步完成！共更新 ${summary.newVideos} 个新视频，${summary.updatedVideos} 个已有视频`
        )
      } else {
        toast.warning(
          `同步完成，但有 ${summary.failed} 个商家同步失败，请查看详情`
        )
      }

      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      toast.error(error.message || '同步失败')
      console.error('批量同步失败:', error)
    } finally {
      setSyncing(false)
    }
  }

  const getStatusIcon = (result: SyncResult) => {
    if (result.success) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    }
    return <XCircle className="h-4 w-4 text-red-500" />
  }

  const getStatusBadge = (result: SyncResult) => {
    if (result.success) {
      return <Badge variant="default">成功</Badge>
    }
    return <Badge variant="destructive">失败</Badge>
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          批量同步 ({merchants.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>批量同步商家数据</DialogTitle>
          <DialogDescription>
            从抖音同步选中商家的最新视频数据（最多50个/商家）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 同步统计 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1 rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">选中商家</span>
              <span className="text-2xl font-bold">{merchants.length}</span>
            </div>
            {results.length > 0 && (
              <div className="flex flex-col space-y-1 rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">同步成功</span>
                <span className="text-2xl font-bold text-green-600">
                  {results.filter((r) => r.success).length}
                </span>
              </div>
            )}
          </div>

          {/* 进度条 */}
          {syncing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">同步进度</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* 商家列表 */}
          <ScrollArea className="h-[300px] rounded-md border">
            <div className="p-4 space-y-3">
              {results.length === 0 ? (
                // 显示待同步的商家
                merchants.map((merchant) => (
                  <div
                    key={merchant.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{merchant.name}</span>
                    </div>
                    <Badge variant="outline">待同步</Badge>
                  </div>
                ))
              ) : (
                // 显示同步结果
                results.map((result) => (
                  <div
                    key={result.merchantId}
                    className="flex flex-col space-y-2 p-3 rounded-lg border"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result)}
                        <span className="font-medium">{result.merchantName}</span>
                      </div>
                      {getStatusBadge(result)}
                    </div>

                    {result.success ? (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>新增: {result.newVideos} 个</span>
                        <span>更新: {result.updatedVideos} 个</span>
                      </div>
                    ) : (
                      <div className="text-sm text-red-500">
                        {result.errors.join(', ')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* 提示信息 */}
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">💡 同步说明</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• 每个商家最多同步最新的 50 个视频</li>
              <li>• 同步过程会自动去重，只更新新发布或数据变化的视频</li>
              <li>• 大量商家同步可能需要较长时间，请耐心等待</li>
              <li>• 同步间隔 2 秒，避免触发 API 限流</li>
            </ul>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={syncing}
            >
              {results.length > 0 ? '关闭' : '取消'}
            </Button>
            {results.length === 0 && (
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    同步中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    开始同步
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
