/**
 * Pipeline步骤：下载视频
 *
 * 职责：
 * - 下载视频文件到内存
 * - 支持进度回调
 * - 支持取消操作
 * - 检查文件大小限制（Vercel部署保护）
 * - 超时控制
 *
 * 2025年重构：使用统一的 abort-utils 处理取消/超时
 */

import { VideoProcessor } from '@/lib/video/video-processor'
import {
  DOUYIN_DEFAULT_HEADERS,
  DOUYIN_PIPELINE_LIMITS,
  formatBytes
} from '@/lib/douyin/constants'
import { DouyinPipelineStepError } from '@/lib/douyin/pipeline'
import type { DouyinPipelineEmitter } from '@/lib/douyin/pipeline'
import { AbortError, TimeoutError, ensureNotAborted, withAbortableTimeout } from '@/lib/utils/abort-utils'

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
  ensureNotAborted(signal)

  const requestHeaders: Record<string, string> = {
    ...DOUYIN_DEFAULT_HEADERS
  }

  try {
    // 获取视频信息
    const headInfo = await VideoProcessor.getVideoInfo(context.playUrl, {
      headers: requestHeaders
    })

    ensureNotAborted(signal)

    // 检查文件大小限制（Vercel部署保护）
    if (DOUYIN_PIPELINE_LIMITS.ENABLED && headInfo.size) {
      const maxSize = DOUYIN_PIPELINE_LIMITS.MAX_VIDEO_SIZE_BYTES
      if (headInfo.size > maxSize) {
        throw new DouyinPipelineStepError(
          `视频文件过大：当前${formatBytes(headInfo.size)}，` +
          `最大支持${formatBytes(maxSize)}。` +
          `如需处理更大文件，请联系管理员或使用自托管部署。`,
          'download-video'
        )
      }
    }

    let lastDownloadPercent = -1

    // 使用统一的超时控制
    const timeoutMs = DOUYIN_PIPELINE_LIMITS.ENABLED
      ? DOUYIN_PIPELINE_LIMITS.DOWNLOAD_TIMEOUT_MS
      : 0

    const downloadResult = await withAbortableTimeout(
      async (downloadSignal) => {
        return VideoProcessor.downloadVideo(
          context.playUrl,
          headInfo,
          {
            headers: requestHeaders,
            signal: downloadSignal,
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

              // 实时检查文件大小（防止响应头不准确）
              if (DOUYIN_PIPELINE_LIMITS.ENABLED) {
                const maxSize = DOUYIN_PIPELINE_LIMITS.MAX_VIDEO_SIZE_BYTES
                if (downloaded > maxSize) {
                  throw new DouyinPipelineStepError(
                    `视频文件过大，已超过${formatBytes(maxSize)}限制`,
                    'download-video'
                  )
                }
              }

              ensureNotAborted(downloadSignal)
            }
          }
        )
      },
      {
        timeoutMs,
        signal,
        timeoutMessage: `视频下载超时（${timeoutMs / 1000}秒），可能是网络问题或视频过大。请稍后重试或选择较短的视频。`
      }
    )

    return {
      videoBuffer: downloadResult.buffer
    }
  } catch (error) {
    // 转换为统一的 Pipeline 错误
    if (error instanceof DouyinPipelineStepError) {
      throw error
    }

    if (error instanceof AbortError) {
      throw new Error('操作已取消')
    }

    if (error instanceof TimeoutError) {
      throw new DouyinPipelineStepError(
        error.message,
        'download-video',
        error
      )
    }

    throw new DouyinPipelineStepError(
      error instanceof Error ? error.message : '视频下载失败',
      'download-video',
      error
    )
  }
}
