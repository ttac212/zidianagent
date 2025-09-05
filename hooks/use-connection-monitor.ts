/**
 * 自适应连接监控Hook - 核心组件
 * 特性：自适应检查间隔、内存泄漏防范、资源管理、页面可见性检测
 * Phase 1: 基础设施搭建
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// 自适应检查间隔策略
const ADAPTIVE_INTERVALS = {
  HEALTHY: 30000,      // 正常状态30秒
  RECOVERING: 10000,   // 恢复中10秒  
  CRITICAL: 5000,      // 严重异常5秒
  MAX_FAILURES: 3      // 连续失败3次进入严重模式
} as const;

// 连接状态接口
export interface ConnectionState {
  isOnline: boolean;
  isServerHealthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  currentInterval: number;
  error?: string;
  responseTime?: number;
  serverStatus?: 'healthy' | 'unhealthy' | 'disabled';
}

// Hook选项接口
export interface UseConnectionMonitorOptions {
  baseInterval?: number;
  healthEndpoint?: string;
  enabled?: boolean;
  maxRetries?: number;
  timeout?: number;
  onStatusChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
  onRecover?: () => void;
}

// 调试信息接口
export interface ConnectionDebugInfo {
  enabled: boolean;
  currentInterval: number;
  consecutiveFailures: number;
  adaptiveMode: 'HEALTHY' | 'RECOVERING' | 'CRITICAL';
  lastCheckTime: string;
  totalChecks: number;
  successRate: number;
}

export function useConnectionMonitor(options: UseConnectionMonitorOptions = {}) {
  const {
    baseInterval = ADAPTIVE_INTERVALS.HEALTHY,
    healthEndpoint = '/api/health',
    enabled = process.env.NEXT_PUBLIC_CONNECTION_MONITORING !== 'disabled',
    maxRetries = 3,
    timeout = 8000,
    onStatusChange,
    onError,
    onRecover
  } = options;

  // 状态管理 - 使用一致的初始值避免hydration不匹配
  const [state, setState] = useState<ConnectionState>({
    isOnline: true, // 始终使用true作为初始值，避免服务端/客户端不一致
    isServerHealthy: true,
    lastCheck: 0,
    consecutiveFailures: 0,
    currentInterval: baseInterval,
  });
  
  // 客户端mounted状态
  const [isMounted, setIsMounted] = useState(false);

  // 资源管理 - 防止内存泄漏的关键
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);
  const isUnmountedRef = useRef(false);
  const statsRef = useRef({ totalChecks: 0, successfulChecks: 0 });
  const hasInitialized = useRef(false);

  // 资源清理函数管理
  const addCleanup = useCallback((cleanup: () => void) => {
    if (!isUnmountedRef.current) {
      cleanupRef.current.push(cleanup);
    }
  }, []);

  // 获取自适应检查间隔
  const getAdaptiveInterval = useCallback((failures: number): number => {
    if (failures === 0) return ADAPTIVE_INTERVALS.HEALTHY;
    if (failures <= 2) return ADAPTIVE_INTERVALS.RECOVERING;  
    return ADAPTIVE_INTERVALS.CRITICAL;
  }, []);

  // 获取自适应模式字符串
  const getAdaptiveMode = useCallback((failures: number): 'HEALTHY' | 'RECOVERING' | 'CRITICAL' => {
    if (failures === 0) return 'HEALTHY';
    if (failures <= 2) return 'RECOVERING';
    return 'CRITICAL';
  }, []);

  // 更新状态的统一方法
  const updateState = useCallback((updates: Partial<ConnectionState>) => {
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      
      // 触发状态变化回调
      if (onStatusChange) {
        try {
          onStatusChange(newState);
        } catch (error) {
          }
      }
      
      return newState;
    });
  }, [onStatusChange]);

  // 健康检查核心逻辑
  const performHealthCheck = useCallback(async (): Promise<void> => {
    if (!enabled || isUnmountedRef.current) {
      return;
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const startTime = Date.now();
    statsRef.current.totalChecks++;

    try {
      // 构建请求
      const response = await fetch(healthEndpoint, {
        method: 'GET',
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'X-Requested-With': 'XMLHttpRequest'
        },
        // 注意：fetch timeout 在所有浏览器中都不完全支持，使用AbortController
      });

      const responseTime = Date.now() - startTime;

      // 检查响应超时
      if (responseTime > timeout) {
        throw new Error(`Request timeout (${responseTime}ms > ${timeout}ms)`);
      }

      // 解析响应
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${parseError}`);
      }

      const isHealthy = response.ok && 
                       response.status === 200 && 
                       responseData?.status === 'healthy';

      if (!isUnmountedRef.current) {
        const newFailures = isHealthy ? 0 : state.consecutiveFailures + 1;
        const newInterval = getAdaptiveInterval(newFailures);

        // 如果从失败状态恢复，触发恢复回调
        if (state.consecutiveFailures > 0 && isHealthy && onRecover) {
          try {
            onRecover();
          } catch (error) {
            }
        }

        if (isHealthy) {
          statsRef.current.successfulChecks++;
        }

        updateState({
          isServerHealthy: isHealthy,
          lastCheck: Date.now(),
          consecutiveFailures: newFailures,
          currentInterval: newInterval,
          responseTime,
          serverStatus: responseData?.status,
          error: isHealthy ? undefined : `Server returned ${response.status}`,
        });

        // 自适应调整检查间隔
        if (newInterval !== state.currentInterval) {
          rescheduleCheck(newInterval);
        }
      }

    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && !isUnmountedRef.current) {
        const newFailures = state.consecutiveFailures + 1;
        const newInterval = getAdaptiveInterval(newFailures);
        
        const errorMessage = error instanceof Error ? error.message : 'Network error';
        
        // 触发错误回调
        if (onError) {
          try {
            onError(error instanceof Error ? error : new Error(errorMessage));
          } catch (callbackError) {
            }
        }

        updateState({
          isServerHealthy: false,
          lastCheck: Date.now(),
          consecutiveFailures: newFailures,
          currentInterval: newInterval,
          error: errorMessage,
        });

        // 自适应调整检查间隔
        if (newInterval !== state.currentInterval) {
          rescheduleCheck(newInterval);
        }
      }
    }
  }, [
    enabled, 
    healthEndpoint, 
    timeout, 
    state.consecutiveFailures, 
    state.currentInterval, 
    getAdaptiveInterval, 
    updateState, 
    onError, 
    onRecover
  ]);

  // 重新安排检查任务
  const rescheduleCheck = useCallback((newInterval: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    if (!isUnmountedRef.current && enabled) {
      intervalRef.current = setInterval(performHealthCheck, newInterval);
    }
  }, [enabled, performHealthCheck]);

  // 手动触发健康检查
  const triggerHealthCheck = useCallback((): void => {
    if (!isUnmountedRef.current && enabled) {
      performHealthCheck();
    }
  }, [enabled, performHealthCheck]);

  // 客户端挂载后初始化真实状态
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasInitialized.current) {
      hasInitialized.current = true;
      setIsMounted(true);
      // 同步浏览器的真实在线状态
      const actualOnlineStatus = navigator.onLine;
      if (actualOnlineStatus !== state.isOnline) {
        updateState({ isOnline: actualOnlineStatus });
      }
    }
  }, [state.isOnline, updateState]);

  // 监听网络状态变化
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      if (!isUnmountedRef.current) {
        updateState({ 
          isOnline: true, 
          consecutiveFailures: 0,
          error: undefined 
        });
        
        // 网络恢复时延迟1秒后检查，避免网络抖动
        setTimeout(() => {
          if (!isUnmountedRef.current) {
            performHealthCheck();
          }
        }, 1000);
      }
    };

    const handleOffline = () => {
      if (!isUnmountedRef.current) {
        updateState({ 
          isOnline: false,
          isServerHealthy: false,
          error: 'Network offline'
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    addCleanup(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateState, performHealthCheck, addCleanup]);

  // 监听页面可见性变化
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (!document.hidden && !isUnmountedRef.current) {
        // 页面重新激活时延迟检查
        setTimeout(() => {
          if (!isUnmountedRef.current) {
            performHealthCheck();
          }
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    addCleanup(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [performHealthCheck, addCleanup]);

  // 主要的定期健康检查逻辑
  useEffect(() => {
    if (!enabled) return;

    // 初始检查（延迟1秒，让组件完全挂载）
    const initialCheckTimeout = setTimeout(() => {
      if (!isUnmountedRef.current) {
        performHealthCheck();
      }
    }, 1000);

    // 设置定期检查
    rescheduleCheck(state.currentInterval);

    return () => {
      clearTimeout(initialCheckTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, state.currentInterval, rescheduleCheck, performHealthCheck]);

  // 组件卸载时的资源清理
  useEffect(() => {
    isUnmountedRef.current = false;
    
    return () => {
      isUnmountedRef.current = true;
      
      // 清理所有定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // 取消所有请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // 执行所有清理函数
      cleanupRef.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.debug('Cleanup error:', error)
        }
      });
      cleanupRef.current = [];
    };
  }, []);

  // 计算调试信息
  const debugInfo: ConnectionDebugInfo = {
    enabled,
    currentInterval: state.currentInterval,
    consecutiveFailures: state.consecutiveFailures,
    adaptiveMode: getAdaptiveMode(state.consecutiveFailures),
    lastCheckTime: state.lastCheck ? new Date(state.lastCheck).toLocaleTimeString() : 'Never',
    totalChecks: statsRef.current.totalChecks,
    successRate: statsRef.current.totalChecks > 0 ? 
      (statsRef.current.successfulChecks / statsRef.current.totalChecks * 100) : 0,
  };

  return {
    // 主要状态
    ...state,
    isConnected: state.isOnline && state.isServerHealthy,
    
    // 控制方法
    triggerHealthCheck,
    
    // 调试信息
    debugInfo,
    
    // 统计信息
    stats: {
      totalChecks: statsRef.current.totalChecks,
      successfulChecks: statsRef.current.successfulChecks,
      successRate: debugInfo.successRate,
    }
  };
}