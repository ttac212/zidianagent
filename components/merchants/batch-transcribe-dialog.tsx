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
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  PlayCircle,
} from 'lucide-react'
import { toast } from 'sonner'

interface BatchTranscribeDialogProps {
  merchantId: string
  merchantName: string
  contentIds: string[]
  onSuccess?: () => void
}

interface TranscribeProgress {
  total: number
  processed: number
  succeeded: number
  failed: number
  skipped: number
}

interface TranscribeItem {
  contentId: string
  title: string
  status: 'processing' | 'success' | 'failed' | 'skipped'
  error?: string
  textLength?: number
}

export function BatchTranscribeDialog({
  merchantId,
  merchantName,
  contentIds,
  onSuccess,
}: BatchTranscribeDialogProps) {
  const [open, setOpen] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [mode, setMode] = useState<'missing' | 'all' | 'force'>('missing')
  const [progress, setProgress] = useState<TranscribeProgress>({
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  })
  const [items, setItems] = useState<TranscribeItem[]>([])
  const [eventSource, setEventSource] = useState<EventSource | null>(null)

  const handleStart = async () => {
    if (contentIds.length === 0) {
      toast.error('请先选择要转录的内容')
      return
    }

    setIsTranscribing(true)
    setProgress({ total: 0, processed: 0, succeeded: 0, failed: 0, skipped: 0 })
    setItems([])

    // 创建 SSE 连接，使用选择的mode
    const url = `/api/merchants/${merchantId}/contents/batch-transcribe/stream?contentIds=${contentIds.join(',')}&mode=${mode}&concurrent=100`
    const es = new EventSource(url)

    setEventSource(es)

    es.addEventListener('start', (e) => {
      const data = JSON.parse(e.data)
      setProgress((prev) => ({ ...prev, total: data.total }))
      toast.info(`开始转录 ${data.total} 个视频`)
    })

    es.addEventListener('filtered', (e) => {
      const data = JSON.parse(e.data)
      setProgress((prev) => ({
        ...prev,
        total: data.total,
        skipped: data.skipped,
      }))
      if (data.skipped > 0) {
        toast.info(`跳过 ${data.skipped} 个已转录的视频`)
      }
    })

    es.addEventListener('processing', (e) => {
      const data = JSON.parse(e.data)
      setItems((prev) => [
        ...prev,
        {
          contentId: data.contentId,
          title: data.title,
          status: 'processing',
        },
      ])
    })

    es.addEventListener('item', (e) => {
      const data = JSON.parse(e.data)
      setProgress({
        total: data.progress.total,
        processed: data.progress.processed,
        succeeded: data.progress.succeeded,
        failed: data.progress.failed,
        skipped: 0,
      })

      setItems((prev) =>
        prev.map((item) =>
          item.contentId === data.contentId
            ? {
                ...item,
                status: data.status,
                error: data.error,
                textLength: data.textLength,
              }
            : item
        )
      )
    })

    es.addEventListener('done', (e) => {
      const data = JSON.parse(e.data)
      setIsTranscribing(false)
      es.close()
      setEventSource(null)

      toast.success(
        `转录完成！成功: ${data.summary.processed}, 失败: ${data.summary.failed}, 跳过: ${data.summary.skipped}`
      )

      if (onSuccess) {
        onSuccess()
      }
    })

    es.addEventListener('error', (e: any) => {
      const data = e.data ? JSON.parse(e.data) : { message: '连接错误' }
      setIsTranscribing(false)
      es.close()
      setEventSource(null)
      toast.error(`转录失败: ${data.message}`)
    })

    es.onerror = () => {
      setIsTranscribing(false)
      es.close()
      setEventSource(null)
      toast.error('连接断开，转录中止')
    }
  }

  const handleCancel = () => {
    if (eventSource) {
      eventSource.close()
      setEventSource(null)
      setIsTranscribing(false)
      toast.info('已取消转录')
    }
  }

  const progressPercent =
    progress.total > 0 ? (progress.processed / progress.total) * 100 : 0

  // 处理对话框关闭 - 重置所有状态
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // 对话框关闭时重置状态，确保下次打开时显示干净的界面
      setItems([])
      setProgress({ total: 0, processed: 0, succeeded: 0, failed: 0, skipped: 0 })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <FileText className="h-4 w-4 mr-2" />
          批量转录
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>批量转录视频文案</DialogTitle>
          <DialogDescription>
            为 {merchantName} 的 {contentIds.length} 个视频生成文案转录
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden flex flex-col">
          {/* 转录模式选择 - 允许用户随时切换 */}
          {!isTranscribing && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">转录模式</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)}>
                <div className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value="missing" id="mode-missing" />
                  <div className="flex-1">
                    <Label htmlFor="mode-missing" className="font-medium cursor-pointer">
                      仅缺失内容
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      只转录没有转录文本的视频（推荐）
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value="all" id="mode-all" />
                  <div className="flex-1">
                    <Label htmlFor="mode-all" className="font-medium cursor-pointer">
                      所有内容
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      处理所有选中的视频，跳过已有转录的
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value="force" id="mode-force" />
                  <div className="flex-1">
                    <Label htmlFor="mode-force" className="font-medium cursor-pointer">
                      强制覆盖
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      强制重新转录所有视频，覆盖已有转录
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* 进度统计 */}
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{progress.total}</div>
              <div className="text-xs text-muted-foreground">总数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {progress.processed}
              </div>
              <div className="text-xs text-muted-foreground">已处理</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {progress.succeeded}
              </div>
              <div className="text-xs text-muted-foreground">成功</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {progress.failed}
              </div>
              <div className="text-xs text-muted-foreground">失败</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {progress.skipped}
              </div>
              <div className="text-xs text-muted-foreground">跳过</div>
            </div>
          </div>

          {/* 进度条 */}
          {isTranscribing && (
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-2" />
              <div className="text-sm text-center text-muted-foreground">
                {progressPercent.toFixed(1)}% ({progress.processed}/{progress.total})
              </div>
            </div>
          )}

          {/* 转录项列表 */}
          {items.length > 0 && (
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-4 space-y-2">
                {items.map((item) => (
                  <div
                    key={item.contentId}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="mt-0.5">
                      {item.status === 'processing' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                      {item.status === 'success' && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {item.status === 'failed' && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      {item.status === 'skipped' && (
                        <AlertCircle className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.title}</div>
                      {item.status === 'success' && item.textLength && (
                        <div className="text-xs text-muted-foreground">
                          转录完成，共 {item.textLength} 字
                        </div>
                      )}
                      {item.status === 'failed' && item.error && (
                        <div className="text-xs text-red-600">{item.error}</div>
                      )}
                      {item.status === 'processing' && (
                        <div className="text-xs text-blue-600">转录中...</div>
                      )}
                      {item.status === 'skipped' && (
                        <div className="text-xs text-gray-600">已有转录</div>
                      )}
                    </div>
                    <Badge
                      variant={
                        item.status === 'success'
                          ? 'default'
                          : item.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {item.status === 'processing' && '处理中'}
                      {item.status === 'success' && '成功'}
                      {item.status === 'failed' && '失败'}
                      {item.status === 'skipped' && '跳过'}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {!isTranscribing ? (
              <Button onClick={handleStart} className="flex-1" disabled={items.length > 0}>
                <PlayCircle className="h-4 w-4 mr-2" />
                开始转录
              </Button>
            ) : (
              <Button onClick={handleCancel} variant="destructive" className="flex-1">
                取消转录
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>
              {isTranscribing ? '后台运行' : '关闭'}
            </Button>
          </div>

          {/* 提示信息 */}
          {!isTranscribing && items.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>准备为 {contentIds.length} 个视频生成文案转录</p>
              <p className="text-xs mt-2">
                平均每个视频约需 20-30 秒，请耐心等待
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
