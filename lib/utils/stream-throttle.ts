/**
 * 流式更新节流工具 - 使用requestIdleCallback优化UI性能
 *
 * 原理：
 * - 在浏览器空闲时批量应用累积的更新
 * - 保留完整内容字符串，只节流UI更新频率
 * - 确保最后一次更新一定会执行（flush机制）
 *
 * 兼容性：
 * - 优先使用requestIdleCallback（Chrome/Edge支持）
 * - Safari fallback到setTimeout
 */

type ThrottledCallback = (fullContent: string) => void

interface ThrottleOptions {
  /** 最大等待时间（ms），超过此时间强制执行，默认16ms（约60fps） */
  maxWait?: number
}

/**
 * 创建流式更新节流器
 *
 * @example
 * const throttledUpdate = createStreamThrottle((content) => {
 *   updateUI(content)
 * })
 *
 * // 在SSE流中使用
 * onChunk((delta, fullContent) => {
 *   throttledUpdate(fullContent)
 * })
 *
 * // 流结束时确保最后的更新
 * onDone(() => {
 *   throttledUpdate.flush()
 * })
 */
export function createStreamThrottle(
  callback: ThrottledCallback,
  options: ThrottleOptions = {}
): ThrottledCallback & { flush: () => void } {
  const { maxWait = 16 } = options

  let pendingContent: string | null = null
  let scheduledId: number | null = null
  let lastExecuteTime = 0

  // 检测requestIdleCallback支持
  const hasRequestIdleCallback = typeof requestIdleCallback !== 'undefined'

  const executeUpdate = () => {
    if (pendingContent !== null) {
      const content = pendingContent
      pendingContent = null
      scheduledId = null
      lastExecuteTime = Date.now()
      callback(content)
    }
  }

  const scheduleUpdate = () => {
    if (scheduledId !== null) return

    if (hasRequestIdleCallback) {
      scheduledId = requestIdleCallback(executeUpdate, { timeout: maxWait }) as unknown as number
    } else {
      scheduledId = setTimeout(executeUpdate, maxWait) as unknown as number
    }
  }

  const throttledFn = (fullContent: string) => {
    pendingContent = fullContent

    // 如果距离上次执行超过maxWait，立即执行
    const now = Date.now()
    if (now - lastExecuteTime >= maxWait) {
      if (scheduledId !== null) {
        if (hasRequestIdleCallback) {
          cancelIdleCallback(scheduledId)
        } else {
          clearTimeout(scheduledId)
        }
        scheduledId = null
      }
      executeUpdate()
    } else {
      scheduleUpdate()
    }
  }

  // Flush方法：确保最后的内容一定会执行
  throttledFn.flush = () => {
    if (scheduledId !== null) {
      if (hasRequestIdleCallback) {
        cancelIdleCallback(scheduledId)
      } else {
        clearTimeout(scheduledId)
      }
      scheduledId = null
    }
    executeUpdate()
  }

  return throttledFn
}

/**
 * 批量节流 - 用于同时节流多个字段的更新
 *
 * @example
 * const throttled = createBatchStreamThrottle((updates) => {
 *   updateMessage({
 *     content: updates.content,
 *     analysis: updates.analysis
 *   })
 * })
 *
 * onTranscript((delta, full) => {
 *   throttled.update('content', full)
 * })
 *
 * onAnalysis((delta, full) => {
 *   throttled.update('analysis', full)
 * })
 *
 * onDone(() => {
 *   throttled.flush()
 * })
 */
export function createBatchStreamThrottle<K extends string>(
  callback: (updates: Record<K, string>) => void,
  options: ThrottleOptions = {}
): {
  update: (key: K, value: string) => void
  flush: () => void
} {
  const { maxWait = 16 } = options

  const pendingUpdates: Partial<Record<K, string>> = {}
  let scheduledId: number | null = null
  let lastExecuteTime = 0

  const hasRequestIdleCallback = typeof requestIdleCallback !== 'undefined'

  const executeUpdate = () => {
    if (Object.keys(pendingUpdates).length > 0) {
      const updates = { ...pendingUpdates } as Record<K, string>
      Object.keys(pendingUpdates).forEach(key => delete pendingUpdates[key as K])
      scheduledId = null
      lastExecuteTime = Date.now()
      callback(updates)
    }
  }

  const scheduleUpdate = () => {
    if (scheduledId !== null) return

    if (hasRequestIdleCallback) {
      scheduledId = requestIdleCallback(executeUpdate, { timeout: maxWait }) as unknown as number
    } else {
      scheduledId = setTimeout(executeUpdate, maxWait) as unknown as number
    }
  }

  return {
    update(key: K, value: string) {
      pendingUpdates[key] = value

      const now = Date.now()
      if (now - lastExecuteTime >= maxWait) {
        if (scheduledId !== null) {
          if (hasRequestIdleCallback) {
            cancelIdleCallback(scheduledId)
          } else {
            clearTimeout(scheduledId)
          }
          scheduledId = null
        }
        executeUpdate()
      } else {
        scheduleUpdate()
      }
    },

    flush() {
      if (scheduledId !== null) {
        if (hasRequestIdleCallback) {
          cancelIdleCallback(scheduledId)
        } else {
          clearTimeout(scheduledId)
        }
        scheduledId = null
      }
      executeUpdate()
    }
  }
}
