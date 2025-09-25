"use client"

import { useCallback, useEffect, useRef } from "react"

export interface UseAutoResizeTextareaOptions {
  minHeight: number
  maxHeight?: number
  value?: string // 新增：监听值变化自动重置
}

export function useAutoResizeTextarea({ minHeight, maxHeight, value }: UseAutoResizeTextareaOptions) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null)

  const adjustHeight = useCallback((reset?: boolean) => {
    const el = textareaRef.current
    if (!el) return

    if (reset) {
      el.style.height = `${minHeight}px`
      el.style.maxHeight = `${maxHeight ?? 300}px`
      // 强制立即重新渲染
      el.offsetHeight
      return
    }

    // 关键修复：强制重新计算，确保收缩时能正确获取scrollHeight
    el.style.height = 'auto'  // 先设为auto让浏览器重新计算
    
    // 强制同步DOM更新
    el.offsetHeight  // 触发重排，确保浏览器立即重新计算高度
    
    const scrollHeight = el.scrollHeight
    const newHeight = Math.max(
      minHeight,
      Math.min(scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
    )
    
    // 设置计算后的高度
    el.style.height = `${newHeight}px`
    el.style.maxHeight = `${maxHeight ?? 300}px`
    
    // 如果内容超出最大高度，确保滚动到底部
    if (scrollHeight > (maxHeight ?? Number.POSITIVE_INFINITY)) {
      // 清除之前的定时器
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
      }
      
      scrollTimerRef.current = setTimeout(() => {
        if (el) {
          el.scrollTop = el.scrollHeight - el.clientHeight
        }
        scrollTimerRef.current = null
      }, 0)
    }
  }, [minHeight, maxHeight])

  // 初始化时设置高度限制
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = `${minHeight}px`
      el.style.maxHeight = `${maxHeight ?? 300}px`
    }
  }, [minHeight, maxHeight])

  // 窗口尺寸变化时重新计算
  useEffect(() => {
    const handler = () => adjustHeight()
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [adjustHeight])

  // 监听value变化，自动调整高度（包括模板注入、快捷按钮等所有外部写入）
  useEffect(() => {
    // 每次value变化都调整高度，空值时传true实现reset
    const adjustHeightForValue = () => {
      adjustHeight(value === '')
    }
    const frameId = requestAnimationFrame(adjustHeightForValue)
    return () => cancelAnimationFrame(frameId)
  }, [value, adjustHeight])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
      }
    }
  }, [])

  return { textareaRef, adjustHeight }
}

