/**
 * Pipeline步骤：优化转录文本
 *
 * 职责：
 * - 基础清理转录文本（去重、合并）
 * - 可选LLM优化（智能纠错、断句）
 * - 支持降级策略
 */

import type { DouyinPipelineEmitter } from '@/lib/douyin/pipeline'
import type { DouyinVideoInfo } from '@/lib/douyin/pipeline-steps'

export interface OptimizeTranscriptContext {
  transcript: string
  videoInfo: DouyinVideoInfo
  awemeDetail: any
}

export interface OptimizeTranscriptResult {
  optimizedTranscript: string
  optimizationUsed: boolean
}

/**
 * 基础文本清理
 */
function optimizeTranscript(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

/**
 * LLM优化转录文本（来自原pipeline.ts的optimizeTranscriptWithLLM）
 * 这里简化版，完整实现需要从原文件提取
 */
async function optimizeTranscriptWithLLM(
  _transcript: string,
  _apiKey: string,
  _modelId: string,
  _videoInfo: {
    title: string
    author: string
    hashtags: string[]
    videoTags: string[]
  },
  _options: {
    signal?: AbortSignal
    timeoutMs: number
    maxRetries: number
    onProgress: (chunk: string) => Promise<void>
  }
): Promise<string | null> {
  // TODO: 从原pipeline.ts提取optimizeTranscriptWithLLM的完整实现
  // 暂时返回基础清理结果
  return null
}

/**
 * 优化转录文本步骤
 */
export async function optimizeTranscriptStep(
  context: OptimizeTranscriptContext,
  emit: DouyinPipelineEmitter,
  optimizeApiKey?: string,
  optimizeModelId?: string,
  signal?: AbortSignal
): Promise<OptimizeTranscriptResult> {
  if (signal?.aborted) {
    throw new Error('操作已取消')
  }

  await emit({
    type: 'progress',
    step: 'optimize',
    status: 'active',
    detail: '正在清理转录文本...'
  } as any)

  // 先做基础清理
  const cleanedTranscript = optimizeTranscript(context.transcript)

  // 提取视频元数据
  const hashtags =
    context.awemeDetail.text_extra
      ?.filter((item: any) => item.hashtag_name)
      .map((item: any) => item.hashtag_name) || []

  const videoTags =
    context.awemeDetail.video_tag
      ?.map((tag: any) => tag.tag_name)
      .filter(Boolean) || []

  let optimizedTranscript = cleanedTranscript
  let optimizationUsed = false

  // 使用LLM优化（可选）
  if (optimizeApiKey && optimizeModelId) {
    await emit({
      type: 'progress',
      step: 'optimize',
      status: 'active',
      detail: '正在使用AI优化文案...'
    } as any)

    try {
      // 心跳机制
      let lastHeartbeat = Date.now()
      const heartbeatInterval = setInterval(async () => {
        const elapsed = Math.floor((Date.now() - lastHeartbeat) / 1000)
        await emit({
          type: 'progress',
          step: 'optimize',
          status: 'active',
          detail: `AI正在优化文案... (已等待${elapsed}秒)`
        } as any)
      }, 5000)

      try {
        const llmOptimized = await optimizeTranscriptWithLLM(
          cleanedTranscript,
          optimizeApiKey,
          optimizeModelId,
          {
            title: context.videoInfo.title,
            author: context.videoInfo.author,
            hashtags,
            videoTags
          },
          {
            signal,
            timeoutMs: 45000,
            maxRetries: 1,
            onProgress: async (chunk: string) => {
              lastHeartbeat = Date.now()
              await emit({
                type: 'partial',
                key: 'optimized',
                data: chunk,
                append: true
              })
            }
          }
        )

        clearInterval(heartbeatInterval)

        if (llmOptimized) {
          optimizedTranscript = llmOptimized
          optimizationUsed = true
        } else {
          await emit({
            type: 'partial',
            key: 'warn',
            data: '[警告] AI优化失败，已降级使用基础清理版本',
            append: false
          })
        }
      } finally {
        clearInterval(heartbeatInterval)
      }
    } catch (_optimizeError) {
      await emit({
        type: 'partial',
        key: 'warn',
        data: '[警告] AI优化过程出错，已降级使用基础清理版本',
        append: false
      })
    }
  } else {
    await emit({
      type: 'partial',
      key: 'warn',
      data: '[提示] 未配置AI优化密钥，使用基础清理版本',
      append: false
    })
  }

  return {
    optimizedTranscript,
    optimizationUsed
  }
}
