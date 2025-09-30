"use client"

import { useState, useCallback } from "react"
import type { ReactNode } from "react"
import { ErrorState } from "./error-state"
import { LoadingState } from "./loading-state"

interface RetryWrapperProps {
  children: ReactNode
  onRetry: () => Promise<void>
  loading?: boolean
  error?: Error | string | null
  maxRetries?: number
  retryDelay?: number
  loadingMessage?: string
  errorTitle?: string
  errorDescription?: string
  showErrorDetails?: boolean
}

export function RetryWrapper({
  children,
  onRetry,
  loading = false,
  error = null,
  maxRetries = 3,
  retryDelay = 1000,
  loadingMessage = "加载中...",
  errorTitle,
  errorDescription,
  showErrorDetails = false,
}: RetryWrapperProps) {
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = useCallback(async () => {
    if (retryCount >= maxRetries) {
      return
    }

    setIsRetrying(true)
    setRetryCount((prev) => prev + 1)

    try {
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
      await onRetry()
    } catch (_error) {
      } finally {
      setIsRetrying(false)
    }
  }, [onRetry, retryCount, maxRetries, retryDelay])

  if (loading || isRetrying) {
    return <LoadingState message={isRetrying ? `重试中... (${retryCount}/${maxRetries})` : loadingMessage} />
  }

  if (error) {
    const canRetry = retryCount < maxRetries
    return (
      <ErrorState
        title={errorTitle}
        description={errorDescription}
        error={error}
        onRetry={canRetry ? handleRetry : undefined}
        showDetails={showErrorDetails}
        type={typeof error === "string" && error.includes("网络") ? "network" : "generic"}
      />
    )
  }

  return <>{children}</>
}
