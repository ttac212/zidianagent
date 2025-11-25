/**
 * 清除 Upstash Redis 中的限流数据
 * 用于解除 429 错误
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// 加载 .env.local
config({ path: resolve(process.cwd(), '.env.local') })

async function clearRateLimits() {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!baseUrl || !token) {
    console.error('❌ 缺少 UPSTASH_REDIS_REST_URL 或 UPSTASH_REDIS_REST_TOKEN 环境变量')
    process.exit(1)
  }

  console.log('🔍 正在查找限流相关的 keys...')

  try {
    // 获取所有 ratelimit 开头的 keys
    const scanResponse = await fetch(`${baseUrl}/keys/ratelimit:*`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    })

    if (!scanResponse.ok) {
      throw new Error(`获取 keys 失败: ${scanResponse.status}`)
    }

    const scanResult = await scanResponse.json()
    const keys = scanResult.result || []

    if (keys.length === 0) {
      console.log('✅ 没有找到限流 keys，无需清除')
      return
    }

    console.log(`📋 找到 ${keys.length} 个限流 keys:`)
    keys.forEach((key: string) => console.log(`   - ${key}`))

    // 批量删除
    console.log('\n🗑️ 正在删除...')

    const deleteCommands = keys.map((key: string) => ['DEL', key])

    const deleteResponse = await fetch(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deleteCommands)
    })

    if (!deleteResponse.ok) {
      throw new Error(`删除 keys 失败: ${deleteResponse.status}`)
    }

    const deleteResult = await deleteResponse.json()
    console.log('✅ 删除结果:', deleteResult)

    console.log('\n🎉 限流数据已清除！用户现在可以正常访问了。')

  } catch (error) {
    console.error('❌ 清除失败:', error)
    process.exit(1)
  }
}

clearRateLimits()
