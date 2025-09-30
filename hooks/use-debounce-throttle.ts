/**
 * 防抖和节流工具 Hooks
 * 提供通用的性能优化工具
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import * as dt from '@/lib/utils/date-toolkit'

/**
 * 防抖 Hook
 * 延迟执行，多次调用只执行最后一次
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

/**
 * 节流 Hook
 * 限制执行频率，固定时间间隔内只执行一次
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(0) // 初始值为0，确保第一次可以执行
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  return useCallback((...args: Parameters<T>) => {
    const now = dt.timestamp()
    const timeSinceLastRun = now - lastRun.current

    if (timeSinceLastRun >= delay) {
      // 距离上次执行已超过延迟，立即执行
      callback(...args)
      lastRun.current = now
    } else {
      // 还在延迟期内，设置定时器在延迟结束后执行
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        callback(...args)
        lastRun.current = dt.timestamp()
      }, delay - timeSinceLastRun)
    }
  }, [callback, delay]) as T
}

/**
 * 防抖回调 Hook
 * 返回一个防抖版本的函数
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): [T, () => void] {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay]) as T

  const cancel = useCallback(() => {
    clearTimeout(timeoutRef.current)
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => clearTimeout(timeoutRef.current)
  }, [])

  return [debouncedCallback, cancel]
}

/**
 * 延迟值 Hook
 * 值在稳定一段时间后才更新
 */
export function useDelayedValue<T>(value: T, delay: number = 500): T {
  const [delayedValue, setDelayedValue] = useState<T>(value)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    // 立即更新为undefined或null
    if (value === undefined || value === null) {
      setDelayedValue(value)
      return
    }

    // 其他值延迟更新
    timeoutRef.current = setTimeout(() => {
      setDelayedValue(value)
    }, delay)

    return () => clearTimeout(timeoutRef.current)
  }, [value, delay])

  return delayedValue
}