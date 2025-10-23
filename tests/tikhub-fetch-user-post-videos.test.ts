import { beforeAll, describe, expect, it } from 'vitest'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { parseDouyinUserShare } from '@/lib/douyin/share-link'
import { TikHubClient } from '@/lib/tikhub'
import type { DouyinUserVideosResponse } from '@/lib/tikhub/types'

const SHARE_LINK = 'https://v.douyin.com/EdKxAitZ5hI/'
const LIVE_TEST_TIMEOUT = 30_000

function ensureTikHubEnv() {
  if (process.env.TIKHUB_API_KEY) {
    return
  }

  const candidates = ['.env.local', '.env']
  for (const file of candidates) {
    const envPath = resolve(process.cwd(), file)
    if (!existsSync(envPath)) {
      continue
    }

    loadEnv({ path: envPath })
    if (process.env.TIKHUB_API_KEY) {
      break
    }
  }
}

ensureTikHubEnv()

const apiKey = process.env.TIKHUB_API_KEY
const baseURL = process.env.TIKHUB_API_BASE_URL

const describeIf = apiKey ? describe : describe.skip

describeIf('TikHub fetch_user_post_videos endpoint', () => {
  let secUid: string
  let videos: DouyinUserVideosResponse

  beforeAll(async () => {
    const shareInfo = await parseDouyinUserShare(SHARE_LINK)
    const resolvedSecUid = shareInfo.secUserId ?? shareInfo.userId
    expect(resolvedSecUid).toBeTruthy()

    secUid = resolvedSecUid as string

    const client = new TikHubClient({
      apiKey,
      baseURL,
    })

    videos = await client.getUserVideos({ sec_uid: secUid, count: 5 })
  }, LIVE_TEST_TIMEOUT)

  it('resolves sec_uid from Douyin share link', () => {
    expect(secUid).toMatch(/^MS4wLjAB/)
  }, LIVE_TEST_TIMEOUT)

  it('returns structured user video data', () => {
    expect(typeof videos.status_code).toBe('number')
    expect(typeof videos.max_cursor).toBe('number')
    expect(typeof videos.min_cursor).toBe('number')
    const hasMoreType = typeof videos.has_more
    expect(['boolean', 'number']).toContain(hasMoreType)
    expect(videos.sec_uid ?? secUid).toBe(secUid)

    expect(Array.isArray(videos.aweme_list)).toBe(true)
    expect(videos.aweme_list.length).toBeGreaterThan(0)

    const first = videos.aweme_list[0]
    expect(first.aweme_id).toMatch(/^\d+$/)
    expect(typeof first.desc).toBe('string')

    expect(first.statistics).toEqual(
      expect.objectContaining({
        digg_count: expect.any(Number),
        comment_count: expect.any(Number),
        share_count: expect.any(Number),
        collect_count: expect.any(Number),
      })
    )

    expect(Array.isArray(first.video?.play_addr?.url_list)).toBe(true)
  }, LIVE_TEST_TIMEOUT)
})
