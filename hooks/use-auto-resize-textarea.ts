"use client"

import { useCallback, useRef } from "react"

export function useAutoResizeTextarea(minHeight: number = 40, maxHeight: number = 300) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)}px`
  }, [minHeight, maxHeight])

  return { textareaRef, adjustHeight }
}