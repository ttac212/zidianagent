"use client"

import React, { forwardRef, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"

import { MessageItem } from "./message-item"
import { MessageItemV2 } from "./message-item-v2"
import type { ChatMessagesProps } from "@/types/chat"
import { CHAT_STATE_MAX_WIDTH, CHAT_CONTAINER_MAX_WIDTH } from "@/lib/config/layout-config"
import { getFriendlyErrorMessage } from "@/lib/chat/error-messages"

const ErrorState = React.memo<{ error: string; onRetry?: () => void }>(
  ({ error, onRetry }) => {
    const friendly = getFriendlyErrorMessage(error)

    return (
      <div className="text-center py-8 max-w-sm mx-auto">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.1 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold mb-2 text-foreground">{friendly.title}</h3>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{friendly.message}</p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {friendly.action}
          </button>
        )}
      </div>
    )
  }
)

ErrorState.displayName = "ErrorState"

export const ChatMessages = forwardRef<HTMLDivElement, ChatMessagesProps>(
  (
    {
      messages,
      isLoading,
      error,
      onCopyMessage,
      onRetryMessage,
      onLoadMore,
      hasMoreBefore,
      isLoadingMore
    },
    ref
  ) => {
    const renderedMessages = useMemo(() => {
      return messages.map((message) => {
        // 助手消息使用新组件（无气泡设计）
        if (message.role === 'assistant') {
          return (
            <MessageItemV2
              key={message.id}
              message={message}
              onRetry={onRetryMessage ? () => onRetryMessage(message.id) : undefined}
            />
          )
        }

        // 用户消息保留原组件（有气泡）
        return (
          <MessageItem
            key={message.id}
            message={message}
            onCopy={onCopyMessage ? () => onCopyMessage(message.id) : undefined}
            onRetry={onRetryMessage ? () => onRetryMessage(message.id) : undefined}
          />
        )
      })
    }, [messages, onCopyMessage, onRetryMessage])

    if (error && messages.length === 0) {
      return (
        <ScrollArea ref={ref} className="h-full w-full">
          <div className={CHAT_CONTAINER_MAX_WIDTH}>
            <div className="py-4">
              <div className={CHAT_STATE_MAX_WIDTH}>
                <ErrorState error={error} />
              </div>
            </div>
          </div>
        </ScrollArea>
      )
    }

    if (isLoading && messages.length === 0) {
      return (
        <ScrollArea ref={ref} className="h-full w-full">
          <div className={CHAT_CONTAINER_MAX_WIDTH}>
            <div className="py-4">
              <div className={CHAT_STATE_MAX_WIDTH}>
                <div className="text-center py-8">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                    <span className="text-sm">正在加载消息...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      )
    }

    const inlineError = error ? getFriendlyErrorMessage(error) : null

    return (
      <ScrollArea ref={ref} className="h-full w-full">
        <div className={CHAT_CONTAINER_MAX_WIDTH}>
          <div className="space-y-6 min-h-full py-4">
            {hasMoreBefore && onLoadMore && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoadingMore && (
                    <span className="h-3 w-3 border-b-2 border-current rounded-full animate-spin" />
                  )}
                  {isLoadingMore ? "加载更多消息..." : "加载更早的消息"}
                </button>
              </div>
            )}

            {messages.length === 0 && !isLoading && !error && (
              <div className="text-center py-16">
                <h3 className="text-lg font-medium mb-2">开始新的对话</h3>
                <p className="text-muted-foreground text-sm">
                  在下方输入框中输入你的问题，我会尽力为你解答
                </p>
              </div>
            )}

            {renderedMessages}

            {inlineError && messages.length > 0 && (
              <div className="py-3">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center mt-0.5">
                      <span className="text-destructive text-xs">!</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-destructive mb-1">本次回复失败</h4>
                      <p className="text-xs text-muted-foreground">{inlineError.message}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="h-4" />
          </div>
        </div>
      </ScrollArea>
    )
  }
)

ChatMessages.displayName = "ChatMessages"

