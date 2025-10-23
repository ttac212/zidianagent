import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

import { NextRequest } from 'next/server'
import { parseDouyinUserShare } from '@/lib/douyin/share-link'
import { TIKHUB_CONFIG } from '@/lib/tikhub'

const SHARE_LINK = 'https://v.douyin.com/EdKxAitZ5hI/'

async function ensureAdminSessionMock() {
  const nextAuth = await import('next-auth')
  Object.defineProperty(nextAuth, 'getServerSession', {
    value: async () =>
      ({
        user: {
          id: 'admin-script-user',
          role: 'ADMIN',
        },
      } as any),
    configurable: true,
    writable: true,
  })
}

async function main() {
  if (!process.env.TIKHUB_API_KEY) {
    throw new Error('缺少 TIKHUB_API_KEY 环境变量，无法调用 TikHub API。')
  }

  await ensureAdminSessionMock()

  const shareInfo = await parseDouyinUserShare(SHARE_LINK)
  const secUid = shareInfo.secUserId ?? shareInfo.userId
  if (!secUid) {
    throw new Error('未能从分享链接解析出 sec_uid。')
  }

  const body = {
    sec_uid: secUid,
    maxVideos: 20,
    businessType: 'B2C',
  }

  const request = new NextRequest('http://localhost/api/tikhub/sync', {
    method: 'POST',
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(body),
  })

  const { POST } = await import('@/app/api/tikhub/sync/route')
  const response = await POST(request)
  const status = response.status
  let data: any = null
  try {
    data = await response.json()
  } catch (error) {
    data = { error: '响应不是有效的 JSON', details: String(error) }
  }

  console.log(
    JSON.stringify(
      {
        status,
        body: data,
        tikHubBaseURL: TIKHUB_CONFIG.baseURL,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error('[sync-api-runner] 调用失败:', error)
  process.exit(1)
})
