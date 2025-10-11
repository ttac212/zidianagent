/**
 * Fetch Douyin user videos via TikHub Web API
 *
 * Usage:
 *   npx tsx scripts/fetch-douyin-web-videos.ts --sec-uid <sec_user_id> [--count 10] [--max-cursor 0] [--filter-type 0] [--raw] [--output response.json]
 *
 * Environment:
 *   TIKHUB_API_KEY         TikHub API key (required unless --api-key is provided)
 *   DOUYIN_SEC_UID         Default sec_user_id fallback (optional)
 */

import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const API_BASE_URL = 'https://api.tikhub.io'
const DEFAULT_SEC_UID = 'MS4wLjABAAAANXSltcLCzDGmdNFI2Q_QixVTr67NiYzjKOIP5s03CAE'

interface CliOptions {
  apiKey: string
  secUid: string
  count: number
  maxCursor: string
  filterType: string
  showRaw: boolean
  outputPath?: string
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const options: CliOptions = {
    apiKey: process.env.TIKHUB_API_KEY ?? '',
    secUid: process.env.DOUYIN_SEC_UID ?? '',
    count: 10,
    maxCursor: '0',
    filterType: '0',
    showRaw: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (!arg.startsWith('--')) {
      if (!options.secUid) {
        options.secUid = arg
      }
      continue
    }

    const eqIndex = arg.indexOf('=')
    const flag = eqIndex >= 0 ? arg.slice(0, eqIndex) : arg
    const valueFromEquals = eqIndex >= 0 ? arg.slice(eqIndex + 1) : undefined
    let value = valueFromEquals

    if (value === undefined && index + 1 < args.length && !args[index + 1].startsWith('--')) {
      value = args[index + 1]
      index += 1
    }

    if (flag === '--raw') {
      options.showRaw = true
    } else if (flag === '--api-key') {
      options.apiKey = value ?? ''
    } else if (flag === '--sec-uid') {
      options.secUid = value ?? ''
    } else if (flag === '--count') {
      const parsed = Number.parseInt(value ?? '', 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        options.count = parsed
      }
    } else if (flag === '--max-cursor') {
      options.maxCursor = value ?? '0'
    } else if (flag === '--filter-type') {
      options.filterType = value ?? '0'
    } else if (flag === '--output') {
      options.outputPath = value
    }
  }

  if (!options.secUid) {
    options.secUid = DEFAULT_SEC_UID
    console.warn('⚠️  sec_user_id 未提供，使用示例 ID。在生产环境请显式传入。')
  }

  if (!options.apiKey) {
    console.error('❌ 未找到 TikHub API Key。请设置环境变量 TIKHUB_API_KEY 或通过 --api-key 传入。')
    process.exit(1)
  }

  return options
}

function printHelp(): void {
  console.log(`
TikHub Douyin Web API 数据探查脚本

选项:
  --sec-uid=<id>        指定 Douyin 用户的 sec_user_id
  --count=<number>      设置返回视频数量 (默认 10，建议 <= 20)
  --max-cursor=<cursor> 翻页游标，首次请求保持 0
  --filter-type=<type>  过滤类型，默认 0
  --api-key=<key>       覆盖环境变量中的 TikHub API Key
  --raw                 打印完整 JSON 响应
  --output=<file>       将完整响应写入文件 (JSON 格式)
  -h, --help            查看帮助

示例:
  TIKHUB_API_KEY=xxx npx tsx scripts/fetch-douyin-web-videos.ts --sec-uid <id>
  npx tsx scripts/fetch-douyin-web-videos.ts --sec-uid <id> --count=5 --raw
`)
}

function buildRequestUrl(options: CliOptions): string {
  const params = new URLSearchParams({
    sec_user_id: options.secUid,
    max_cursor: options.maxCursor,
    count: String(options.count),
    filter_type: options.filterType,
  })

  return `${API_BASE_URL}/api/v1/douyin/web/fetch_user_post_videos?${params.toString()}`
}

function printTopLevelSummary(response: any): void {
  console.log('📦 顶层字段:', Object.keys(response).join(', '))

  const dataNode = typeof response.data === 'object' && response.data !== null
    ? response.data
    : response

  if (dataNode.cache_url) {
    console.log('🔄 缓存地址:', dataNode.cache_url)
  } else if (response.cache_url) {
    console.log('🔄 缓存地址:', response.cache_url)
  }

  console.log('🧭 请求路由:', response.router ?? '未知')
  console.log('🕒 时间戳:', response.time ?? '未知', '\n')

  if (typeof dataNode !== 'object' || dataNode === null) {
    console.warn('⚠️  无 data 字段，原始响应可能已包含 aweme_list。')
    return
  }

  if ('status_code' in dataNode) {
    console.log('✅ 接口状态码:', dataNode.status_code)
  }

  console.log('➡️  数据节点字段:', Object.keys(dataNode).join(', '))
}

