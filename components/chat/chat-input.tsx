/**
 * 聊天输入组件
 * 包含文本输入、发送按钮、设置面板等
 */

import React, { forwardRef, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Square, Lightbulb, AlertTriangle } from 'lucide-react'
import type { ChatInputProps } from '@/types/chat'
import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea'
import { ModelSelectorAnimated } from './model-selector-animated'

// 推荐问题列表
const SUGGESTED_QUESTIONS = [
  "帮我写一段创意文案",
  "总结一下这段内容",
  "给我一些学习建议",
  "推荐几个选题",
  "写一个文案的开头",
  "解释一个复杂的概念"
]

// 智能占位符文本配置
const PLACEHOLDER_TEXTS = {
  default: [
    "请输入您想要创作",
    "在这里输入您的问题...",
    "让我来帮助您...",
    "有什么我可以帮您的吗？"
  ],
  creative: [
    "来创作一些有趣的内容吧...",
    "让我帮您发挥创意...",
    "输入您的创作想法..."
  ],
  analytical: [
    "请描述需要分析的内容...",
    "输入您想要分析的主题...",
    "让我帮您理解和分析..."
  ],
  conversational: [
    "继续我们的对话...",
    "还有什么想聊的吗？",
    "请继续..."
  ]
}

// 字符限制配置
const CHAR_LIMITS = {
  MAX: 20000,
  SHOW_COUNTER: 15000,
  WARNING: 18000
} as const

