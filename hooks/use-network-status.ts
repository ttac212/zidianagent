/**
 * 网络状态监控 Hook
 * 提供全面的网络连接状态检测和服务器健康监控
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

export interface NetworkStatus {
  isOnline: boolean
  serverHealthy: boolean
  connectivity: 'good' | 'poor' | 'offline'
  lastCheck: number
  rtt?: number // 往返时间（毫秒）
}

export interface NetworkStatusOptions {
  /** 服务器健康检查间隔（毫秒） */
  healthCheckInterval?: number
  /** 连接恢复后的检查延迟（毫秒） */
  recoveryDelay?: number
  /** RTT阈值，超过此值认为连接质量差（毫秒） */
  poorConnectionThreshold?: number
  /** 是否显示网络状态通知 */
  enableNotifications?: boolean
  /** 健康检查的API端点 */
  healthCheckEndpoint?: string
}

const DEFAULT_OPTIONS: Required<NetworkStatusOptions> = {
  healthCheckInterval: 30000, // 30秒检查一次
  recoveryDelay: 2000,       // 恢复后2秒检查
  poorConnectionThreshold: 2000, // 2秒RTT阈值
  enableNotifications: true,
  healthCheckEndpoint: '/api/health'
}

/**
 * 网络状态监控 Hook
 */
export function useNetworkStatus(options: NetworkStatusOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    serverHealthy: true,
    connectivity: 'good',
    lastCheck: Date.now()
  })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastNotificationRef = useRef<string | null>(null)

  /**
   * 执行服务器健康检查
   */
  const checkServerHealth = useCallback(async (): Promise<{
    healthy: boolean
    rtt?: number
  }> => {
    try {
      const startTime = performance.now()
      
      const response = await fetch(opts.healthCheckEndpoint, {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(10000) // 10秒超时
      })
      
      const endTime = performance.now()
      const rtt = endTime - startTime

      return {
        healthy: response.ok,
        rtt
      }
    } catch (error) {
      return { healthy: false }
    }
  }, [opts.healthCheckEndpoint])

  /**
   * 更新网络状态
   */
  const updateNetworkStatus = useCallback(async () => {
    const isOnline = navigator.onLine
    const { healthy: serverHealthy, rtt } = await checkServerHealth()
    
    let connectivity: NetworkStatus['connectivity'] = 'good'
    if (!isOnline || !serverHealthy) {
      connectivity = 'offline'
    } else if (rtt && rtt > opts.poorConnectionThreshold) {
      connectivity = 'poor'
    }

    const newStatus: NetworkStatus = {
      isOnline,
      serverHealthy,
      connectivity,
      rtt,
      lastCheck: Date.now()
    }

    setNetworkStatus(prev => {
      // 检查是否需要显示通知
      if (opts.enableNotifications) {
        const statusChanged = 
          prev.isOnline !== newStatus.isOnline ||
          prev.serverHealthy !== newStatus.serverHealthy ||
          prev.connectivity !== newStatus.connectivity

        if (statusChanged) {
          showNetworkNotification(newStatus, prev)
        }
      }

      return newStatus
    })

    return newStatus
  }, [checkServerHealth, opts.enableNotifications, opts.poorConnectionThreshold])

  /**
   * 显示网络状态通知
   */
  const showNetworkNotification = useCallback((
    newStatus: NetworkStatus, 
    prevStatus: NetworkStatus
  ) => {
    const now = Date.now()
    
    // 防止通知过于频繁
    if (lastNotificationRef.current === JSON.stringify(newStatus)) {
      return
    }
    
    lastNotificationRef.current = JSON.stringify(newStatus)

    if (!newStatus.isOnline) {
      toast.error('网络连接已断开', {
        description: '请检查您的网络连接',
        duration: 5000
      })
    } else if (!newStatus.serverHealthy) {
      toast.error('服务器连接失败', {
        description: '服务器可能正在维护，请稍后重试',
        duration: 5000
      })
    } else if (newStatus.connectivity === 'poor') {
      toast.warning('网络连接质量较差', {
        description: `响应时间: ${newStatus.rtt?.toFixed(0)}ms`,
        duration: 3000
      })
    } else if (prevStatus.connectivity !== 'good' && newStatus.connectivity === 'good') {
      toast.success('网络连接已恢复', {
        description: '所有功能现已正常运行',
        duration: 3000
      })
    }
  }, [])

  /**
   * 手动触发网络状态检查
   */
  const checkNetworkStatus = useCallback(async () => {
    return await updateNetworkStatus()
  }, [updateNetworkStatus])

  /**
   * 等待网络恢复
   */
  const waitForNetworkRecovery = useCallback(async (
    maxAttempts = 10,
    interval = 2000
  ): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await checkNetworkStatus()
      
      if (status.isOnline && status.serverHealthy) {
        return true
      }
      
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, interval))
      }
    }
    
    return false
  }, [checkNetworkStatus])

  // 监听浏览器网络状态变化
  useEffect(() => {
    const handleOnline = () => {
      setTimeout(updateNetworkStatus, opts.recoveryDelay)
    }

    const handleOffline = () => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        connectivity: 'offline',
        lastCheck: Date.now()
      }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [updateNetworkStatus, opts.recoveryDelay])

  // 定期健康检查
  useEffect(() => {
    const startHealthCheck = () => {
      intervalRef.current = setInterval(() => {
        updateNetworkStatus()
      }, opts.healthCheckInterval)
    }

    // 初始检查
    updateNetworkStatus()
    
    // 启动定期检查
    startHealthCheck()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [updateNetworkStatus, opts.healthCheckInterval])

  // 页面可见性变化时检查网络状态
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(updateNetworkStatus, 1000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [updateNetworkStatus])

  return {
    networkStatus,
    checkNetworkStatus,
    waitForNetworkRecovery,
    // 便捷的状态检查
    isOnline: networkStatus.isOnline,
    isServerHealthy: networkStatus.serverHealthy,
    isConnected: networkStatus.isOnline && networkStatus.serverHealthy,
    connectivity: networkStatus.connectivity,
    rtt: networkStatus.rtt
  }
}

/**
 * 网络状态上下文类型
 */
export type NetworkStatusContextType = ReturnType<typeof useNetworkStatus>