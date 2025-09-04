"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, RefreshCw, Home, ArrowLeft, WifiOff } from "lucide-react"

interface ErrorStateProps {
  title?: string
  description?: string
  error?: Error | string
  onRetry?: () => void
  onGoBack?: () => void
  onGoHome?: () => void
  showDetails?: boolean
  type?: "network" | "server" | "client" | "notFound" | "generic"
}

export function ErrorState({
  title,
  description,
  error,
  onRetry,
  onGoBack,
  onGoHome,
  showDetails = false,
  type = "generic",
}: ErrorStateProps) {
  const getErrorConfig = () => {
    switch (type) {
      case "network":
        return {
          icon: <WifiOff className="h-8 w-8 text-destructive" />,
          defaultTitle: "网络连接失败",
          defaultDescription: "请检查您的网络连接，然后重试",
        }
      case "server":
        return {
          icon: <AlertTriangle className="h-8 w-8 text-destructive" />,
          defaultTitle: "服务器错误",
          defaultDescription: "服务器暂时无法响应，请稍后重试",
        }
      case "client":
        return {
          icon: <AlertTriangle className="h-8 w-8 text-destructive" />,
          defaultTitle: "请求错误",
          defaultDescription: "请求参数有误，请检查后重试",
        }
      case "notFound":
        return {
          icon: <AlertTriangle className="h-8 w-8 text-muted-foreground" />,
          defaultTitle: "页面未找到",
          defaultDescription: "您访问的页面不存在或已被移除",
        }
      default:
        return {
          icon: <AlertTriangle className="h-8 w-8 text-destructive" />,
          defaultTitle: "出现了一些问题",
          defaultDescription: "应用程序遇到了意外错误",
        }
    }
  }

  const config = getErrorConfig()
  const errorMessage = typeof error === "string" ? error : error?.message

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            {config.icon}
          </div>
          <CardTitle className="text-lg">{title || config.defaultTitle}</CardTitle>
          <CardDescription>{description || config.defaultDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            {onRetry && (
              <Button onClick={onRetry} className="gap-2 w-full">
                <RefreshCw className="h-4 w-4" />
                重试
              </Button>
            )}
            <div className="flex gap-2">
              {onGoBack && (
                <Button variant="outline" onClick={onGoBack} className="gap-2 flex-1 bg-transparent">
                  <ArrowLeft className="h-4 w-4" />
                  返回
                </Button>
              )}
              {onGoHome && (
                <Button variant="outline" onClick={onGoHome} className="gap-2 flex-1 bg-transparent">
                  <Home className="h-4 w-4" />
                  首页
                </Button>
              )}
            </div>
          </div>

          {showDetails && errorMessage && (
            <details className="text-left">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                查看错误详情
              </summary>
              <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                {errorMessage}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
