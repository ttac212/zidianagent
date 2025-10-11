/**
 * 创建/编辑资料对话框
 */

import { useState, useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'

interface CreateAssetDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  assetType: 'REPORT' | 'PROMPT' | 'ATTACHMENT'
  assetTypeLabel: string
  initialData?: {
    id: string
    title: string
    content: string
    isActive: boolean
  } | null
  onClose: () => void
  onSave: (data: {
    title: string
    content: string
    setAsActive: boolean
  }) => Promise<void>
}

export function CreateAssetDialog({ 
  open, 
  mode,
  assetTypeLabel,
  initialData,
  onClose, 
  onSave 
}: CreateAssetDialogProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [setAsActive, setSetAsActive] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title)
      setContent(initialData.content)
      setSetAsActive(initialData.isActive)
    } else {
      setTitle('')
      setContent('')
      setSetAsActive(true)
    }
  }, [initialData, open])

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      return
    }

    try {
      setLoading(true)
      await onSave({ title, content, setAsActive })
      handleClose()
    } catch {
      // 错误由父组件处理
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setTitle('')
    setContent('')
    setSetAsActive(true)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? `创建新${assetTypeLabel}` : `编辑${assetTypeLabel}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? `创建一个新的${assetTypeLabel}版本` 
              : `修改${assetTypeLabel}内容，将创建新版本`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">标题</Label>
            <Input 
              id="title"
              placeholder={`输入${assetTypeLabel}标题...`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2"
            />
          </div>
          
          <div>
            <Label htmlFor="content">内容</Label>
            <Textarea 
              id="content"
              placeholder={`输入${assetTypeLabel}内容...`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="mt-2 font-mono text-sm"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="setAsActive">设为当前版本</Label>
            <Switch 
              id="setAsActive"
              checked={setAsActive}
              onCheckedChange={setSetAsActive}
            />
          </div>
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
            onClick={handleSave}
            disabled={loading || !title.trim() || !content.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? '创建' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
