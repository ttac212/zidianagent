/**
 * 单条文案重新生成对话框
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { SecureMarkdown } from '@/components/ui/secure-markdown'
import { Loader2 } from 'lucide-react'

interface CopyRegenerateDialogProps {
  open: boolean
  copy: {
    id: string
    sequence: number
    markdownContent: string
  } | null
  onClose: () => void
  onRegenerate: (copyId: string, mode: 'based-on-current' | 'fresh', appendPrompt?: string) => Promise<void>
}

export function CopyRegenerateDialog({ 
  open, 
  copy, 
  onClose, 
  onRegenerate 
}: CopyRegenerateDialogProps) {
  const [mode, setMode] = useState<'based-on-current' | 'fresh'>('fresh')
  const [appendPrompt, setAppendPrompt] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegenerate = async () => {
    if (!copy) return

    try {
      setLoading(true)
      await onRegenerate(copy.id, mode, appendPrompt || undefined)
      onClose()
    } catch (error) {
      // 错误由父组件处理
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setMode('fresh')
    setAppendPrompt('')
    onClose()
  }

  if (!copy) return null

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>单条重新生成 - 文案 {copy.sequence}</DialogTitle>
          <DialogDescription>
            基于原批次资产重新生成这条文案
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 当前内容预览 */}
          <div>
            <Label>当前内容</Label>
            <div className="mt-2 rounded-lg border p-4 max-h-48 overflow-auto bg-muted/20">
              <div className="prose prose-sm max-w-none">
                <SecureMarkdown content={copy.markdownContent} />
              </div>
            </div>
          </div>
          
          {/* 生成模式选择 */}
          <div>
            <Label>生成模式</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fresh" id="fresh" />
                <Label htmlFor="fresh" className="font-normal cursor-pointer">
                  完全重新生成（推荐）
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="based-on-current" id="based" />
                <Label htmlFor="based" className="font-normal cursor-pointer">
                  基于当前内容改进
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* 补充要求 */}
          <div>
            <Label htmlFor="appendPrompt">补充要求（可选）</Label>
            <Textarea 
              id="appendPrompt"
              placeholder="例如：更突出产品特点、调整语气、增加互动元素..."
              value={appendPrompt}
              onChange={(e) => setAppendPrompt(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            预计消耗 Token: ~600-800
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleRegenerate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            开始生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
