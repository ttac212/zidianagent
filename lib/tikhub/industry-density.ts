/**
 * 垂类账号城市密度估算工具
 *
 * 通过热门垂类账号榜 + 账号档案中的省市信息，粗略估算指定城市的行业竞争程度。
 * 注意：TikHub 暂无城市维度的账号榜，纯属基于账号档案/画像的近似统计，结果存在噪声。
 */

import { TIKHUB_CONFIG } from './config'
import { getTikHubClient } from './client'
import type { FansInterestTopic, HotAccountInfo } from './types'

/**
 * 城市垂类密度的账号样本
 */
export interface CityIndustryAccountSample {
  sec_uid: string
  nick_name: string
  fans_cnt: number
  regionShare?: number
  fans_at_region?: number
}

/**
 * 城市垂类密度估算结果
 */
export interface CityIndustryDensityResult {
  cityKeyword: string
  tagId: number
  scannedAccounts: number
  matchedAccounts: number
  matchedFansTotal: number
  samples: CityIndustryAccountSample[]
  topTopics: Array<{ topic_name: string; count: number }>
}

interface EstimateOptions {
  limit?: number
  topicSampleSize?: number
  maxTopics?: number
  concurrent?: number
  nameKeywords?: string[]
}

/**
 * 基于热门垂类账号榜 + 账号档案省市字段，粗估某城市的行业密度。
 *
 * @param cityKeyword 城市关键词（模糊匹配 province/city/ip_location）
 * @param tagId 垂类标签 ID（从 getContentTags 返回的 value）
 * @param options.limit 拉取的垂类账号数量上限（默认 200）
 * @param options.topicSampleSize 为提取粉丝话题而取的前 N 个匹配账号（默认 10）
 * @param options.maxTopics 返回的粉丝兴趣话题数量上限（默认 10）
 * @param options.concurrent 并发请求数（默认 TIKHUB_CONFIG.maxConcurrent）
 */
export async function estimateCityIndustryDensity(
  cityKeyword: string,
  tagId: number,
  options: EstimateOptions = {}
): Promise<CityIndustryDensityResult> {
  const client = getTikHubClient()
  const limit = options.limit ?? 200
  const topicSampleSize = options.topicSampleSize ?? 10
  const maxTopics = options.maxTopics ?? 10
  const concurrent = options.concurrent ?? TIKHUB_CONFIG.maxConcurrent
  const nameKeywords = (options.nameKeywords || []).map((k) => k.trim()).filter(Boolean)

  // 1) 拉取垂类热门账号（分页，直到上限或无更多数据）
  const hotAccounts = await fetchHotAccountsByTag(client, tagId, limit)

  // 2) 并发获取粉丝地域画像，按城市关键词筛选
  const matchedProfiles: Array<{
    account: HotAccountInfo
    regionShare: number
  }> = []
  await mapWithConcurrency(
    hotAccounts,
    concurrent,
    async (account) => {
      try {
        if (nameKeywords.length && !matchesName(account, nameKeywords)) {
          return
        }
        const portrait = await client.getHotAccountFansPortrait({
          sec_uid: account.user_id,
          option: 4, // 省份分布
        })
        const share = extractRegionShare(portrait, cityKeyword)
        if (share && share > 0) {
          matchedProfiles.push({ account, regionShare: share })
        }
      } catch (_e) {
        // 单个账号失败忽略，避免影响整体估算
      }
    }
  )

  // 3) 聚合账号与粉丝量（按粉丝在目标地区的占比估算）
  const samples: CityIndustryAccountSample[] = matchedProfiles.map(
    ({ account, regionShare }) => ({
      sec_uid: account.user_id,
      nick_name: account.nick_name,
      fans_cnt: account.fans_cnt,
      regionShare,
      fans_at_region: Math.round((account.fans_cnt || 0) * regionShare),
    })
  )
  const matchedFansTotal = matchedProfiles.reduce((sum, { account, regionShare }) => {
    const fansAtRegion = (account.fans_cnt || 0) * regionShare
    return sum + (Number.isFinite(fansAtRegion) ? fansAtRegion : 0)
  }, 0)

  // 4) 取前 topicSampleSize 个账号，汇总粉丝兴趣话题
  const topicCounts = new Map<string, number>()
  const topicSamples = matchedProfiles.slice(0, topicSampleSize)
  await mapWithConcurrency(
    topicSamples,
    concurrent,
    async ({ account }) => {
      try {
        const topicsResp = await client.getFansInterestTopicList({
          sec_uid: account.user_id,
        })
        const topics = topicsResp?.data || []
        topics.forEach((t: FansInterestTopic) => {
          if (!t.topic_name) return
          const key = t.topic_name
          topicCounts.set(key, (topicCounts.get(key) || 0) + 1)
        })
      } catch (_e) {
        // 单个账号画像失败忽略
      }
    }
  )

  const topTopics = Array.from(topicCounts.entries())
    .map(([topic_name, count]) => ({ topic_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxTopics)

  return {
    cityKeyword,
    tagId,
    scannedAccounts: hotAccounts.length,
    matchedAccounts: matchedProfiles.length,
    matchedFansTotal,
    samples,
    topTopics,
  }
}

async function fetchHotAccountsByTag(
  client: ReturnType<typeof getTikHubClient>,
  tagId: number,
  limit: number
): Promise<HotAccountInfo[]> {
  const results: HotAccountInfo[] = []
  let page = 1
  let hasMore = true

  while (hasMore && results.length < limit) {
    const pageSize = Math.min(50, limit - results.length)
    const res = await client.getHotAccountList({
      query_tag: { value: tagId },
      page_num: page,
      page_size: pageSize,
    })
    results.push(...(res.data.user_list || []))
    hasMore = Boolean(res.data.has_more)
    page += 1
  }

  return results.slice(0, limit)
}

function extractRegionShare(portraitResp: any, keyword: string): number {
  if (!keyword.trim()) return 0
  const needle = keyword.trim().toLowerCase()
  const items: Array<{ name?: string; value?: number }> =
    portraitResp?.data?.portrait?.portrait_data || []
  const match = items.find((item) => {
    const name = item.name || ''
    return name.toLowerCase().includes(needle)
  })
  if (!match || typeof match.value !== 'number') return 0
  if (match.value <= 0) return 0
  return match.value
}

function matchesName(account: HotAccountInfo, keywords: string[]): boolean {
  const source = (account.nick_name || '').toLowerCase()
  if (!source) return false
  return keywords.some((k) => source.includes(k.toLowerCase()))
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let index = 0
  const runners = Array.from({ length: Math.max(1, concurrency) }).map(
    async () => {
      while (index < items.length) {
        const current = index++
        await worker(items[current], current)
      }
    }
  )
  await Promise.all(runners)
}
