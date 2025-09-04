"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, Eye, Edit3, Hash, Clock, X, Shield, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SecureMarkdown } from "@/components/ui/secure-markdown"

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

interface MarkdownEditorProps {
  document?: Document
  onSave?: (document: Document) => void
  onCancel?: () => void
}

export function MarkdownEditor({ document, onSave, onCancel }: MarkdownEditorProps) {
  const [formData, setFormData] = useState<Document>({
    title: "",
    content: "",
    category: "",
    tags: [],
  })
  const [newTag, setNewTag] = useState("")
  const [saving, setSaving] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [activeTab, setActiveTab] = useState("edit")
  const { toast } = useToast()
  
  // 🛡️ 安全渲染开关 - 可以安全切换新旧组件
  const [useSecureRendering, setUseSecureRendering] = useState(true)

  // 用户自定义分类：在编辑器中直接以自由文本输入分类

  useEffect(() => {
    if (document) {
      setFormData(document)
    }
  }, [document])

  useEffect(() => {
    const text = formData.content.replace(/[#*`_~[\]()]/g, "")
    setWordCount(text.split(/\s+/).filter((word) => word.length > 0).length)
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
    // 标题可留空：按规则自动生成标题
    const inputTitle = (formData.title || "").trim()
    let computedTitle = inputTitle

    if (!computedTitle) {
      const firstLine = ((formData.content || "").split(/\r?\n/)[0] || "").trim()
      if (firstLine) {
        computedTitle = Array.from(firstLine).slice(0, 9).join("")
      } else if (!((formData.content || "").trim())) {
        computedTitle = "无标题文档"
      } else {
        computedTitle = "无标题文档"
      }
    }

    setSaving(true)
    try {
      // 模拟API调用
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const savedDocument = {
        ...formData,
        title: computedTitle,
        id: document?.id || Date.now().toString(),
        version: (document?.version || 0) + 1,
        wordCount,
        updatedAt: new Date().toISOString(),
        createdAt: document?.createdAt || new Date().toISOString(),
        author: "当前用户",
        status: "已保存",
      }

      toast({
        title: "保存成功",
        description: "文档已保存",
      })
      onSave?.(savedDocument)
    } catch (error) {
      toast({
        title: "保存失败",
        description: "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const renderMarkdown = (content: string) => {
    return content
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*)\*/gim, '<em class="italic">$1</em>')
      .replace(/`([^`]*)`/gim, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/^- (.*$)/gim, '<li class="ml-4">• $1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/\n/gim, "<br>")
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              {document?.id ? "编辑文档" : "新建文档"}
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                <span>{wordCount} 字</span>
              </div>
              {document?.version && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>v{document.version}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 文档信息 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="title">文档标题</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="请输入文档标题..."
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">分类</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
                placeholder="输入或创建分类（可留空）"
                className="text-base"
              />
            </div>
          </div>

          {/* 标签管理 */}
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
                className="flex-1"
              />
              <Button type="button" onClick={handleAddTag} variant="outline" size="sm">
                添加
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Markdown编辑器 */}
          <div className="space-y-2">
            <Label>内容</Label>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit" className="gap-2">
                  <Edit3 className="h-4 w-4" />
                  编辑
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-2">
                  <Eye className="h-4 w-4" />
                  预览
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="mt-4">
                <Textarea
                  value={formData.content}
                  onChange={(e) => handleInputChange("content", e.target.value)}
                  placeholder="支持Markdown格式，例如：&#10;# 标题&#10;## 二级标题&#10;**粗体** *斜体*&#10;- 列表项&#10;`代码`"
                  className="min-h-[500px] text-sm font-mono leading-relaxed resize-none"
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  支持Markdown语法：# 标题，**粗体**，*斜体*，`代码`，- 列表等
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                {/* 安全渲染模式切换器 */}
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {useSecureRendering ? (
                        <Shield className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      )}
                      <span className="text-sm font-medium">
                        {useSecureRendering ? '安全渲染模式' : '传统渲染模式'}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUseSecureRendering(!useSecureRendering)}
                    >
                      {useSecureRendering ? '切换到传统模式' : '切换到安全模式'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {useSecureRendering 
                      ? '使用React-Markdown安全渲染，防护XSS攻击，支持更多功能' 
                      : '使用传统dangerouslySetInnerHTML渲染，存在XSS风险'}
                  </p>
                </div>

                <div className="min-h-[500px] p-4 border border-border rounded-md bg-muted/30">
                  {formData.content ? (
                    useSecureRendering ? (
                      // ✅ 新的安全渲染方式
                      <SecureMarkdown 
                        content={formData.content}
                        className=""
                        enableGfm={true}
                        variant="prose"
                      />
                    ) : (
                      // ❌ 旧的不安全方式 - 保留用于对比
                      <div
                        className="prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(formData.content) }}
                      />
                    )
                  ) : (
                    <div className="text-muted-foreground text-center py-20">
                      在编辑模式下输入内容，这里将显示预览效果
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                取消
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
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
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
