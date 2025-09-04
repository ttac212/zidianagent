/**
 * API稳定性测试脚本
 * 测试重试机制、超时控制和错误处理
 */

import { fetchWithRetry, fetchWithTimeout } from '../lib/utils/retry'

async function testTimeout() {
  try {
    // 模拟超时请求（使用一个延迟很长的端点）
    const response = await fetchWithTimeout(
      'https://httpbin.org/delay/10',
      {},
      3000 // 3秒超时
    )
    } catch (error: any) {
    if (error.message.includes('超时')) {
      } else {
      }
  }
}

async function testRetry() {
  let attemptCount = 0
  
  try {
    await fetchWithRetry(
      'https://httpbin.org/status/500', // 始终返回500错误
      {},
      {
        maxRetries: 3,
        initialDelay: 100,
        onRetry: (error, attempt) => {
          attemptCount = attempt
          }
      }
    )
    } catch (error) {
    if (attemptCount === 3) {
      } else {
      }
  }
}

async function testNoRetryOn401() {
  let attemptCount = 0
  
  try {
    await fetchWithRetry(
      'https://httpbin.org/status/401', // 返回401未授权
      {},
      {
        maxRetries: 3,
        initialDelay: 100,
        onRetry: (error, attempt) => {
          attemptCount = attempt
          }
      }
    )
    } catch (error) {
    if (attemptCount === 0) {
      } else {
      }
  }
}

async function testSuccessfulRequest() {
  try {
    const response = await fetchWithRetry(
      'https://httpbin.org/status/200',
      {},
      {
        maxRetries: 3,
        initialDelay: 100
      }
    )
    
    if (response.ok) {
      } else {
      }
  } catch (error: any) {
    }
}

async function testExponentialBackoff() {
  const delays: number[] = []
  let lastTime = Date.now()
  
  try {
    await fetchWithRetry(
      'https://httpbin.org/status/503',
      {},
      {
        maxRetries: 4,
        initialDelay: 100,
        factor: 2,
        onRetry: (error, attempt) => {
          const now = Date.now()
          const delay = now - lastTime
          delays.push(delay)
          lastTime = now
          }
      }
    )
  } catch (error) {
    // 预期失败
  }
  
  // 验证延迟是否呈指数增长（允许一定误差）
  const expectedDelays = [100, 200, 400, 800]
  let isExponential = true
  
  for (let i = 0; i < delays.length; i++) {
    const actual = delays[i]
    const expected = expectedDelays[i]
    const tolerance = expected * 0.3 // 30%误差范围
    
    if (Math.abs(actual - expected) > tolerance) {
      isExponential = false
      break
    }
  }
  
  if (isExponential) {
    } else {
    }
}

async function runAllTests() {
  await testTimeout()
  await testRetry()
  await testNoRetryOn401()
  await testSuccessfulRequest()
  await testExponentialBackoff()
  
  }

// 如果直接运行此脚本
if (require.main === module) {
  runAllTests().catch(console.error)
}

export { runAllTests }