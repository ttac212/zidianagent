/**
 * 聊天错误边界组件
 * 捕获和处理聊天组件中的错误
 */

import React, { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // 调用错误回调
    this.props.onError?.(error, errorInfo)

    // 错误上报
    // 可以在这里添加错误上报服务
    // errorReportingService.report(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 默认错误 UI
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            
            <h2 className="text-xl font-semibold mb-2 text-destructive">
              聊天组件出现错误
            </h2>
            
            <p className="text-muted-foreground mb-4">
              抱歉，聊天功能遇到了一些问题。请尝试刷新页面或联系技术支持。
            </p>

            {/* 错误详情（仅在开发环境显示） */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left mb-4 p-3 bg-muted rounded-lg">
                <summary className="cursor-pointer text-sm font-medium mb-2">
                  错误详情（开发模式）
                </summary>
                <pre className="text-xs text-muted-foreground overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2 justify-center">
              <Button onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                重试
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                刷新页面
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * 错误边界 Hook 版本（用于函数组件）
 */
export function useChatErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const handleError = React.useCallback((error: Error) => {
    setError(error)
    }, [])

  // 错误边界效果
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleError(new Error(event.reason))
    }

    const handleError = (event: ErrorEvent) => {
      handleError(new Error(event.message))
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [handleError])

  return {
    error,
    resetError,
    handleError
  }
}
