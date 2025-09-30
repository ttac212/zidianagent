import { FullConfig } from '@playwright/test'
import * as dt from '@/lib/utils/date-toolkit'

/**
 * 全局设置，在所有测试运行前执行
 * 专注于性能和并发测试的环境准备
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 开始全局设置...')
  
  // 设置并发测试环境变量
  process.env.CONCURRENT_TEST_MODE = 'true'
  process.env.TEST_EMAIL = 'hi@2308.com'
  
  // 记录测试开始时间用于性能分析
  process.env.TEST_START_TIME = dt.timestamp().toString()
  
  console.log('⚡ 并发测试环境已配置')
  console.log('📊 性能监控已启动')
  console.log('✅ 全局设置完成')
}

export default globalSetup