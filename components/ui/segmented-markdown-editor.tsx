"use client"

import { useState, useEffect, useMemo } from "react"
import { ChevronDown, ChevronRight, Edit3, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { parseMarkdownSegments, mergeMarkdownSegments } from "@/lib/markdown/segments"

interface SegmentedMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /**
   * 默认展开所有段落
   */
  defaultExpandAll?: boolean
}

/**
 * 折叠式 Markdown 段落编辑器
 *
 * 核心功能：
 * - 自动解析 Markdown 按标题分段
 * - 每个段落可独立展开/折叠
 * - 快速定位和编辑特定段落
 * - 零依赖，纯 React 实现
 */
export function SegmentedMarkdownEditor({
  value,
  onChange,
  placeholder = "在此输入 Markdown 内容...",
  className,
  defaultExpandAll = false
}: SegmentedMarkdownEditorProps) {
  const segments = useMemo(() => parseMarkdownSegments(value), [value])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 初始化展开状态
  useEffect(() => {
    if (defaultExpandAll && segments.length > 0) {
      setExpandedIds(new Set(segments.map((s) => s.id)))
    }
  }, [defaultExpandAll, segments])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const updateSegment = (id: string, newContent: string) => {
    const updatedSegments = segments.map((seg) =>
      seg.id === id ? { ...seg, content: newContent } : seg
    )
    onChange(mergeMarkdownSegments(updatedSegments))
  }

  const expandAll = () => {
    setExpandedIds(new Set(segments.map((s) => s.id)))
  }

  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  if (segments.length === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={10}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          提示：使用 <code className="rounded bg-muted px-1">## 标题</code> 分段，即可启用折叠编辑模式
        </p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* 操作栏 */}
      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{segments.length} 个段落</span>
          <span>·</span>
          <span>{expandedIds.size} 个展开</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={expandAll}
            className="h-7 text-xs"
          >
            <ChevronDown className="mr-1 h-3 w-3" />
            全部展开
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            className="h-7 text-xs"
          >
            <ChevronRight className="mr-1 h-3 w-3" />
            全部折叠
          </Button>
        </div>
      </div>

      {/* 段落列表 */}
      <div className="space-y-2">
        {segments.map((segment) => {
          const isExpanded = expandedIds.has(segment.id)
          const indentLevel = Math.max(0, segment.level - 1)

          return (
            <div
              key={segment.id}
              className="rounded-lg border bg-card transition-all hover:border-primary/50"
              style={{ marginLeft: `${indentLevel * 16}px` }}
            >
              {/* 段落标题栏 */}
              <button
                onClick={() => toggleExpand(segment.id)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "flex-1 font-medium",
                    segment.level === 1 && "text-base",
                    segment.level === 2 && "text-sm",
                    segment.level >= 3 && "text-sm text-muted-foreground"
                  )}
                >
                  {segment.title}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {!isExpanded && (
                    <>
                      <span>{segment.content.length} 字符</span>
                      <Edit3 className="h-3 w-3" />
                    </>
                  )}
                  {isExpanded && <Check className="h-3 w-3 text-primary" />}
                </div>
              </button>

              {/* 段落编辑区 */}
              {isExpanded && (
                <div className="border-t bg-muted/20 p-4">
                  <Textarea
                    value={segment.content}
                    onChange={(e) => updateSegment(segment.id, e.target.value)}
                    rows={Math.max(5, Math.min(20, segment.content.split("\n").length + 2))}
                    className="font-mono text-sm leading-relaxed"
                    placeholder={`编辑 "${segment.title}" 的内容...`}
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {segment.content.split("\n").length} 行 · {segment.content.length} 字符
                    </span>
                    <span>Markdown 格式</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
