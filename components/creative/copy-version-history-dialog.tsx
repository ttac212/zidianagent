/**
 * 文案版本历史对话框
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { SecureMarkdown } from '@/components/ui/secure-markdown'
import { History, AlertCircle } from 'lucide-react'
import { toLocal } from '@/lib/utils/date-toolkit'
import { toast } from 'sonner'

interface CopyRevision {
  id: string
  version: number
  content: string
  source: string
  note?: string | null
  createdBy: string
  createdAt: string
}

interface CopyVersionHistoryDialogProps {
  open: boolean
  copyId: string | null
  onClose: () => void
}

const SOURCE_LABELS: Record<string, string> = {
  MODEL: 'AI生成',
  USER: '手动编辑',
  REGENERATE: '重新生成'
}

export function CopyVersionHistoryDialog({ 
  open, 
  copyId, 
  onClose 
}: CopyVersionHistoryDialogProps) {
  const [revisions, setRevisions] = useState<CopyRevision[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)

  const fetchRevisions = useCallback(async () => {
    if (!copyId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/creative/copies/${copyId}`)
      
      if (!response.ok) {
        throw new Error('加载版本历史失败')
      }

      const data = await response.json()
      setRevisions(data.revisions || [])
      
      // 默认选中最新版本（API 按升序返回，最后一项是最新）
      if (data.revisions && data.revisions.length > 0) {
        const latestRevision = data.revisions[data.revisions.length - 1]
        setSelectedVersion(latestRevision.version)
      }
    } catch (err: any) {
      console.error('[CopyVersionHistory] Load failed:', err)
      setError(err.message)
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [copyId])

  useEffect(() => {
    if (open && copyId) {
      fetchRevisions()
    }
  }, [open, copyId, fetchRevisions])

  const selectedRevision = revisions.find(r => r.version === selectedVersion)

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            版本历史
          </DialogTitle>
          <DialogDescription>
            查看文案的所有历史版本
          </DialogDescription>
        </DialogHeader>

        {/* 加载状态 */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {/* 错误状态 */}
        {error && !loading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 版本列表 + 内容预览 */}
        {!loading && !error && revisions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-hidden">
            {/* 左侧：版本列表 */}
            <div className="md:col-span-1">
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-2">
                  {revisions
                    .sort((a, b) => b.version - a.version)
                    .map(revision => (
                      <button
                        key={revision.id}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedVersion === revision.version
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedVersion(revision.version)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">
                            版本 v{revision.version}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {SOURCE_LABELS[revision.source]}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {toLocal(new Date(revision.createdAt), 'zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        {revision.note && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            备注: {revision.note}
                          </div>
                        )}
                      </button>
                    ))}
                </div>
              </ScrollArea>
            </div>

            {/* 右侧：内容预览 */}
            <div className="md:col-span-2 flex flex-col">
              {selectedRevision ? (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">
                        版本 v{selectedRevision.version}
                      </h3>
                      <Badge variant="secondary">
                        {SOURCE_LABELS[selectedRevision.source]}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      创建于 {toLocal(new Date(selectedRevision.createdAt), 'zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    {selectedRevision.note && (
                      <div className="text-sm text-muted-foreground mt-1">
                        备注: {selectedRevision.note}
                      </div>
                    )}
                  </div>
                  
                  <Separator className="mb-4" />
                  
                  <ScrollArea className="flex-1">
                    <div className="prose prose-sm max-w-none">
                      <SecureMarkdown content={selectedRevision.content} />
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  选择一个版本查看内容
                </div>
              )}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!loading && !error && revisions.length === 0 && (
          <Alert>
            <AlertDescription>暂无版本历史</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  )
}
