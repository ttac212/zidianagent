/**
 * Pipeline步骤：解析分享链接
 *
 * 职责：
 * - 验证并解析抖音分享链接
 * - 提取videoId
 * - 处理链接格式错误
 */

import { parseDouyinVideoShare } from '@/lib/douyin/share-link'
import { DouyinPipelineStepError } from '@/lib/douyin/pipeline'

export interface ParseLinkContext {
  shareLink: string
}

export interface ParseLinkResult {
  videoId: string
  userId?: string
  secUserId?: string
  resolvedUrl: string
}

/**
 * 解析分享链接步骤
 */
export async function parseShareLink(
  context: ParseLinkContext,
  signal?: AbortSignal
): Promise<ParseLinkResult> {
  if (signal?.aborted) {
    throw new Error('操作已取消')
  }

  try {
    const shareResult = await parseDouyinVideoShare(context.shareLink)

    if (!shareResult.videoId) {
      throw new DouyinPipelineStepError('无法从链接中提取视频ID', 'parse-link')
    }

    return {
      videoId: shareResult.videoId,
      userId: shareResult.userId,
      secUserId: shareResult.secUserId,
      resolvedUrl: shareResult.resolvedUrl
    }
  } catch (error) {
    throw new DouyinPipelineStepError(
      error instanceof Error ? error.message : '链接解析失败',
      'parse-link',
      error
    )
  }
}
