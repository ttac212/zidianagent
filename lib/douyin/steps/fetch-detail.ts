/**
 * Pipeline步骤：获取视频详情
 *
 * 职责：
 * - 调用TikHub API获取视频元数据
 * - 提取播放URL
 * - 构建videoInfo对象
 */

import { getTikHubClient } from '@/lib/tikhub'
import { DouyinPipelineStepError } from '@/lib/douyin/pipeline'
import type { DouyinVideoInfo } from '@/lib/douyin/pipeline-steps'

export interface FetchDetailContext {
  videoId: string
}

export interface FetchDetailResult {
  videoInfo: DouyinVideoInfo
  playUrl: string
  awemeDetail: any  // 原始TikHub数据，供后续步骤使用
}

/**
 * 从TikHub返回的aweme_detail中提取可播放URL
 */
function resolvePlayableVideoUrl(awemeDetail: any): string | null {
  const videoData: any = awemeDetail.video || awemeDetail

  if (!videoData) return null

  const candidates: Array<string | undefined> = []

  // 1. play_addr 是主要播放地址
  if (Array.isArray(videoData.play_addr?.url_list)) {
    candidates.push(...videoData.play_addr.url_list)
  }

  // 2. bit_rate 包含不同码率的播放地址
  if (Array.isArray(videoData.bit_rate)) {
    for (const item of videoData.bit_rate) {
      if (Array.isArray(item?.play_addr?.url_list)) {
        candidates.push(...item.play_addr.url_list)
      }
    }
  }

  // 3. download_addr 作为备选
  if (Array.isArray(videoData.download_addr?.url_list)) {
    candidates.push(...videoData.download_addr.url_list)
  }

  // 去除水印URL (playwm -> play)
  const sanitized = candidates
    .map((url) => (url?.includes('playwm') ? url.replace('playwm', 'play') : url))
    .filter((url): url is string => Boolean(url))

  // 优先返回包含aweme的URL
  return sanitized.find((url) => url.includes('aweme')) || sanitized[0] || null
}

/**
 * 规范化视频时长（统一为秒）
 */
function normalizeDurationSeconds(duration?: number | null): number {
  if (!duration || Number.isNaN(duration)) return 0
  // 如果是毫秒则转换为秒
  return duration >= 1000 ? duration / 1000 : duration
}

/**
 * 获取视频详情步骤
 */
export async function fetchVideoDetail(
  context: FetchDetailContext,
  signal?: AbortSignal
): Promise<FetchDetailResult> {
  if (signal?.aborted) {
    throw new Error('操作已取消')
  }

  try {
    const tikhubClient = getTikHubClient()
    const videoDetail = await tikhubClient.getVideoDetail({
      aweme_id: context.videoId
    })

    if (signal?.aborted) {
      throw new Error('操作已取消')
    }

    const awemeDetail = videoDetail?.aweme_detail
    if (!awemeDetail) {
      throw new DouyinPipelineStepError(
        'TikHub未返回视频详情数据',
        'fetch-detail'
      )
    }

    const playUrl = resolvePlayableVideoUrl(awemeDetail)
    if (!playUrl) {
      throw new DouyinPipelineStepError(
        '未能获取可用的视频播放地址',
        'fetch-detail'
      )
    }

    const videoInfo: DouyinVideoInfo = {
      title: awemeDetail.desc || '未知标题',
      author: awemeDetail.author?.nickname || '未知作者',
      duration: normalizeDurationSeconds(awemeDetail.video?.duration),
      videoId: context.videoId,
      coverUrl: awemeDetail.video?.cover?.url_list?.[0]
    }

    return {
      videoInfo,
      playUrl,
      awemeDetail  // 传递给后续步骤使用（如提取hashtags）
    }
  } catch (error) {
    throw new DouyinPipelineStepError(
      error instanceof Error ? error.message : 'TikHub API调用失败',
      'fetch-detail',
      error
    )
  }
}
