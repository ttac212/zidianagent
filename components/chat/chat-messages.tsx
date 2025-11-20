"use client"

import React, { forwardRef, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"

import { MessageItem } from "./message-item"
import type { ChatMessagesProps } from "@/types/chat"
import { CHAT_CONTAINER_MAX_WIDTH, CHAT_STATE_MAX_WIDTH } from "@/lib/config/layout-config"

const getFriendlyErrorMessage = (rawError: string | null) => {
  const error = rawError ?? ""
  const lower = error.toLowerCase()
  const looksCancelled = /��.+ȡ|��.+��/i.test(error)

  if (
    lower.includes("abort") ||
    lower.includes("cancel") ||
    error.includes("取消") ||
    looksCancelled
  ) {
    return {
      title: "本次回复已取消",
      message: "你或系统中止了本次生成，如需结果请重新发送。",
      action: "重新发送"
    }
  }

  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("timeout") ||
    error.includes("网络")
  ) {
    return {
      title: "网络开小差了",
      message: "请检查网络连接，稍后点击重试即可恢复。",
      action: "重新加载"
    }
  }

  if (
    lower.includes("429") ||
    lower.includes("limit") ||
    lower.includes("quota") ||
    error.includes("频率") ||
    error.includes("配额")
  ) {
    return {
      title: "请求稍微太频繁",
      message: "当前系统负载较高，请稍等片刻后再试。",
      action: "稍后再试"
    }
  }

  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    error.includes("未授权") ||
    error.includes("登录")
  ) {
    return {
      title: "需要重新登录",
      message: "登录状态已失效，请刷新页面或重新登录。",
      action: "刷新页面"
    }
  }

  if (lower.includes("model") || error.includes("模型")) {
    return {
      title: "模型暂时不可用",
      message: "当前 AI 模型正在维护，请稍后重试。",
      action: "再试一次"
    }
  }

  return {
    title: "出现了点小问题",
    message: "这次回答没有成功，我们已记录问题，请稍后再试。",
    action: "重试一次"
  }
}

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
      return messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          onCopy={onCopyMessage ? () => onCopyMessage(message.id) : undefined}
          onRetry={onRetryMessage ? () => onRetryMessage(message.id) : undefined}
        />
      ))
    }, [messages, onCopyMessage, onRetryMessage])

    if (error && messages.length === 0) {
      return (
        <ScrollArea ref={ref} className="h-full w-full">
          <div className="p-4">
            <div className={CHAT_STATE_MAX_WIDTH}>
              <ErrorState error={error} />
            </div>
          </div>
        </ScrollArea>
      )
    }

    if (isLoading && messages.length === 0) {
      return (
        <ScrollArea ref={ref} className="h-full w-full">
          <div className="p-4">
            <div className={CHAT_STATE_MAX_WIDTH}>
              <div className="text-center py-8">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  <span className="text-sm">正在加载消息...</span>
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
        <div className={`space-y-6 min-h-full ${CHAT_CONTAINER_MAX_WIDTH}`}>
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
      </ScrollArea>
    )
  }
)

ChatMessages.displayName = "ChatMessages"

