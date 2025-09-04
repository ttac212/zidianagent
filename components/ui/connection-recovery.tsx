/**
 * 连接恢复组件
 * 提供友好的网络连接错误处理和恢复界面
 */

"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Server, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react'
import { smartApi } from '@/lib/utils/smart-fetch'
import { cn } from '@/lib/utils'

export interface ConnectionRecoveryProps {
  /** 是否显示恢复界面 */
  show?: boolean
  /** 错误类型 */
  errorType?: 'network' | 'server' | 'timeout' | 'unknown'
  /** 错误消息 */
  errorMessage?: string
  /** 自动重试间隔（毫秒） */
  autoRetryInterval?: number
  /** 最大自动重试次数 */
  maxAutoRetries?: number
  /** 恢复成功回调 */
  onRecovery?: () => void
  /** 关闭回调 */
  onClose?: () => void
  /** 自定义恢复操作 */
  customRecoveryAction?: () => Promise<boolean>
  /** 是否显示详细状态 */
  showDetailedStatus?: boolean
}

interface RecoveryStatus {
  isRetrying: boolean
  currentAttempt: number
  maxAttempts: number
  lastAttemptTime?: number
  nextRetryTime?: number
  connectionQuality?: 'good' | 'poor' | 'offline'
  serverStatus?: 'healthy' | 'unhealthy' | 'unknown'
}

