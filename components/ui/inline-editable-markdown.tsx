"use client"

import { useMemo, useState, useEffect } from "react"
import { Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  parseMarkdownSegments,
  mergeMarkdownSegments,
  type MarkdownSegment
} from "@/lib/markdown/segments"
import { SecureMarkdown } from "@/components/ui/secure-markdown"

interface InlineEditableMarkdownProps {
  value: string
  onChange: (value: string) => void
  className?: string
  maxLength?: number
  disabled?: boolean
  onExceedLength?: (maxLength: number) => void
}

/**
 * 行内 Markdown 编辑组件：仅展示真实内容段落，提供双击或按钮编辑入口
 */
export function InlineEditableMarkdown({
  value,
  onChange,
  className,
  maxLength,
  disabled = false,
  onExceedLength
}: InlineEditableMarkdownProps) {
  const segments = useMemo(() => parseMarkdownSegments(value), [value])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftValue, setDraftValue] = useState("")

  const isSegmentEditable = (segment: MarkdownSegment) =>
    Boolean(segment.content && segment.content.trim().length > 0)

  // 外部刷新数据时，若当前段落已不存在则退出编辑态
  useEffect(() => {
    if (!editingId) return
    const stillExists = segments.some((segment) => segment.id === editingId)
    if (!stillExists) {
      setEditingId(null)
      setDraftValue("")
    }
  }, [segments, editingId])

  const handleSegmentDoubleClick = (segment: MarkdownSegment) => {
    if (disabled || !isSegmentEditable(segment)) return
    setEditingId(segment.id)
    setDraftValue(segment.content)
  }

  const resetEditing = () => {
    setEditingId(null)
    setDraftValue("")
  }

  const handleSaveSegment = () => {
    if (!editingId) return
    const updatedSegments = segments.map((segment) => {
      if (segment.id !== editingId) return segment
      return {
        ...segment,
        content: draftValue
      }
    })
    const nextValue = mergeMarkdownSegments(updatedSegments)

    if (typeof maxLength === "number" && nextValue.length > maxLength) {
      onExceedLength?.(maxLength)
      return
    }

    onChange(nextValue)
    resetEditing()
  }

  const handlePlainChange = (nextValue: string) => {
    if (typeof maxLength === "number" && nextValue.length > maxLength) {
      onExceedLength?.(maxLength)
      return
    }
    onChange(nextValue)
  }

  if (segments.length === 0) {
    return (
      <div className={cn("space-y-2 rounded-lg border p-4", className)}>
        <Textarea
          value={value}
          onChange={(e) => handlePlainChange(e.target.value)}
          rows={12}
          placeholder="暂无内容，直接开始输入 Markdown..."
          className="font-mono text-sm"
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          当前文档没有任何标题，暂以纯文本模式编辑。
        </p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-xs text-muted-foreground">
        双击段落或点击右上角“编辑”按钮修改内容，保存行后仍需在页面底部点击“保存修改”。
      </p>
      <div className="space-y-3">
        {segments.map((segment) => {
          const isEditing = editingId === segment.id
          const level = segment.level || 1
          const editable = isSegmentEditable(segment)
          const interactive = editable && !disabled

          return (
            <div
              key={segment.id}
              className={cn(
                "rounded-lg border p-4 transition-shadow",
                interactive && "hover:border-primary/60 cursor-pointer",
                isEditing && "border-primary shadow-sm",
                disabled && "opacity-60"
              )}
              onDoubleClick={() => handleSegmentDoubleClick(segment)}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                {segment.rawHeading ? (
                  <SecureMarkdown
                    content={segment.rawHeading}
                    variant="compact"
                    className={cn(
                      level === 1 && "text-xl font-semibold",
                      level === 2 && "text-lg font-semibold",
                      level >= 3 && "text-base font-medium text-muted-foreground"
                    )}
                  />
                ) : (
                  <p className="text-sm font-medium text-muted-foreground">
                    文档开头段落
                  </p>
                )}
                {!isEditing && editable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSegmentDoubleClick(segment)
                    }}
                    disabled={disabled}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    编辑
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    rows={Math.max(
                      5,
                      Math.min(18, draftValue.split("\n").length + 2)
                    )}
                    className="font-mono text-sm"
                    disabled={disabled}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {draftValue.split("\n").length} 行 · {draftValue.length} 字符
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetEditing}
                        className="h-7"
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveSegment}
                        className="h-7"
                        disabled={disabled}
                      >
                        保存段落
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                editable && (
                  <div className="text-sm text-muted-foreground">
                    <SecureMarkdown content={segment.content} variant="compact" />
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
