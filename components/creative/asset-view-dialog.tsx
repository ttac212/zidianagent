/**
 * 资料查看对话框
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toLocal } from '@/lib/utils/date-toolkit'

interface AssetViewDialogProps {
  open: boolean
  asset: {
    id: string
    type: string
    title: string
    version: number
    isActive: boolean
    content: string
    createdAt: string
    createdBy?: string | null
  } | null
  onClose: () => void
}

export function AssetViewDialog({ open, asset, onClose }: AssetViewDialogProps) {
  if (!asset) return null

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{asset.title}</DialogTitle>
            {asset.isActive && (
              <Badge variant="success">当前版本</Badge>
            )}
          </div>
          <DialogDescription>
            版本 v{asset.version} | 创建于 {toLocal(new Date(asset.createdAt), 'zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
            {asset.createdBy && ` | 创建人: ${asset.createdBy}`}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 mt-4">
          <pre className="text-sm whitespace-pre-wrap font-mono p-4 rounded-lg bg-muted/20">
            {asset.content}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
