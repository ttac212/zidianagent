/**
 * MessageSection 组件
 * 显示助手消息的章节结构（标题 + 内容）
 */

"use client"

import React from 'react'
import { cn } from '@/lib/utils'
import { SecureMarkdown } from '@/components/ui/secure-markdown'

interface MessageSectionProps {
  title?: string                        // 章节标题
  content: string                       // 章节内容
  index?: number                        // 章节索引（可选）
  className?: string
}

export const MessageSection: React.FC<MessageSectionProps> = ({
  title,
  content,
  index,
  className
}) => {
  // 如果没有内容，不显示
  if (!content || content.trim().length === 0) {
    return null
  }

  return (
    <section className={cn("space-y-3", className)}>
      {/* 章节标题 */}
      {title && (
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
          {/* 可选：显示章节索引 */}
          {typeof index === 'number' && index >= 0 && (
            <span className="inline-block w-6 h-6 mr-2 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full text-center leading-6">
              {index + 1}
            </span>
          )}
          {title}
        </h3>
      )}

      {/* 章节内容 - 使用 SecureMarkdown 渲染 */}
      <div className="text-gray-600 dark:text-gray-300 leading-relaxed">
        <SecureMarkdown
          content={content}
          variant="compact"
          className="prose-sm max-w-none"
        />
      </div>
    </section>
  )
}

MessageSection.displayName = 'MessageSection'

/**
 * 工具函数：解析消息内容为章节列表
 * 自动识别 ### 标题作为章节分隔
 */
export function parseMessageSections(content: string): Array<{
  title?: string
  content: string
  index: number
}> {
  const sections: Array<{ title?: string; content: string; index: number }> = []
  const lines = content.split('\n')

  let currentSection: { title?: string; content: string } | null = null
  let sectionIndex = 0

  for (const line of lines) {
    // 匹配 h3 标题（### 标题）
    const h3Match = line.match(/^###\s+(.+)$/)

    if (h3Match) {
      // 保存上一个章节
      if (currentSection && currentSection.content.trim()) {
        sections.push({
          ...currentSection,
          content: currentSection.content.trim(),
          index: sectionIndex++
        })
      }

      // 开始新章节
      currentSection = {
        title: h3Match[1].trim(),
        content: ''
      }
      continue
    }

    // 累积内容到当前章节
    if (currentSection) {
      currentSection.content += line + '\n'
    } else {
      // 如果还没有章节，创建一个无标题的章节
      if (!currentSection) {
        currentSection = {
          content: line + '\n'
        }
      }
    }
  }

  // 保存最后一个章节
  if (currentSection && currentSection.content.trim()) {
    sections.push({
      ...currentSection,
      content: currentSection.content.trim(),
      index: sectionIndex
    })
  }

  // 如果没有解析出任何章节，返回整个内容作为单一章节
  if (sections.length === 0 && content.trim()) {
    return [{
      content: content.trim(),
      index: 0
    }]
  }

  return sections
}
