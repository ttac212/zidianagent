import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GlobalLifecycle, lifecycle } from '@/lib/lifecycle-manager'
import { DistributedRateLimiter, MemoryRateLimitStore } from '@/lib/security/distributed-rate-limiter'
import { ModelConsistencyChecker } from '@/lib/model-validator'

describe('Lifecycle Manager - 定时器回收测试', () => {
  let originalEnv: any

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env }
    // 确保测试环境不是 Vercel
    delete process.env.VERCEL
    vi.useFakeTimers()
  })

  afterEach(() => {
    // 清理并重置
    lifecycle.cleanup()
    vi.clearAllTimers()
    vi.restoreAllMocks()
    // 恢复环境变量
    process.env = originalEnv
  })

  describe('DistributedRateLimiter 定时器清理', () => {
    it('应该在创建时设置定时器并能够清理', () => {
      // 创建内存存储和限速器
      const store = new MemoryRateLimitStore()
      const limiter = new DistributedRateLimiter(store)

      // 验证定时器已创建（在非 Vercel 环境）
      if (typeof window === 'undefined' && !process.env.VERCEL) {
        expect(limiter['cleanupTimer']).toBeDefined()
      }

      // 调用 destroy
      limiter.destroy()

      // 验证定时器已清除
      expect(limiter['cleanupTimer']).toBeUndefined()
    })

    it('destroy 方法应该是幂等的', () => {
      const store = new MemoryRateLimitStore()
      const limiter = new DistributedRateLimiter(store)

      // 多次调用 destroy 应该是安全的
      limiter.destroy()
      limiter.destroy()
      limiter.destroy()

      expect(limiter['cleanupTimer']).toBeUndefined()
    })
  })

  describe('ModelConsistencyChecker 定时器清理', () => {
    it('应该在启动时创建定时器', () => {
      const checker = new ModelConsistencyChecker(1000)
      const getStates = () => ({ ui: 'model1', state: 'model1', storage: 'model1' })

      // 启动检查器
      checker.start(getStates)

      // 验证定时器已创建
      expect(checker['checkInterval']).toBeDefined()
      expect(checker['isRunning']).toBe(true)

      // 停止检查器
      checker.stop()
    })

    it('stop 方法应该清除定时器', () => {
      const checker = new ModelConsistencyChecker(1000)
      const getStates = () => ({ ui: 'model1', state: 'model1', storage: 'model1' })

      // 启动检查器
      checker.start(getStates)
      expect(checker['checkInterval']).toBeDefined()
      expect(checker['isRunning']).toBe(true)

      // 停止检查器
      checker.stop()

      // 验证定时器已清除
      expect(checker['checkInterval']).toBeNull()
      expect(checker['isRunning']).toBe(false)

      // 多次调用 stop 应该是安全的
      expect(() => checker.stop()).not.toThrow()
    })

    it('多次调用 start 应该保持幂等', () => {
      const checker = new ModelConsistencyChecker(1000)
      const getStates = () => ({ ui: 'model1', state: 'model1', storage: 'model1' })

      // 第一次启动
      checker.start(getStates)
      const firstInterval = checker['checkInterval']
      expect(checker['isRunning']).toBe(true)

      // 第二次启动应该不创建新的定时器
      checker.start(getStates)
      expect(checker['checkInterval']).toBe(firstInterval)
      expect(checker['isRunning']).toBe(true)

      // 停止检查器
      checker.stop()
    })

    it('生命周期注册应该只执行一次', () => {
      const checker = new ModelConsistencyChecker(1000)
      const getStates = () => ({ ui: 'model1', state: 'model1', storage: 'model1' })

      // 在服务器环境中应该注册生命周期
      if (typeof window === 'undefined') {
        checker.start(getStates)
        expect(checker['lifecycleRegistered']).toBe(true)

        // 再次启动不应该重复注册
        checker.stop()
        checker.start(getStates)
        expect(checker['lifecycleRegistered']).toBe(true)
      }

      checker.stop()
    })
  })

  describe('生命周期管理器核心功能', () => {
    it('应该注册和执行清理函数', () => {
      const cleanup1 = vi.fn()
      const cleanup2 = vi.fn()

      // 注册清理函数
      lifecycle.register(cleanup1, 'test-cleanup-1')
      lifecycle.register(cleanup2, 'test-cleanup-2')

      // 验证注册成功
      expect(lifecycle.getCleanupCount()).toBeGreaterThanOrEqual(2)

      // 执行清理
      lifecycle.cleanup()

      // 验证所有清理函数都被调用
      expect(cleanup1).toHaveBeenCalledTimes(1)
      expect(cleanup2).toHaveBeenCalledTimes(1)
    })

    it('应该返回取消注册函数', () => {
      const cleanup = vi.fn()

      // 记录初始数量
      const initialCount = lifecycle.getCleanupCount()

      // 注册并获取取消函数
      const unregister = lifecycle.register(cleanup, 'test-cleanup')
      expect(lifecycle.getCleanupCount()).toBe(initialCount + 1)

      // 取消注册
      unregister()
      expect(lifecycle.getCleanupCount()).toBe(initialCount)
    })

    it('清理函数抛出错误时应该继续执行其他清理', () => {
      const cleanup1 = vi.fn(() => { throw new Error('Test error') })
      const cleanup2 = vi.fn()

      lifecycle.register(cleanup1, 'failing-cleanup')
      lifecycle.register(cleanup2, 'normal-cleanup')

      // 执行清理不应该抛出错误
      expect(() => lifecycle.cleanup()).not.toThrow()

      // 两个清理函数都应该被调用
      expect(cleanup1).toHaveBeenCalledTimes(1)
      expect(cleanup2).toHaveBeenCalledTimes(1)
    })
  })

  describe('集成测试', () => {
    it('DistributedRateLimiter 和 ModelConsistencyChecker 都应该通过生命周期清理', () => {
      // 创建两个组件
      const limiter = new DistributedRateLimiter(new MemoryRateLimitStore())
      const checker = new ModelConsistencyChecker(1000)

      // 启动 ModelConsistencyChecker
      checker.start(() => ({ ui: 'model1', state: 'model1', storage: 'model1' }))

      // 验证都有定时器（在合适的环境中）
      if (typeof window === 'undefined' && !process.env.VERCEL) {
        expect(limiter['cleanupTimer']).toBeDefined()
      }
      expect(checker['checkInterval']).toBeDefined()

      // 手动清理
      limiter.destroy()
      checker.stop()

      // 验证清理成功
      expect(limiter['cleanupTimer']).toBeUndefined()
      expect(checker['checkInterval']).toBeNull()
    })
  })
})