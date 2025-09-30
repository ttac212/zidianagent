import { describe, it, expect, beforeEach } from 'vitest'
import { GlobalLifecycle } from '@/lib/lifecycle-manager'

describe('Lifecycle Manager Metrics', () => {
  let lifecycle: GlobalLifecycle

  beforeEach(() => {
    lifecycle = GlobalLifecycle.getInstance()
    lifecycle.cleanup()
    lifecycle.resetMetrics()
  })

  it('应该跟踪创建的清理函数数量', () => {
    lifecycle.register(() => {}, 'test-1')
    lifecycle.register(() => {}, 'test-2')

    const metrics = lifecycle.getMetrics()
    expect(metrics.created).toBe(2)
    expect(metrics.active).toBe(2)
  })

  it('应该跟踪清理的函数数量', () => {
    const unregister1 = lifecycle.register(() => {}, 'test-1')
    const unregister2 = lifecycle.register(() => {}, 'test-2')

    unregister1()

    const metrics = lifecycle.getMetrics()
    expect(metrics.cleaned).toBe(1)
    expect(metrics.active).toBe(1)
  })

  it('应该按类型统计清理函数', () => {
    lifecycle.register(() => {}, 'timer')
    lifecycle.register(() => {}, 'timer')
    lifecycle.register(() => {}, 'listener')

    const metrics = lifecycle.getMetrics()
    expect(metrics.byType.get('timer')).toBe(2)
    expect(metrics.byType.get('listener')).toBe(1)
  })

  it('应该检测潜在的内存泄漏', () => {
    for (let i = 0; i < 15; i++) {
      lifecycle.register(() => {}, 'test')
    }

    const warnings = lifecycle.detectLeaks(10)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('活跃的清理函数过多')
  })

  it('应该检测特定类型的泄漏', () => {
    for (let i = 0; i < 8; i++) {
      lifecycle.register(() => {}, 'timer')
    }

    const warnings = lifecycle.detectLeaks(10)
    expect(warnings.some(w => w.includes('timer'))).toBe(true)
  })

  it('cleanup后活跃计数应该为0', () => {
    lifecycle.register(() => {}, 'test-1')
    lifecycle.register(() => {}, 'test-2')

    lifecycle.cleanup()

    expect(lifecycle.getCleanupCount()).toBe(0)
  })

  it('resetMetrics应该重置计数器', () => {
    lifecycle.register(() => {}, 'test')
    lifecycle.resetMetrics()

    const metrics = lifecycle.getMetrics()
    expect(metrics.created).toBe(0)
    expect(metrics.cleaned).toBe(0)
  })

  it('getMetrics应该返回副本避免修改', () => {
    lifecycle.register(() => {}, 'test')

    const metrics1 = lifecycle.getMetrics()
    const metrics2 = lifecycle.getMetrics()

    expect(metrics1.byType).not.toBe(metrics2.byType)
  })

  it('未注册的unregister不应影响计数', () => {
    const unregister = lifecycle.register(() => {}, 'test')

    unregister()
    unregister()

    const metrics = lifecycle.getMetrics()
    expect(metrics.cleaned).toBe(1)
    expect(metrics.active).toBe(0)
  })

  it('应该正确跟踪混合操作', () => {
    const u1 = lifecycle.register(() => {}, 'timer')
    lifecycle.register(() => {}, 'listener')
    const u3 = lifecycle.register(() => {}, 'timer')

    u1()
    u3()

    const metrics = lifecycle.getMetrics()
    expect(metrics.created).toBe(3)
    expect(metrics.cleaned).toBe(2)
    expect(metrics.active).toBe(1)
  })
})
