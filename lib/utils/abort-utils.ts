export class AbortError extends Error {
  constructor(message = '操作已取消', public readonly reason?: unknown) {
    super(message)
    this.name = 'AbortError'
  }
}

export class TimeoutError extends Error {
  constructor(message = '操作超时', public readonly timeoutMs?: number) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export function ensureNotAborted(signal?: AbortSignal, message = '操作已取消'): void {
  if (!signal?.aborted) return
  const reason = (signal as any).reason
  if (reason instanceof Error) {
    throw reason
  }
  throw new AbortError(message, reason)
}

export function createLinkedController(
  signals: AbortSignal[] = [],
  timeoutMs?: number,
  timeoutMessage?: string
): { controller: AbortController; signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController()
  const abort = (reason?: any) => {
    if (!controller.signal.aborted) {
      controller.abort(reason)
    }
  }

  const listeners = signals.map((source) => {
    const handler = () => abort((source as any).reason || new AbortError('操作已取消'))
    source.addEventListener('abort', handler, { once: true })
    return { source, handler }
  })

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      abort(new TimeoutError(timeoutMessage || '操作超时', timeoutMs))
    }, timeoutMs)
  }

  const cleanup = () => {
    listeners.forEach(({ source, handler }) => source.removeEventListener('abort', handler))
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }

  return { controller, signal: controller.signal, cleanup }
}

export async function withAbortableTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: {
    timeoutMs: number
    timeoutMessage?: string
    signal?: AbortSignal
  }
): Promise<T> {
  const { timeoutMs, timeoutMessage, signal } = options
  const { controller, signal: linkedSignal, cleanup } = createLinkedController(
    signal ? [signal] : [],
    timeoutMs,
    timeoutMessage
  )

  try {
    const result = await fn(linkedSignal)
    ensureNotAborted(linkedSignal)
    return result
  } catch (error) {
    if (linkedSignal.aborted) {
      const reason = (linkedSignal as any).reason
      if (reason instanceof TimeoutError) {
        throw reason
      }
      if (reason instanceof AbortError) {
        throw reason
      }
      if (reason instanceof Error) {
        throw reason
      }
      throw new AbortError('操作已取消', reason)
    }
    throw error
  } finally {
    cleanup()
  }
}