// 获取模型名称（简化：直接显示ID；如需名称，请在上层通过 props 注入或统一在头部展示模型名称）
function getModelName(id: string) {
  return id
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(({
  input,
  isLoading,
  settings,
  selectedText,
  onInputChange,
  onSubmit,
  onStop,
  onSettingsChange
}, ref) => {
  // 空输入提示状态
  const [showEmptyInputTip, setShowEmptyInputTip] = useState(false)
  // 输入框聚焦状态
  const [isFocused, setIsFocused] = useState(false)
  // 占位符文本状态
  const [currentPlaceholder, setCurrentPlaceholder] = useState('')
  
  // 字符计数相关状态
  const charCount = useMemo(() => input.length, [input])
  const shouldShowCounter = charCount >= CHAR_LIMITS.SHOW_COUNTER
  const isOverWarningThreshold = charCount >= CHAR_LIMITS.WARNING
  const isOverLimit = charCount > CHAR_LIMITS.MAX
  const remainingChars = CHAR_LIMITS.MAX - charCount
  
  // 智能占位符选择逻辑
  const getSmartPlaceholder = useMemo(() => {
    if (isLoading) return '正在获取返回数据'
    
    // 根据历史对话内容判断上下文类型
    // 这里简化为随机选择，实际项目中可以基于消息历史做更智能的判断
    const contexts = ['default', 'creative', 'analytical', 'conversational'] as const
    const randomContext = contexts[Math.floor(Math.random() * contexts.length)]
    const placeholders = PLACEHOLDER_TEXTS[randomContext]
    
    return placeholders[Math.floor(Math.random() * placeholders.length)]
  }, [isLoading])
  
  // 初始化和更新占位符
  React.useEffect(() => {
    if (!currentPlaceholder) {
      setCurrentPlaceholder(getSmartPlaceholder)
    }
  }, [currentPlaceholder, getSmartPlaceholder])
  
  // 自适应高度：使用统一 Hook（min=72, max=300）
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 72, maxHeight: 300 })
  const setTextareaRef = (node: HTMLTextAreaElement | null) => {
    textareaRef.current = node
    // 透传给外部 forwardRef，保持聚焦与快捷键逻辑不变
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ;(ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading && !isOverLimit) {
        setShowEmptyInputTip(false) // 隐藏提示
        onSubmit(e as any)
      } else if (!input.trim() && !isLoading) {
        // 输入为空时显示友好提示
        setShowEmptyInputTip(true)
        setTimeout(() => setShowEmptyInputTip(false), 5000) // 5秒后自动隐藏
      }
    }
    if (e.key === 'Escape') {
      onStop()
    }
  }
  
  // 处理输入变化，包含字符限制验证
  const handleInputChange = (value: string) => {
    // 如果超过最大限制，截断输入
    const truncatedValue = value.length > CHAR_LIMITS.MAX ? value.slice(0, CHAR_LIMITS.MAX) : value
    onInputChange(truncatedValue)
    adjustHeight()
  }
  
  // 处理输入框聚焦
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true)
    setShowEmptyInputTip(false)
    // 聚焦时可以切换到更具体的占位符
    if (!input.trim()) {
      const focusedPlaceholders = PLACEHOLDER_TEXTS.conversational
      setCurrentPlaceholder(focusedPlaceholders[Math.floor(Math.random() * focusedPlaceholders.length)])
    }
  }
  
  // 处理输入框失焦
  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false)
    // 失焦后2秒切换到默认占位符
    if (!input.trim()) {
      setTimeout(() => {
        setCurrentPlaceholder(getSmartPlaceholder)
      }, 2000)
    }
  }

  // 处理推荐问题点击
  const handleSuggestedQuestion = (question: string) => {
    onInputChange(question)
    setShowEmptyInputTip(false)
  }


  // 暴露 textarea 引用和高度调整函数给外部
  React.useImperativeHandle(ref, () => {
    const element = textareaRef.current
    if (!element) return null
    
    // 创建代理对象，包含textarea的所有方法和属性，以及我们的adjustHeight
    return Object.assign(element, {
      adjustHeight: (reset?: boolean) => {
        adjustHeight(reset)
        }
    })
  }, [])

  // 占位符已通过智能系统管理，这里移除硬编码

  return (
    <div className="bg-transparent p-4 shadow-none">
      <div className="max-w-[720px] mx-auto">
        {/* 选中文本快捷操作 */}
        {selectedText && (
          <div className="border border-border rounded-xl p-2.5 mb-3 bg-muted/50">
            <div className="flex items-center gap-2 text-sm mb-2">
              <span className="text-muted-foreground">检测到选中文本，快捷操作：</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onInputChange(`请帮我优化这段文本：\n\n"${selectedText}"\n\n`)}
              >
                匹配合适的角色来优化这段文本
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onInputChange(`请帮我扩展这段内容：\n\n"${selectedText}"\n\n`)}
              >
                扩展内容，保持风格不变
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onInputChange(`请帮我总结这段文本：\n\n"${selectedText}"\n\n`)}
              >
                总结内容
              </Button>
            </div>
          </div>
        )}

        {/* 输入表单（对齐样例布局） */}
        <form onSubmit={onSubmit}>
          <div className={`bg-muted/50 rounded-2xl p-1.5 transition-all duration-200 ${
            isFocused ? 'ring-2 ring-primary/20 bg-muted/70 shadow-sm' : 'hover:bg-muted/60'
          }`} 
          data-focused={isFocused ? 'true' : 'false'}>
            <div className="relative flex flex-col">
              {/* 输入区域 */}
              <Textarea
                ref={setTextareaRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={currentPlaceholder}
                className={`w-full rounded-xl rounded-b-none px-4 py-3 bg-background border text-foreground resize-none overflow-y-auto outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 !ring-0 !ring-offset-0 scrollbar-hide ${
                  // 聚焦时的特殊样式
                  isFocused ? 'scale-[1.005] shadow-sm' : ''
                } ${
                  // 字符限制相关的边框颜色
                  isOverLimit ? 'border-red-400' : 
                  isOverWarningThreshold ? 'border-amber-400' : 
                  isFocused ? 'border-primary shadow-sm' :
                  'border-border hover:border-border/80'
                } ${
                  // 占位符动画
                  'placeholder:text-muted-foreground placeholder:transition-opacity placeholder:duration-300'
                } ${
                  // 聚焦时占位符淡化效果
                  isFocused && !input.trim() ? 'placeholder:opacity-70' : 'placeholder:opacity-100'
                }`}
                style={{ 
                  // 确保没有水平滚动
                  overflowX: 'hidden',
                  // 隐藏滚动条但保留滚动功能
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  // JavaScript控制高度限制
                  minHeight: '72px',
                  maxHeight: '300px'
                }}
                disabled={isLoading}
                data-chat-composer-input
              />

              {/* 底部工具条 */}
              <div className="h-14 bg-muted/50 rounded-b-xl flex items-center">
                <div className="absolute left-3 right-3 bottom-3 flex items-center justify-between w-[calc(100%-24px)]">
                  <div className="flex items-center gap-2">
                    <ModelSelectorAnimated
                      modelId={settings.modelId}
                      onChange={(id) => onSettingsChange({ modelId: id })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 字符计数器 */}
                    {shouldShowCounter && (
                      <div className={`flex items-center gap-1 text-xs transition-colors duration-200 ${
                        isOverLimit ? 'text-red-500' : 
                        isOverWarningThreshold ? 'text-amber-500' : 
                        'text-muted-foreground'
                      }`}>
                        {isOverWarningThreshold && (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        <span>
                          {isOverLimit ? `超出 ${Math.abs(remainingChars)}` : remainingChars}
                        </span>
                      </div>
                    )}
                    
                    {/* 停止按钮 */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onStop}
                      disabled={!isLoading}
                      className="h-8 w-8 p-0 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
                      aria-label="停止"
                    >
                      <Square className="w-4 h-4" />
                    </Button>

                    {/* 发送按钮 */}
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isLoading || isOverLimit}
                      className="h-8 w-8 p-0 rounded-md"
                      aria-label="发送"
                      onClick={(e) => {
                        if ((!input.trim() || isOverLimit) && !isLoading) {
                          e.preventDefault()
                          if (!input.trim()) {
                            setShowEmptyInputTip(true)
                            setTimeout(() => setShowEmptyInputTip(false), 5000)
                          }
                        }
                      }}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* 空输入友好提示 */}
        {showEmptyInputTip && (
          <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 animate-in slide-in-from-top-2 fade-in-0 duration-300">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                别着急，试试这些问题吧
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED_QUESTIONS.slice(0, 4).map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="text-left text-sm p-2 rounded-lg bg-white dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 text-blue-800 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/70 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              点击上面的问题快速开始对话，或者在输入框中输入您的问题
            </p>
          </div>
        )}

        {/* 字符限制警告 */}
        {isOverWarningThreshold && (
          <div className={`mt-3 p-3 rounded-xl border transition-all duration-200 animate-in slide-in-from-top-2 fade-in-0 ${
            isOverLimit 
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${
                isOverLimit ? 'text-red-500' : 'text-amber-500'
              }`} />
              <span className={`text-sm font-medium ${
                isOverLimit 
                  ? 'text-red-900 dark:text-red-100' 
                  : 'text-amber-900 dark:text-amber-100'
              }`}>
                {isOverLimit 
                  ? `已超出字符限制 ${Math.abs(remainingChars)} 个字符` 
                  : `还可输入 ${remainingChars} 个字符`
                }
              </span>
            </div>
            {isOverLimit && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                请删除多余内容后再发送
              </p>
            )}
          </div>
        )}
        
        {/* 状态信息 */}
        <div className="flex items-center justify-between mt-2 text-xs text-foreground/70">
          <span>按 Enter 发送，Shift + Enter 换行</span>
          <span>
            {!shouldShowCounter && charCount > 0 && (
              <span className="text-muted-foreground">{charCount} 字符</span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
})

ChatInput.displayName = 'ChatInput'
