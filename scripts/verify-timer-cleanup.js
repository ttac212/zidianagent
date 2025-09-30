#!/usr/bin/env node

/**
 * 定时器内存泄漏验证脚本
 * 验证生命周期管理器是否正确清理所有定时器
 */

const { getRateLimiter } = require('./lib/security/distributed-rate-limiter')
const { ModelConsistencyChecker } = require('./lib/model-validator')
const { lifecycle } = require('./lib/lifecycle-manager')

console.log('🔍 开始定时器清理验证...\n')

// 1. 创建组件并启动定时器
console.log('1️⃣ 创建组件并启动定时器...')
const rateLimiter = getRateLimiter()
const checker = new ModelConsistencyChecker(1000)
checker.start(() => ({ ui: 'test', state: 'test', storage: 'test' }))

// 2. 验证定时器已创建
console.log('2️⃣ 验证定时器状态...')
const cleanupCount = lifecycle.getCleanupCount()
console.log(`   - 已注册的清理函数数量: ${cleanupCount}`)

// 3. 检查内存使用（基准）
const memBefore = process.memoryUsage()
console.log(`   - 内存使用: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`)

// 4. 执行生命周期清理
console.log('\n3️⃣ 执行生命周期清理...')
lifecycle.cleanup()

// 5. 验证清理结果
console.log('4️⃣ 验证清理结果...')
const cleanupCountAfter = lifecycle.getCleanupCount()
console.log(`   - 清理后的函数数量: ${cleanupCountAfter}`)

// 6. 验证定时器已清除
let success = true
try {
  // 检查 rateLimiter 的定时器
  if (rateLimiter.cleanupTimer !== undefined) {
    console.log('   ❌ DistributedRateLimiter 定时器未清理')
    success = false
  } else {
    console.log('   ✅ DistributedRateLimiter 定时器已清理')
  }

  // 检查 checker 的定时器
  if (checker.checkInterval !== null) {
    console.log('   ❌ ModelConsistencyChecker 定时器未清理')
    success = false
  } else {
    console.log('   ✅ ModelConsistencyChecker 定时器已清理')
  }
} catch (err) {
  console.error('   ❌ 验证过程出错:', err.message)
  success = false
}

// 7. 最终结果
console.log('\n📊 验证结果:')
if (success && cleanupCountAfter === 0) {
  console.log('✅ 所有定时器已正确清理，无内存泄漏风险')
  process.exit(0)
} else {
  console.log('❌ 检测到潜在的定时器泄漏问题')
  process.exit(1)
}