export function ConnectionRecovery({
  show = true,
  errorType = 'unknown',
  errorMessage,
  autoRetryInterval = 5000,
  maxAutoRetries = 5,
  onRecovery,
  onClose,
  customRecoveryAction,
  showDetailedStatus = true
}: ConnectionRecoveryProps) {
  const [status, setStatus] = useState<RecoveryStatus>({
    isRetrying: false,
    currentAttempt: 0,
    maxAttempts: maxAutoRetries
  })

  const [countdown, setCountdown] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)

  /**
   * 执行连接检查
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      if (customRecoveryAction) {
        return await customRecoveryAction()
      }

      // 检查网络状态
      const networkOnline = navigator.onLine
      if (!networkOnline) {
        setStatus(prev => ({ 
          ...prev, 
          connectionQuality: 'offline',
          serverStatus: 'unknown'
        }))
        return false
      }

      // 检查服务器健康状态
      const response = await smartApi.get('/api/health', {
        timeout: 8000,
        retry: { maxRetries: 1 }
      })

      const isHealthy = response.ok
      
      setStatus(prev => ({ 
        ...prev,
        connectionQuality: isHealthy ? 'good' : 'poor',
        serverStatus: isHealthy ? 'healthy' : 'unhealthy'
      }))

      return isHealthy
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        connectionQuality: 'offline',
        serverStatus: 'unhealthy'
      }))
      
      return false
    }
  }, [customRecoveryAction])

  /**
   * 执行恢复尝试
   */
  const attemptRecovery = useCallback(async (manual = false) => {
    if (status.isRetrying && !manual) return

    setStatus(prev => ({
      ...prev,
      isRetrying: true,
      currentAttempt: manual ? prev.currentAttempt + 1 : prev.currentAttempt,
      lastAttemptTime: Date.now()
    }))

    try {
      const success = await checkConnection()
      
      if (success) {
        onRecovery?.()
        return true
      } else {
        setStatus(prev => ({
          ...prev,
          currentAttempt: prev.currentAttempt + 1,
          nextRetryTime: Date.now() + autoRetryInterval
        }))
        return false
      }
    } catch (error) {
      return false
    } finally {
      setStatus(prev => ({ ...prev, isRetrying: false }))
    }
  }, [status.isRetrying, checkConnection, autoRetryInterval, onRecovery])

  /**
   * 自动重试逻辑
   */
  useEffect(() => {
    if (!show || status.currentAttempt >= status.maxAttempts) return

    const timer = setTimeout(() => {
      attemptRecovery(false)
    }, autoRetryInterval)

    return () => clearTimeout(timer)
  }, [show, status.currentAttempt, status.maxAttempts, autoRetryInterval, attemptRecovery])

  /**
   * 倒计时逻辑
   */
  useEffect(() => {
    if (!status.nextRetryTime || status.isRetrying) return

    const updateCountdown = () => {
      const remaining = Math.max(0, status.nextRetryTime! - Date.now())
      setCountdown(Math.ceil(remaining / 1000))
      
      if (remaining <= 0) {
        setCountdown(0)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [status.nextRetryTime, status.isRetrying])

  /**
   * 获取错误配置
   */
  const getErrorConfig = useCallback(() => {
    switch (errorType) {
      case 'network':
        return {
          icon: WifiOff,
          title: '网络连接中断',
          description: '无法连接到网络，请检查您的网络设置',
          color: 'text-red-500',
          bgColor: 'bg-red-50 dark:bg-red-950/20'
        }
      case 'server':
        return {
          icon: Server,
          title: '服务器连接失败',
          description: '服务器可能正在维护或遇到问题',
          color: 'text-orange-500',
          bgColor: 'bg-orange-50 dark:bg-orange-950/20'
        }
      case 'timeout':
        return {
          icon: Clock,
          title: '连接超时',
          description: '服务器响应时间过长，请稍后重试',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/20'
        }
      default:
        return {
          icon: AlertTriangle,
          title: '连接异常',
          description: errorMessage || '遇到未知的连接问题',
          color: 'text-gray-500',
          bgColor: 'bg-gray-50 dark:bg-gray-950/20'
        }
    }
  }, [errorType, errorMessage])

  /**
   * 获取状态指示器
   */
  const getStatusIndicator = () => {
    const { connectionQuality, serverStatus } = status

    if (connectionQuality === 'offline') {
      return <Badge variant="destructive" className="gap-1">
        <WifiOff className="w-3 h-3" />
        离线
      </Badge>
    }

    if (serverStatus === 'unhealthy') {
      return <Badge variant="destructive" className="gap-1">
        <Server className="w-3 h-3" />
        服务器异常
      </Badge>
    }

    if (connectionQuality === 'poor') {
      return <Badge variant="secondary" className="gap-1">
        <Activity className="w-3 h-3" />
        连接质量差
      </Badge>
    }

    if (connectionQuality === 'good' && serverStatus === 'healthy') {
      return <Badge variant="default" className="gap-1 bg-green-500">
        <CheckCircle className="w-3 h-3" />
        连接正常
      </Badge>
    }

    return null
  }

  if (!show) return null

  const errorConfig = getErrorConfig()
  const Icon = errorConfig.icon
  const progress = (status.currentAttempt / status.maxAttempts) * 100

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className={cn("w-full max-w-md", errorConfig.bgColor)}>
        <CardHeader className="text-center pb-4">
          <div className={cn("w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center", errorConfig.bgColor)}>
            <Icon className={cn("w-8 h-8", errorConfig.color)} />
          </div>
          
          <CardTitle className="flex items-center justify-center gap-2">
            {errorConfig.title}
            {showDetailedStatus && getStatusIndicator()}
          </CardTitle>
          
          <p className="text-sm text-muted-foreground">
            {errorConfig.description}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 重试进度 */}
          {status.currentAttempt > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>重试进度</span>
                <span>{status.currentAttempt}/{status.maxAttempts}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* 倒计时 */}
          {countdown > 0 && !status.isRetrying && (
            <div className="text-center text-sm text-muted-foreground">
              {countdown} 秒后自动重试...
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button 
              onClick={() => attemptRecovery(true)} 
              disabled={status.isRetrying}
              className="flex-1"
            >
              {status.isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  重连中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  立即重试
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              刷新页面
            </Button>
          </div>

          {/* 高级选项 */}
          {showDetailedStatus && (
            <div className="space-y-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full text-xs"
              >
                {showAdvanced ? '隐藏' : '显示'}详细状态
              </Button>

              {showAdvanced && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-medium">网络状态:</span>
                      <br />
                      <span className={cn(
                        navigator.onLine ? 'text-green-600' : 'text-red-600'
                      )}>
                        {navigator.onLine ? '在线' : '离线'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">连接质量:</span>
                      <br />
                      <span>
                        {status.connectionQuality === 'good' ? '良好' : 
                         status.connectionQuality === 'poor' ? '较差' : '离线'}
                      </span>
                    </div>
                  </div>
                  
                  {status.lastAttemptTime && (
                    <div className="text-muted-foreground">
                      上次检查: {new Date(status.lastAttemptTime).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 关闭按钮 */}
          {onClose && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="w-full"
            >
              暂时关闭提示
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}