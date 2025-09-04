"use client"

import { Loader2 } from "lucide-react"

interface LoadingStateProps {
  message?: string
  size?: "sm" | "md" | "lg"
  variant?: "spinner" | "dots" | "pulse" | "skeleton"
  fullScreen?: boolean
  overlay?: boolean
}

export function LoadingState({
  message = "加载中...",
  size = "md",
  variant = "spinner",
  fullScreen = false,
  overlay = false,
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }

  const renderSpinner = () => (
    <div className="flex items-center gap-3">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  )

  const renderDots = () => (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${size === "sm" ? "w-1 h-1" : size === "md" ? "w-2 h-2" : "w-3 h-3"} bg-primary rounded-full animate-pulse`}
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  )

  const renderPulse = () => (
    <div className="flex items-center gap-3">
      <div
        className={`${sizeClasses[size]} bg-primary rounded-full animate-pulse`}
        style={{ animationDuration: "1.5s" }}
      />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  )

  const renderSkeleton = () => (
    <div className="space-y-3 w-full max-w-sm">
      <div className="h-4 bg-muted rounded animate-pulse" />
      <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
      <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
    </div>
  )

  const renderContent = () => {
    switch (variant) {
      case "dots":
        return renderDots()
      case "pulse":
        return renderPulse()
      case "skeleton":
        return renderSkeleton()
      default:
        return renderSpinner()
    }
  }

  const content = <div className="flex items-center justify-center p-4">{renderContent()}</div>

  if (fullScreen) {
    return <div className="fixed inset-0 bg-background flex items-center justify-center z-50">{content}</div>
  }

  if (overlay) {
    return (
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
        {content}
      </div>
    )
  }

  return <div className="flex items-center justify-center min-h-[200px]">{content}</div>
}
