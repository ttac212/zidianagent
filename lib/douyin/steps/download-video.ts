/**
 * Pipeline步骤：下载视频
 *
 * 职责：
 * - 下载视频文件到内存
 * - 支持进度回调
 * - 支持取消操作
 */

import { VideoProcessor } from '@/lib/video/video-processor'
import { DOUYIN_DEFAULT_HEADERS } from '@/lib/douyin/constants'
import { DouyinPipelineStepError } from '@/lib/douyin/pipeline'
import type { DouyinPipelineEmitter } from '@/lib/douyin/pipeline'

export interface DownloadVideoContext {
  playUrl: string
}

export interface DownloadVideoResult {
  videoBuffer: Buffer
}

/**
 * 下载视频步骤
 */
export async function downloadVideo(
  context: DownloadVideoContext,
  emit: DouyinPipelineEmitter,
  signal?: AbortSignal
): Promise<DownloadVideoResult> {
  if (signal?.aborted) {
    throw new Error('操作已取消')
  }

  const requestHeaders: Record<string, string> = {
    ...DOUYIN_DEFAULT_HEADERS
  }

  try {
    const headInfo = await VideoProcessor.getVideoInfo(context.playUrl, {
      headers: requestHeaders
    })

    if (signal?.aborted) {
      throw new Error('操作已取消')
    }

    let lastDownloadPercent = -1

    const downloadResult = await VideoProcessor.downloadVideo(
      context.playUrl,
      headInfo,
      {
        headers: requestHeaders,
        signal,
        onProgress: async (downloaded, total) => {
          const percent =
            total > 0 ? Math.floor((downloaded / total) * 100) : undefined

          if (
            typeof percent === 'number' &&
            percent !== lastDownloadPercent &&
            percent < 100
          ) {
            lastDownloadPercent = percent
            await emit({
              type: 'progress',
              step: 'download-video',
              status: 'active',
              detail: `下载进度 ${percent}%`
            } as any)
          }

          if (signal?.aborted) {
            throw new Error('操作已取消')
          }
        }
      }
    )

    return {
      videoBuffer: downloadResult.buffer
    }
  } catch (error) {
    throw new DouyinPipelineStepError(
      error instanceof Error ? error.message : '视频下载失败',
      'download-video',
      error
    )
  }
}
