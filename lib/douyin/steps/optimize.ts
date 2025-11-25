/**
 * Pipeline步骤：优化转录文本
 *
 * 职责：
 * - 基础清理转录文本（去重、合并、去空行）
 *
 * 注意：LLM智能优化功能已移除，当前只提供基础清理
 * 原因：
 * 1. LLM优化增加延迟和成本
 * 2. ASR转录质量已足够，基础清理满足需求
 * 3. 避免误导用户（界面不再显示"AI优化"）
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
 * - 去除空行
 * - 去除首尾空白
 * - 合并连续空行
 */
function optimizeTranscript(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

/**
 * 优化转录文本步骤（仅基础清理）
 *
 * @param context 上下文（包含转录文本和视频信息）
 * @param emit 事件发射器
 * @param _optimizeApiKey 已废弃，保留参数兼容性
 * @param _optimizeModelId 已废弃，保留参数兼容性
 * @param signal 中止信号
 */
export async function optimizeTranscriptStep(
  context: OptimizeTranscriptContext,
  emit: DouyinPipelineEmitter,
  _optimizeApiKey?: string,
  _optimizeModelId?: string,
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

  // 基础清理
  const cleanedTranscript = optimizeTranscript(context.transcript)

  return {
    optimizedTranscript: cleanedTranscript,
    optimizationUsed: false  // 始终返回false，因为只是基础清理
  }
}
