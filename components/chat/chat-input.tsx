/**
 * 聊天输入框 - 重写完成版
 * 支持键盘快捷键、流式响应、移动端优化、推理模式设置
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState
} from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Square, X, Sparkles, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatInputProps } from '@/types/chat'
import { CHAT_CONTAINER_MAX_WIDTH } from '@/lib/config/layout-config'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const MAX_LENGTH = 100_000
const MIN_HEIGHT = 56
const MAX_HEIGHT = 240

const ChatInputComponent = forwardRef<HTMLTextAreaElement, ChatInputProps>(({
  input,
  isLoading,
  settings,
  onInputChange,
  onSubmit,
  onStop,
  onSettingsChange
}, forwardedRef) => {
  const internalRef = useRef<HTMLTextAreaElement | null>(null)

  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      internalRef.current = node

      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
      }
    },
    [forwardedRef]
  )

  const [isFocused, setIsFocused] = useState(false)

  const inputId = useId()
  const textareaId = `${inputId}-textarea`
  const helperId = `${inputId}-helper`
  const counterId = `${inputId}-counter`

  useEffect(() => {
    const textarea = internalRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const nextHeight = Math.max(MIN_HEIGHT, Math.min(textarea.scrollHeight, MAX_HEIGHT))
    textarea.style.height = `${nextHeight}px`
  }, [input])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (input.trim() && !isLoading && input.length <= MAX_LENGTH) {
        const form = (event.target as HTMLTextAreaElement).closest('form')
        form?.requestSubmit()
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      if (isLoading) {
        onStop()
      } else if (input.trim()) {
        clearInput()
      }
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading || trimmed.length > MAX_LENGTH) return
    onSubmit(event)
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value
    if (value.length > MAX_LENGTH) {
      onInputChange(value.slice(0, MAX_LENGTH))
      return
    }
    onInputChange(value)
  }

  const handleFocus = () => setIsFocused(true)
  const handleBlur = () => setIsFocused(false)

  const clearInput = () => {
    onInputChange('')
    requestAnimationFrame(() => {
      if (internalRef.current) {
        internalRef.current.style.height = 'auto'
        internalRef.current.style.height = `${MIN_HEIGHT}px`
        internalRef.current.focus()
      }
    })
  }

  const charCount = input.length
  const hasInput = input.trim().length > 0
  const isAtLimit = charCount >= MAX_LENGTH
  const isNearLimit = !isAtLimit && charCount >= Math.floor(MAX_LENGTH * 0.9)
  const remaining = Math.max(MAX_LENGTH - charCount, 0)

  // 推理强度标签映射
  const reasoningEffortLabels = {
    low: '低',
    medium: '中',
    high: '高'
  } as const

  const helperMessage = isAtLimit
    ? `已达到 ${MAX_LENGTH.toLocaleString()} 字符上限，请删减后再发送`
    : 'Enter 发送 · Shift+Enter 换行 · Esc 停止'

  const cardClassName = cn(
    'group relative w-full rounded-2xl border transition-all duration-300 ease-out',
    'bg-card/95 backdrop-blur-sm shadow-sm',
    'border-border/60 hover:shadow-md',
    'focus-within:shadow-lg focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20',
    isFocused && 'shadow-lg border-primary/60 ring-2 ring-primary/20',
    isNearLimit && !isAtLimit && [
      'focus-within:border-amber-500/70 focus-within:ring-amber-500/30',
      'border-amber-500/50 shadow-amber-500/10'
    ],
    isAtLimit && [
      'border-destructive/70 focus-within:border-destructive/70 focus-within:ring-destructive/20',
      'shadow-destructive/10 bg-destructive/5'
    ],
    isLoading && 'opacity-95 cursor-progress'
  )

  return (
    <div className="sticky bottom-0 bg-background/80 backdrop-blur-xl border-t border-border/40 pb-safe z-10">
      <div className="px-4 py-3 sm:py-4">
        <div className={CHAT_CONTAINER_MAX_WIDTH}>
          <form onSubmit={handleSubmit} className={cardClassName} aria-busy={isLoading}>
            <div className="flex items-end gap-2 p-4">
              <div className="flex-1 min-w-0">
                <label htmlFor={textareaId} className="sr-only">
                  聊天消息输入框
                </label>
                <Textarea
                  id={textareaId}
                  ref={setTextareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder={isLoading ? '正在思考...' : '输入消息... (Enter 发送，Shift+Enter 换行)'}
                  disabled={isLoading}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  maxLength={MAX_LENGTH}
                  name="chat-input"
                  role="textbox"
                  aria-label="聊天消息输入框"
                  aria-describedby={`${helperId} ${counterId}`}
                  aria-invalid={isAtLimit}
                  aria-busy={isLoading}
                  aria-multiline="true"
                  aria-required="true"
                  className={cn(
                    'min-h-[48px] border-0 bg-transparent p-0 text-base leading-6 resize-none',
                    'focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60',
                    'touch-manipulation scroll-smooth',
                    isLoading && 'text-muted-foreground/70 cursor-progress'
                  )}
                  style={{
                    height: `${MIN_HEIGHT}px`,
                    transition: 'height 0.15s ease-out',
                    minHeight: `${MIN_HEIGHT}px`,
                    maxHeight: `${MAX_HEIGHT}px`
                  }}
                />
              </div>

              <div className="flex items-end gap-1.5 flex-shrink-0">
                {hasInput && !isLoading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearInput}
                    className={cn(
                      'h-8 w-8 p-0 text-muted-foreground hover:text-foreground',
                      'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                      'transition-opacity duration-200 touch-manipulation'
                    )}
                    aria-label="清空输入框"
                    title="清空输入 (Esc)"
                    tabIndex={-1}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}

                {isLoading ? (
                  <Button
                    type="button"
                    onClick={onStop}
                    variant="secondary"
                    size="sm"
                    className={cn(
                      'h-10 w-10 p-0 transition-all duration-200 touch-manipulation',
                      'bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/20',
                      'focus-visible:ring-destructive/30'
                    )}
                    aria-label="停止AI回复"
                    title="停止生成 (Esc)"
                  >
                    <Square className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={!hasInput || isAtLimit}
                    size="sm"
                    className={cn(
                      'h-10 w-10 p-0 transition-all duration-200 touch-manipulation',
                      hasInput && !isAtLimit
                        ? 'bg-primary hover:bg-primary/90 shadow-sm text-primary-foreground focus-visible:ring-primary/30'
                        : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                    )}
                    aria-label={
                      !hasInput
                        ? '请输入内容后再发送'
                        : isAtLimit
                        ? '字符数已达上限，无法发送'
                        : '发送消息'
                    }
                    title={
                      !hasInput
                        ? '请输入内容'
                        : isAtLimit
                        ? '字符数超出限制'
                        : '发送消息 (Enter)'
                    }
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-4 pb-3 gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  id={helperId}
                  className="flex-shrink text-xs text-muted-foreground/80"
                  aria-live="polite"
                  role="status"
                  aria-atomic="true"
                >
                  <span className="hidden sm:inline">{helperMessage}</span>
                  <span className="sm:hidden">
                    {isLoading ? '生成中...' : 'Enter 发送 · Esc 停止'}
                  </span>
                </div>

                {/* 模型标识（固定显示，不可点击） */}
                <div className="h-6 px-2 text-xs font-medium shrink-0 flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  <span className="hidden sm:inline">Sonnet 4.5</span>
                </div>

                {/* 创作模式切换 */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSettingsChange({ creativeMode: !settings.creativeMode })}
                  disabled={isLoading}
                  className={cn(
                    'h-6 px-2 text-xs gap-1 transition-all shrink-0',
                    settings.creativeMode
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-label={settings.creativeMode ? '关闭创作模式' : '开启创作模式'}
                  title={
                    settings.creativeMode
                      ? '创作模式已开启 - 使用90%上下文容量'
                      : '开启创作模式 - 提升上下文限制至180k tokens'
                  }
                >
                  <Sparkles className={cn('h-3 w-3', settings.creativeMode && 'fill-current')} />
                  <span className="hidden sm:inline">
                    {settings.creativeMode ? '创作' : '标准'}
                  </span>
                </Button>

                {/* 推理强度选择器（总是显示） */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isLoading}
                      className={cn(
                        'h-6 px-2 text-xs gap-1 transition-all shrink-0',
                        settings.reasoning_effort
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      aria-label={`推理强度: ${settings.reasoning_effort ? reasoningEffortLabels[settings.reasoning_effort] : '关闭'}`}
                      title="设置推理强度"
                    >
                      <Brain className={cn('h-3 w-3', settings.reasoning_effort && 'fill-current')} />
                      <span className="hidden sm:inline">
                        {settings.reasoning_effort ? reasoningEffortLabels[settings.reasoning_effort] : '思考'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem
                      onClick={() => onSettingsChange({ reasoning_effort: undefined, reasoning: { enabled: false } })}
                      className={cn(!settings.reasoning_effort && 'bg-accent')}
                    >
                      <span className="w-full">关闭</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onSettingsChange({ reasoning_effort: 'low', reasoning: { enabled: true } })}
                      className={cn(settings.reasoning_effort === 'low' && 'bg-accent')}
                    >
                      <span className="w-full">低强度</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onSettingsChange({ reasoning_effort: 'medium', reasoning: { enabled: true } })}
                      className={cn(settings.reasoning_effort === 'medium' && 'bg-accent')}
                    >
                      <span className="w-full">中强度</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onSettingsChange({ reasoning_effort: 'high', reasoning: { enabled: true } })}
                      className={cn(settings.reasoning_effort === 'high' && 'bg-accent')}
                    >
                      <span className="w-full">高强度</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div
                id={counterId}
                className={cn(
                  'flex-shrink-0 text-xs tabular-nums font-mono transition-colors duration-200',
                  isAtLimit && 'text-destructive font-semibold',
                  isNearLimit && !isAtLimit && 'text-amber-600 dark:text-amber-400 font-medium',
                  !isNearLimit && !isAtLimit && 'text-muted-foreground/60'
                )}
                aria-live="polite"
                role="status"
                aria-label={`已输入 ${charCount} 个字符，剩余 ${remaining} 个字符`}
              >
                {charCount.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
})

ChatInputComponent.displayName = 'ChatInput'

export const ChatInput = ChatInputComponent
