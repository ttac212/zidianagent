/**
 * 全局生命周期管理器
 * 用于管理定时器、事件监听器等需要清理的资源
 * 解决内存泄漏问题
 */

interface TimerMetrics {
  created: number
  cleaned: number
  active: number
  leaked: number
  byType: Map<string, number>
}

export class GlobalLifecycle {
  private static instance: GlobalLifecycle
  private cleanups = new Set<() => void>()
  private isCleaningUp = false
  private metrics: TimerMetrics = {
    created: 0,
    cleaned: 0,
    active: 0,
    leaked: 0,
    byType: new Map()
  }

  /**
   * 获取单例实例
   */
  static getInstance() {
    if (!this.instance) {
      this.instance = new GlobalLifecycle()

      // 在 Node.js 环境中注册进程退出处理
      if (typeof process !== 'undefined') {
        // 优雅关闭
        const cleanup = () => {
          if (!this.instance.isCleaningUp) {
            console.info('[Lifecycle] Cleaning up resources...')
            this.instance.cleanup()
            console.info('[Lifecycle] Cleanup complete')
          }
        }

        process.once('exit', cleanup)
        process.once('SIGINT', cleanup)
        process.once('SIGTERM', cleanup)
        process.once('uncaughtException', (error) => {
          // 区分正常的连接断开和真正的异常
          const errorCode = (error as any)?.code
          const errorMessage = error?.message || ''

          const isConnectionError =
            errorCode === 'ECONNRESET' ||
            errorCode === 'EPIPE' ||
            errorCode === 'ABORT_ERR' ||
            errorMessage.includes('aborted') ||
            errorMessage.includes('connection')

          if (isConnectionError) {
            // 客户端断开连接，静默清理
            console.info('[Lifecycle] Client disconnected, cleaning up resources...')
          } else {
            // 真正的异常
            console.error('[Lifecycle] Uncaught exception:', error)
          }

          cleanup()

          // 只在真正的异常时退出
          if (!isConnectionError) {
            process.exit(1)
          }
        })
      }
    }
    return this.instance
  }

  /**
   * 注册清理函数
   * @returns 取消注册函数
   */
  register(cleanup: () => void, name?: string): () => void {
    this.cleanups.add(cleanup)
    this.metrics.created++
    this.metrics.active++

    if (name) {
      const count = this.metrics.byType.get(name) || 0
      this.metrics.byType.set(name, count + 1)
    }

    if (process.env.NODE_ENV === 'development' && name) {
      console.info(`[Lifecycle] Registered cleanup: ${name}`)
    }

    // 返回取消注册函数
    return () => {
      const deleted = this.cleanups.delete(cleanup)
      if (deleted) {
        this.metrics.cleaned++
        this.metrics.active--
      }
      if (process.env.NODE_ENV === 'development' && name) {
        console.info(`[Lifecycle] Unregistered cleanup: ${name}`)
      }
    }
  }

  /**
   * 执行所有清理函数
   */
  cleanup() {
    if (this.isCleaningUp) return

    this.isCleaningUp = true
    const count = this.cleanups.size

    this.cleanups.forEach(fn => {
      try {
        fn()
      } catch (error) {
        console.error('[Lifecycle] Cleanup error:', error)
      }
    })

    this.cleanups.clear()
    this.isCleaningUp = false

    if (process.env.NODE_ENV === 'development') {
      console.info(`[Lifecycle] Cleaned up ${count} resources`)
    }
  }

  /**
   * 获取当前注册的清理函数数量
   */
  getCleanupCount(): number {
    return this.cleanups.size
  }

  /**
   * 获取定时器监控指标
   */
  getMetrics(): TimerMetrics {
    return {
      ...this.metrics,
      byType: new Map(this.metrics.byType)
    }
  }

  /**
   * 检测潜在的内存泄漏
   */
  detectLeaks(threshold = 10): string[] {
    const warnings: string[] = []

    if (this.metrics.active > threshold) {
      warnings.push(
        `警告：活跃的清理函数过多 (${this.metrics.active})，可能存在内存泄漏`
      )
    }

    this.metrics.byType.forEach((count, name) => {
      if (count > threshold / 2) {
        warnings.push(`警告：'${name}' 类型的清理函数过多 (${count})`)
      }
    })

    return warnings
  }

  /**
   * 重置监控指标
   */
  resetMetrics() {
    this.metrics = {
      created: 0,
      cleaned: 0,
      active: this.cleanups.size,
      leaked: 0,
      byType: new Map()
    }
  }
}

// 导出便捷函数
export const lifecycle = GlobalLifecycle.getInstance()