function printAwemeSummary(response: any): void {
  const dataNode = typeof response.data === 'object' && response.data !== null
    ? response.data
    : response

  const awemeList = Array.isArray(dataNode.aweme_list) ? dataNode.aweme_list : []
  console.log('🎬 视频条数:', awemeList.length)

  if (!awemeList.length) {
    console.log('⚠️  aweme_list 为空，检查 sec_user_id 是否有效。')
    return
  }

  const [firstAweme] = awemeList
  console.log('\n🔍 第一个视频字段:')
  console.log('  顶层字段:', Object.keys(firstAweme).join(', '))

  if (firstAweme.author) {
    console.log('  作者字段:', Object.keys(firstAweme.author).join(', '))
    console.log('  作者昵称:', firstAweme.author.nickname)
  }

  if (firstAweme.statistics) {
    console.log('  统计字段:', Object.keys(firstAweme.statistics).join(', '))
    console.log('  点赞数:', firstAweme.statistics.digg_count)
    console.log('  评论数:', firstAweme.statistics.comment_count)
  }

  if (firstAweme.video) {
    console.log('  视频字段:', Object.keys(firstAweme.video).join(', '))
    const firstUrl = firstAweme.video.play_addr?.url_list?.[0]
    if (firstUrl) {
      console.log('  播放地址示例:', firstUrl)
    }
  }

  if (firstAweme.create_time) {
    const publishedAt = new Date(firstAweme.create_time * 1000)
    console.log('  发布时间:', publishedAt.toISOString())
  }

  if (dataNode.has_more !== undefined) {
    console.log('\n📄 分页信息:')
    console.log('  has_more:', dataNode.has_more)
    console.log('  max_cursor:', dataNode.max_cursor)
    console.log('  min_cursor:', dataNode.min_cursor)
  }
}

function createVideoPreview(video: any) {
  return {
    aweme_id: video.aweme_id,
    desc: video.desc,
    create_time: video.create_time,
    duration: video.duration ?? video.video?.duration,
    statistics: video.statistics
      ? {
          digg_count: video.statistics.digg_count,
          comment_count: video.statistics.comment_count,
          share_count: video.statistics.share_count,
          collect_count: video.statistics.collect_count,
          play_count: video.statistics.play_count,
        }
      : undefined,
    author: video.author
      ? {
          uid: video.author.uid,
          sec_uid: video.author.sec_uid,
          nickname: video.author.nickname,
          unique_id: video.author.unique_id,
        }
      : undefined,
    hashtags: Array.isArray(video.text_extra)
      ? video.text_extra.map((tag: any) => ({
          hashtag_name: tag.hashtag_name,
          hashtag_id: tag.hashtag_id,
        }))
      : undefined,
    play_urls: video.video?.play_addr?.url_list?.slice(0, 2),
    cover_urls: video.video?.cover?.url_list?.slice(0, 1),
    music: video.music
      ? {
          id: video.music.id,
          title: video.music.title,
          author: video.music.author,
          duration: video.music.duration,
        }
      : undefined,
  }
}

async function maybeWriteOutput(options: CliOptions, payload: any): Promise<void> {
  if (!options.outputPath) {
    return
  }

  const targetPath = options.outputPath
  const parentDir = dirname(targetPath)
  if (parentDir && parentDir !== '.' && !existsSync(parentDir)) {
    console.warn(`⚠️  目录 ${parentDir} 不存在，跳过写入。`)
    return
  }

  await writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`\n💾 已写入完整响应到 ${targetPath}`)
}

async function main(): Promise<void> {
  const options = parseArgs()
  const requestUrl = buildRequestUrl(options)

  console.log('🚀 请求 TikHub Douyin Web API')
  console.log('🔑 使用的 API Key 前缀:', `${options.apiKey.slice(0, 6)}***`)
  console.log('👤 sec_user_id:', options.secUid)
  console.log('📥 请求地址:', requestUrl, '\n')

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  console.log('HTTP 状态:', response.status, response.statusText, '\n')

  let payload: any
  try {
    payload = await response.json()
  } catch (error) {
    console.error('❌ 无法解析 JSON 响应:', (error as Error).message)
    process.exitCode = 1
    return
  }

  if (!response.ok) {
    console.error('❌ 请求失败:')
    console.error(JSON.stringify(payload, null, 2))
    process.exitCode = 1
    return
  }

  await maybeWriteOutput(options, payload)

  printTopLevelSummary(payload)
  printAwemeSummary(payload)

  if (options.showRaw) {
    console.log('\n🧾 完整响应 JSON:\n')
    console.log(JSON.stringify(payload, null, 2))
  } else {
    const dataNode = typeof payload.data === 'object' && payload.data !== null
      ? payload.data
      : payload
    const awemeList = Array.isArray(dataNode.aweme_list) ? dataNode.aweme_list : []

    if (awemeList.length > 0) {
      const preview = {
        code: payload.code,
        message: payload.message,
        router: payload.router,
        params: payload.params,
        data: {
          status_code: dataNode.status_code,
          has_more: dataNode.has_more,
          max_cursor: dataNode.max_cursor,
          min_cursor: dataNode.min_cursor,
          aweme_list: awemeList.slice(0, 2).map(createVideoPreview),
        },
      }
      console.log('\n🧾 前两个视频示例:\n')
      console.log(JSON.stringify(preview, null, 2))
    }
  }
}

main().catch((error) => {
  console.error('❌ 执行失败:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})

export {}
