"use client"

import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface SecureMarkdownProps {
  content: string
  className?: string
  /**
   * 是否启用GitHub风格的Markdown扩展
   * 支持表格、删除线、任务列表等
   */
  enableGfm?: boolean
  /**
   * 自定义样式主题
   */
  variant?: 'default' | 'compact' | 'prose'
}

/**
 * 安全的Markdown渲染组件
 * 
 * 特性:
 * - 🛡️ 内置XSS防护，无需dangerouslySetInnerHTML
 * - 🎨 完美兼容现有TailwindCSS样式
 * - 📝 支持GitHub风格Markdown扩展
 * - ⚡ React虚拟DOM优化性能
 * - 🔧 类型安全的TypeScript支持
 */
export function SecureMarkdown({ 
  content, 
  className,
  enableGfm = true,
  variant = 'default'
}: SecureMarkdownProps) {
  // 基础样式类
  const baseClasses = {
    default: "prose prose-sm max-w-none dark:prose-invert",
    compact: "text-sm leading-relaxed",
    prose: "prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-p:my-2"
  }

  // 插件配置
  const plugins = {
    remark: enableGfm ? [remarkGfm] : [],
    rehype: [rehypeSanitize] // 核心安全防护
  }

  // 自定义组件映射 - 保持与原有样式一致
  const components = {
    // 标题样式 - 完全匹配原有设计
    h1: ({ children, ...props }: any) => (
      <h1 className="text-2xl font-bold mt-8 mb-4" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="text-xl font-semibold mt-6 mb-3" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="text-lg font-semibold mt-4 mb-2" {...props}>
        {children}
      </h3>
    ),
    
    // 文本样式
    strong: ({ children, ...props }: any) => (
      <strong className="font-semibold" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }: any) => (
      <em className="italic" {...props}>
        {children}
      </em>
    ),
    
    // 代码样式
    code: ({ children, className, ...props }: any) => {
      // 区分行内代码和代码块
      const isInline = !className?.includes('language-')
      
      if (isInline) {
        return (
          <code 
            className="bg-muted px-1 py-0.5 rounded text-sm font-mono" 
            {...props}
          >
            {children}
          </code>
        )
      }
      
      // 代码块样式
      return (
        <code 
          className={cn("block bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto", className)} 
          {...props}
        >
          {children}
        </code>
      )
    },
    
    // 列表样式 - 保持原有的bullet点设计
    ul: ({ children, ...props }: any) => (
      <ul className="my-2" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="my-2 list-decimal list-inside" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="ml-4 my-1" {...props}>
        {typeof children === 'string' && children.startsWith('• ') 
          ? children.substring(2) 
          : children}
      </li>
    ),
    
    // 段落和换行
    p: ({ children, ...props }: any) => (
      <p className="my-2 leading-relaxed" {...props}>
        {children}
      </p>
    ),
    br: ({ ...props }: any) => <br {...props} />,
    
    // GitHub风格扩展 - 表格
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-border" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className="bg-muted" {...props}>
        {children}
      </thead>
    ),
    tbody: ({ children, ...props }: any) => (
      <tbody {...props}>
        {children}
      </tbody>
    ),
    tr: ({ children, ...props }: any) => (
      <tr className="border-b border-border" {...props}>
        {children}
      </tr>
    ),
    th: ({ children, ...props }: any) => (
      <th className="border border-border px-4 py-2 text-left font-semibold" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="border border-border px-4 py-2" {...props}>
        {children}
      </td>
    ),
    
    // 删除线
    del: ({ children, ...props }: any) => (
      <del className="line-through opacity-75" {...props}>
        {children}
      </del>
    ),
    
    // 链接 - 安全处理
    a: ({ children, href, ...props }: any) => (
      <a 
        href={href}
        className="text-primary hover:text-primary/80 underline transition-colors"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        {...props}
      >
        {children}
      </a>
    ),
    
    // 引用块
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="border-l-4 border-muted-foreground/20 pl-4 my-4 italic" {...props}>
        {children}
      </blockquote>
    ),
    
    // 分隔线
    hr: ({ ...props }: any) => (
      <hr className="my-6 border-border" {...props} />
    ),
  }

  // 处理空内容
  if (!content?.trim()) {
    return (
      <div className={cn("text-muted-foreground text-center py-4", className)}>
        暂无内容
      </div>
    )
  }

  return (
    <div className={cn(baseClasses[variant], className)}>
      <ReactMarkdown
        remarkPlugins={plugins.remark}
        rehypePlugins={plugins.rehype}
        components={components}
        // 关键安全配置
        skipHtml={false} // 允许HTML但会被sanitize清理
        urlTransform={(url) => {
          // URL安全转换 - 只允许安全协议
          if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('vbscript:')) {
            return '#'
          }
          return url
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

/**
 * 简化版安全Markdown组件 - 用于快速替换
 */
export function SafeMarkdown({ content, className }: { content: string; className?: string }) {
  return <SecureMarkdown content={content} className={className} variant="default" />
}

export default SecureMarkdown