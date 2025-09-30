"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/lib/toast/toast"
import { Bold, Italic, Code, List, ListOrdered, Quote, Heading1, Heading2, Save, FileText, Check } from "lucide-react"

interface MilkdownEditorProps {
  content?: string
  onChange?: (content: string) => void
  onSave?: (content: string) => void
  placeholder?: string
}

export function MilkdownEditor({ content = "", onChange, onSave, placeholder = "开始创作..." }: MilkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [editorContent, setEditorContent] = useState(content)
  const [isFirstSave, setIsFirstSave] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setHasContent(editorContent.trim().length > 0)
  }, [editorContent])

  const handleContentChange = (newContent: string) => {
    setEditorContent(newContent)
    onChange?.(newContent)
  }

  const handleSave = async () => {
    if (!editorContent.trim()) return

    setIsSaving(true)

    // 模拟保存过程
    await new Promise((resolve) => setTimeout(resolve, 800))

    onSave?.(editorContent)
    setIsSaving(false)

    if (isFirstSave) {
      toast.success("杰作已保存", {
        description: "您的创作已成功保存到文档库",
        duration: 3000,
      })
      setIsFirstSave(false)
    } else {
      toast.success("保存成功")
    }
  }

  const insertMarkdown = (syntax: string, placeholder = "") => {
    const textarea = editorRef.current?.querySelector("textarea")
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = editorContent.substring(start, end)
    const replacement = selectedText || placeholder

    let newContent = ""
    if (syntax === "**") {
      newContent = editorContent.substring(0, start) + `**${replacement}**` + editorContent.substring(end)
    } else if (syntax === "*") {
      newContent = editorContent.substring(0, start) + `*${replacement}*` + editorContent.substring(end)
    } else if (syntax === "`") {
      newContent = editorContent.substring(0, start) + `\`${replacement}\`` + editorContent.substring(end)
    } else if (syntax === "# ") {
      const lineStart = editorContent.lastIndexOf("\n", start - 1) + 1
      newContent = editorContent.substring(0, lineStart) + `# ${replacement || "标题"}` + editorContent.substring(end)
    } else if (syntax === "## ") {
      const lineStart = editorContent.lastIndexOf("\n", start - 1) + 1
      newContent =
        editorContent.substring(0, lineStart) + `## ${replacement || "副标题"}` + editorContent.substring(end)
    } else if (syntax === "- ") {
      const lineStart = editorContent.lastIndexOf("\n", start - 1) + 1
      newContent = editorContent.substring(0, lineStart) + `- ${replacement || "列表项"}` + editorContent.substring(end)
    } else if (syntax === "1. ") {
      const lineStart = editorContent.lastIndexOf("\n", start - 1) + 1
      newContent =
        editorContent.substring(0, lineStart) + `1. ${replacement || "有序列表项"}` + editorContent.substring(end)
    } else if (syntax === "> ") {
      const lineStart = editorContent.lastIndexOf("\n", start - 1) + 1
      newContent =
        editorContent.substring(0, lineStart) + `> ${replacement || "引用内容"}` + editorContent.substring(end)
    }

    handleContentChange(newContent)
  }

  const examplePrompts = [
    "写一个关于美食的短视频文案",
    "创作一个科技产品介绍",
    "制作一个旅游攻略文案",
    "编写一个健身励志内容",
  ]

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 工具栏 */}
      <div className="border-b border-border p-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => insertMarkdown("**", "粗体文本")}>
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => insertMarkdown("*", "斜体文本")}>
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => insertMarkdown("`", "代码")}>
            <Code className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="sm" onClick={() => insertMarkdown("# ")}>
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => insertMarkdown("## ")}>
            <Heading2 className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="sm" onClick={() => insertMarkdown("- ")}>
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => insertMarkdown("1. ")}>
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => insertMarkdown("> ")}>
            <Quote className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Markdown
          </Badge>
          <Button variant="default" size="sm" onClick={handleSave} disabled={!hasContent || isSaving} className="gap-2">
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {/* 编辑器区域 */}
      <div className="flex-1 relative" ref={editorRef}>
        {!hasContent ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-medium text-foreground mb-2">开始您的创作</h3>
                <p className="text-sm text-muted-foreground mb-4">选择一个示例提示开始，或直接在下方输入您的想法</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">示例提示：</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {examplePrompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs bg-transparent"
                      onClick={() => handleContentChange(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <textarea
          value={editorContent}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-full p-6 bg-transparent border-none outline-none resize-none font-mono text-sm leading-relaxed"
          style={{ minHeight: "100%" }}
        />
      </div>

      {/* 状态栏 */}
      <div className="border-t border-border p-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>字符数: {editorContent.length}</span>
          <span>行数: {editorContent.split("\n").length}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <div className="flex items-center gap-1 text-green-600">
              <Check className="h-3 w-3" />
              <span>已编辑</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
