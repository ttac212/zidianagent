/**
 * 批次操作对话框（归档/删除）
 */

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2 } from 'lucide-react'

interface BatchActionsDialogProps {
  open: boolean
  action: 'archive' | 'delete' | null
  batchId: string | null
  onClose: () => void
  onConfirm: (batchId: string, action: 'archive' | 'delete') => Promise<void>
}

const ACTION_CONFIG = {
  archive: {
    title: '归档批次',
    description: '确定要归档这个批次吗？归档后批次仍然可以查看，但不会出现在活动列表中。',
    confirmText: '归档',
    variant: 'default' as const
  },
  delete: {
    title: '删除批次',
    description: '确定要删除这个批次吗？删除后将无法恢复，包括所有生成的文案和历史记录。',
    confirmText: '删除',
    variant: 'destructive' as const
  }
}

export function BatchActionsDialog({
  open,
  action,
  batchId,
  onClose,
  onConfirm
}: BatchActionsDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!batchId || !action) return

    try {
      setLoading(true)
      await onConfirm(batchId, action)
      onClose()
    } catch (error) {
      // 错误由父组件处理
    } finally {
      setLoading(false)
    }
  }

  if (!action) return null

  const config = ACTION_CONFIG[action]

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {config.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={config.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {config.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
