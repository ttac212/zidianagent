import { describe, it, expect, vi, beforeAll } from 'vitest'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { parse } from 'dotenv'
import { NextRequest } from 'next/server'
import { parseDouyinUserShare } from '@/lib/douyin/share-link'

const envPath = resolve(process.cwd(), '.env.local')
const envData = parse(readFileSync(envPath))
for (const [key, value] of Object.entries(envData)) {
  if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
    process.env[key] = value
  }
}

// 使用兼容当前运行环境的数据库路径
process.env.DATABASE_URL = 'file:./prisma/dev.db'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: {
      id: 'manual-admin',
      role: 'ADMIN',
    },
  }),
}))

describe('管理员身份调用 /api/tikhub/sync', () => {
  let secUid: string

  beforeAll(async () => {
    const shareInfo = await parseDouyinUserShare('https://v.douyin.com/EdKxAitZ5hI/')
    const resolved = shareInfo.secUserId ?? shareInfo.userId
    if (!resolved) {
      throw new Error('未能从分享链接解析出 sec_uid')
    }
    secUid = resolved
  }, 60_000)

  it('成功触发同步并返回结果', async () => {
    if (!process.env.TIKHUB_API_KEY) {
      throw new Error('缺少 TIKHUB_API_KEY 环境变量')
    }

    const body = {
      sec_uid: secUid,
      maxVideos: 20,
      businessType: 'B2C' as const,
    }

    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const request = new NextRequest('http://localhost/api/tikhub/sync', {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    })

    const { POST } = await import('@/app/api/tikhub/sync/route')
    const { TIKHUB_CONFIG } = await import('@/lib/tikhub')
    const response = await POST(request)
    const data = await response.json()

    process.env.NODE_ENV = previousNodeEnv

    console.log(
      JSON.stringify(
        {
          status: response.status,
          response: data,
          tikHubBaseURL: TIKHUB_CONFIG.baseURL,
        },
        null,
        2
      )
    )

    expect(response.status).toBe(200)
    expect(data?.data?.merchantId).toBeTruthy()
  }, 60_000)
})
