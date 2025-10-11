/**
 * 整批重新生成对话框
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'

interface BatchRegenerateDialogProps {
  open: boolean
  batch: {
    id: string
    modelId: string
    copyCount: number
  } | null
  onClose: () => void
  onRegenerate: (appendPrompt?: string) => Promise<void>
}

export function BatchRegenerateDialog({
  open,
  batch,
  onClose,
  onRegenerate
}: BatchRegenerateDialogProps) {
  const [appendPrompt, setAppendPrompt] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegenerate = async () => {
    if (!batch) return

    try {
      setLoading(true)
      await onRegenerate(appendPrompt || undefined)
      handleClose()
    } catch (error) {
      // 错误由父组件处理
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setAppendPrompt('')
    onClose()
  }

  if (!batch) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>整批重新生成</DialogTitle>
          <DialogDescription>
            基于当前批次的资产配置重新生成 5 条文案
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 批次信息 */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div>模型: {batch.modelId}</div>
                <div>当前已生成: {batch.copyCount}/5 条文案</div>
              </div>
            </AlertDescription>
          </Alert>

          {/* 补充提示词 */}
          <div>
            <Label htmlFor="appendPrompt">补充要求（可选）</Label>
            <Textarea
              id="appendPrompt"
              placeholder="例如：增强产品特点描述、调整语气风格、添加互动元素..."
              value={appendPrompt}
              onChange={(e) => setAppendPrompt(e.target.value)}
              rows={4}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-2">
              补充要求将附加到原有提示词后面，帮助 AI 生成更符合需求的文案
            </p>
          </div>

          <Alert>
            <AlertDescription className="text-sm">
              <div className="space-y-1">
                <div>• 将创建一个新批次（链接到当前批次）</div>
                <div>• 使用相同的资产配置和模型</div>
                <div>• 预计消耗约 3000-4000 Token</div>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            onClick={handleRegenerate}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            开始生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
