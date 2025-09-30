/**
 * 开发期 UI 行为探测 Hook
 * 目前占位实现，避免构建阶段出现类型问题
 */

import { useEffect } from 'react'

export const useUIBehaviorDetector = (
  enabled: boolean = process.env.NODE_ENV === 'development'
) => {
  useEffect(() => {
    if (!enabled) return
    // TODO: 实现 UI 行为检测逻辑
    return undefined
  }, [enabled])
}
