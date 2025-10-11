/**
 * 文案编辑对话框
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SecureMarkdown } from '@/components/ui/secure-markdown'
import { Loader2 } from 'lucide-react'

interface CopyEditDialogProps {
  open: boolean
  copy: {
    id: string
    sequence: number
    markdownContent: string
    contentVersion: number
  } | null
  onClose: () => void
  onSave: (copyId: string, content: string, note?: string) => Promise<void>
}

export function CopyEditDialog({ open, copy, onClose, onSave }: CopyEditDialogProps) {
  const [editContent, setEditContent] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  useEffect(() => {
    if (copy) {
      setEditContent(copy.markdownContent)
      setNote('')
    }
  }, [copy])

  const handleSave = async () => {
    if (!copy) return

    try {
      setLoading(true)
      await onSave(copy.id, editContent, note || undefined)
      onClose()
    } catch (error) {
      // 错误由父组件处理
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditContent(copy?.markdownContent || '')
    setNote('')
    onClose()
  }

  if (!copy) return null

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>编辑文案 {copy.sequence}</DialogTitle>
          <DialogDescription>
            修改后将创建新版本（v{copy.contentVersion + 1}）
          </DialogDescription>
        </DialogHeader>
        
        {/* 桌面端：左右分栏 */}
        <div className="hidden md:grid md:grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* 左侧：编辑器 */}
          <div className="flex flex-col">
            <Label className="mb-2">Markdown 编辑</Label>
            <Textarea 
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 font-mono text-sm resize-none"
              placeholder="输入 Markdown 内容..."
            />
          </div>
          
          {/* 右侧：预览 */}
          <div className="flex flex-col">
            <Label className="mb-2">预览</Label>
            <div className="flex-1 border rounded-md p-4 overflow-auto bg-muted/20">
              <div className="prose prose-sm max-w-none">
                <SecureMarkdown content={editContent} />
              </div>
            </div>
          </div>
        </div>

        {/* 移动端：Tab 切换 */}
        <div className="md:hidden flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">编辑</TabsTrigger>
              <TabsTrigger value="preview">预览</TabsTrigger>
            </TabsList>
            
            <TabsContent value="edit" className="flex-1 mt-2">
              <Textarea 
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="h-[400px] font-mono text-sm resize-none"
                placeholder="输入 Markdown 内容..."
              />
            </TabsContent>
            
            <TabsContent value="preview" className="flex-1 mt-2">
              <div className="h-[400px] border rounded-md p-4 overflow-auto bg-muted/20">
                <div className="prose prose-sm max-w-none">
                  <SecureMarkdown content={editContent} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="note">修改说明（可选）</Label>
          <Input 
            id="note"
            placeholder="简要说明修改原因..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading || !editContent.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
