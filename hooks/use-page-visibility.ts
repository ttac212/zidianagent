/**
 * 页面可见性管理Hook
 * 处理页面在后台时的状态管理和恢复逻辑
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface PageVisibilityOptions {
  /** 页面重新可见时的恢复延迟（毫秒） */
  recoveryDelay?: number
  /** 页面隐藏超过此时间后触发长时间离开回调（毫秒） */
  longAbsenceThreshold?: number
  /** 是否在页面重新可见时自动触发数据刷新 */
  autoRefreshOnVisible?: boolean
  /** 页面隐藏时是否暂停定时器 */
  pauseTimersWhenHidden?: boolean
  /** 是否开启调试模式 */
  debug?: boolean
}

export interface PageVisibilityState {
  /** 当前页面是否可见 */
  isVisible: boolean
  /** 页面是否曾经隐藏过 */
  wasHidden: boolean
  /** 上次变为可见的时间戳 */
  lastVisibleTime: number
  /** 上次隐藏的时间戳 */
  lastHiddenTime: number
  /** 当前隐藏持续时间（毫秒） */
  hiddenDuration: number
  /** 是否为长时间离开 */
  isLongAbsence: boolean
}

const DEFAULT_OPTIONS: Required<PageVisibilityOptions> = {
  recoveryDelay: 500,
  longAbsenceThreshold: 5 * 60 * 1000, // 5分钟
  autoRefreshOnVisible: true,
  pauseTimersWhenHidden: true,
  debug: false
}

/**
 * 页面可见性管理Hook
 */
export function usePageVisibility(
  options: PageVisibilityOptions = {},
  onVisibilityChange?: (state: PageVisibilityState) => void
) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const [visibilityState, setVisibilityState] = useState<PageVisibilityState>({
    isVisible: typeof document !== 'undefined' ? !document.hidden : true,
    wasHidden: false,
    lastVisibleTime: Date.now(),
    lastHiddenTime: 0,
    hiddenDuration: 0,
    isLongAbsence: false
  })

  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hiddenStartTimeRef = useRef<number>(0)

  /**
   * 处理页面可见性变化
   */
  const handleVisibilityChange = useCallback(() => {
    const isVisible = !document.hidden
    const now = Date.now()

    setVisibilityState(prev => {
      let hiddenDuration = 0
      let isLongAbsence = false

      if (isVisible) {
        // 页面变为可见
        if (hiddenStartTimeRef.current > 0) {
          hiddenDuration = now - hiddenStartTimeRef.current
          isLongAbsence = hiddenDuration > opts.longAbsenceThreshold
        }
        hiddenStartTimeRef.current = 0

        // 可选：记录页面重新可见的调试信息
        if (opts.debug) {
          // 调试信息已禁用 - 可通过日志系统替代
          // console.log(`页面重新可见，隐藏时长: ${(hiddenDuration / 1000).toFixed(1)}秒`, {
          //   hiddenDuration,
          //   isLongAbsence
          // })
        }
      } else {
        // 页面变为隐藏
        hiddenStartTimeRef.current = now
      }

      const newState: PageVisibilityState = {
        isVisible,
        wasHidden: prev.wasHidden || !isVisible,
        lastVisibleTime: isVisible ? now : prev.lastVisibleTime,
        lastHiddenTime: !isVisible ? now : prev.lastHiddenTime,
        hiddenDuration,
        isLongAbsence
      }

      // 触发回调（延迟执行以避免状态更新冲突）
      if (onVisibilityChange) {
        if (isVisible && opts.recoveryDelay > 0) {
          recoveryTimeoutRef.current = setTimeout(() => {
            onVisibilityChange(newState)
          }, opts.recoveryDelay)
        } else {
          setTimeout(() => onVisibilityChange(newState), 0)
        }
      }

      return newState
    })
  }, [opts.longAbsenceThreshold, opts.recoveryDelay, onVisibilityChange])

  /**
   * 手动刷新页面状态（用于重新获取数据等）
   */
  const refreshPageState = useCallback(() => {
    if (onVisibilityChange && visibilityState.isVisible) {
      onVisibilityChange(visibilityState)
    }
  }, [onVisibilityChange, visibilityState])

  /**
   * 重置可见性状态
   */
  const resetVisibilityState = useCallback(() => {
    const now = Date.now()
    setVisibilityState({
      isVisible: typeof document !== 'undefined' ? !document.hidden : true,
      wasHidden: false,
      lastVisibleTime: now,
      lastHiddenTime: 0,
      hiddenDuration: 0,
      isLongAbsence: false
    })
    hiddenStartTimeRef.current = 0
  }, [])

  // 监听页面可见性变化
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current)
      }
    }
  }, [handleVisibilityChange])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current)
      }
    }
  }, [])

  return {
    ...visibilityState,
    refreshPageState,
    resetVisibilityState
  }
}

/**
 * 页面可见性感知的数据获取Hook
 * 自动在页面重新可见时刷新数据
 */
export function useVisibilityAwareData<T>(
  fetcher: () => Promise<T>,
  options: PageVisibilityOptions & {
    /** 是否在组件挂载时立即获取数据 */
    fetchOnMount?: boolean
    /** 长时间离开后是否强制刷新 */
    forceRefreshOnLongAbsence?: boolean
  } = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const fetchData = useCallback(async (force = false) => {
    if (loading && !force) return

    setLoading(true)
    setError(null)

    try {
      const result = await fetcherRef.current()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('获取数据失败'))
    } finally {
      setLoading(false)
    }
  }, [loading])

  const handleVisibilityChange = useCallback((state: PageVisibilityState) => {
    if (state.isVisible) {
      const shouldRefresh = 
        options.autoRefreshOnVisible !== false &&
        (state.wasHidden && (!options.forceRefreshOnLongAbsence || state.isLongAbsence))

      if (shouldRefresh) {
        fetchData(true)
      }
    }
  }, [fetchData, options.autoRefreshOnVisible, options.forceRefreshOnLongAbsence])

  const visibility = usePageVisibility(options, handleVisibilityChange)

  // 组件挂载时获取数据
  useEffect(() => {
    if (options.fetchOnMount !== false) {
      fetchData()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    error,
    fetchData,
    ...visibility
  }
}

/**
 * 页面可见性感知的定时器Hook
 * 页面隐藏时可选择性暂停定时器
 */
export function useVisibilityAwareInterval(
  callback: () => void,
  delay: number | null,
  options: { pauseWhenHidden?: boolean } = {}
) {
  const { pauseWhenHidden = true } = options
  const callbackRef = useRef(callback)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  callbackRef.current = callback

  const { isVisible } = usePageVisibility()

  useEffect(() => {
    if (delay === null) return

    const tick = () => callbackRef.current()

    const shouldRun = !pauseWhenHidden || isVisible

    if (shouldRun) {
      intervalRef.current = setInterval(tick, delay)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [delay, isVisible, pauseWhenHidden])

  // 手动触发回调
  const trigger = useCallback(() => {
    callbackRef.current()
  }, [])

  return { trigger, isVisible }
}