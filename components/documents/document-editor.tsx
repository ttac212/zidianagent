"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Save, FileText, Clock, User, Hash } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { toast as unifiedToast } from '@/lib/toast/unified-toast'
import { FeedbackButton, InlineFeedback } from '@/components/ui/inline-feedback'

interface Document {
  id?: string
  title: string
  content: string
  category: string
  tags: string[]
  version?: number
  wordCount?: number
  status?: string
  author?: string
  createdAt?: string
  updatedAt?: string
}

interface DocumentEditorProps {
  document?: Document
  onSave?: (document: Document) => void
  onCancel?: () => void
}

export function DocumentEditor({ document, onSave, onCancel }: DocumentEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [formData, setFormData] = useState<Document>({
    title: "",
    content: "",
    category: "短视频文案",
    tags: [],
  })
  const [newTag, setNewTag] = useState("")
  const [saving, setSaving] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const { toast } = useToast()

  const categories = ["短视频文案", "营销文案", "产品介绍", "教程内容", "创意脚本"]

  useEffect(() => {
    if (document) {
      setFormData(document)
    }
  }, [document])

  useEffect(() => {
    setWordCount(formData.content.split(/\s+/).filter((word) => word.length > 0).length)
  }, [formData.content])

  const handleInputChange = (field: keyof Document, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }))
      setNewTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }))
  }

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      // 验证错误始终显示
      unifiedToast.error("保存失败", { description: "标题和内容不能为空" })
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
      return
    }

    setSaving(true)
    setSaveStatus('saving')
    try {
      const method = document?.id ? "PUT" : "POST"
      const url = document?.id ? `/api/documents/${document.id}` : "/api/documents"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          versionComment: document?.id ? "文档更新" : "创建文档",
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSaveStatus('success')
        // 只在首次创建时显示toast
        if (!document?.id) {
          unifiedToast.success("文档创建成功")
        }
        setTimeout(() => setSaveStatus('idle'), 2000)
        onSave?.(result.data)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      setSaveStatus('error')
      // 错误使用toast确保可见
      unifiedToast.error("保存失败", { description: "请稍后重试" })
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 文档信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {document?.id ? "编辑文档" : "创建文档"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 标题 */}
          <div className="space-y-2">
            <Label htmlFor="title">文档标题</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="请输入文档标题..."
              className="text-lg"
            />
          </div>

          {/* 分类和标签 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">文档分类</Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">标签</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="添加标签..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                />
                <Button type="button" onClick={handleAddTag} variant="outline" size="sm">
                  添加
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 内容编辑器 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>文档内容</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                <span>{wordCount} 字</span>
              </div>
              {document?.version && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>版本 {document.version}</span>
                </div>
              )}
              {document?.author && (
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{document.author}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.content}
            onChange={(e) => handleInputChange("content", e.target.value)}
            placeholder="请输入文档内容..."
            className="min-h-[400px] text-base leading-relaxed"
          />
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <FeedbackButton
          onClick={handleSave}
          disabled={saving}
          feedbackType={saveStatus === 'saving' ? 'loading' : saveStatus === 'success' ? 'success' : saveStatus === 'error' ? 'error' : 'idle'}
          feedbackMessage={saveStatus === 'success' ? '已保存' : saveStatus === 'error' ? '保存失败' : undefined}
          feedbackPosition="left"
          feedbackDuration={2000}
        >
          {saving ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              保存文档
            </>
          )}
        </FeedbackButton>
      </div>
    </div>
  )
}
