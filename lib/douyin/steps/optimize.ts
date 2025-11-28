/**
 * Pipeline步骤：优化转录文本
 *
 * 职责：
 * - 基础清理转录文本（去重、合并、去空行）
 * - 使用 LLM 添加标点符号和断句
 */

import type { DouyinPipelineEmitter } from '@/lib/douyin/pipeline'
import type { DouyinVideoInfo } from '@/lib/douyin/pipeline-steps'

const LLM_ENDPOINT = 'https://api.302.ai/v1/chat/completions'
const LLM_OPTIMIZE_TIMEOUT_MS = 60_000

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
function basicCleanup(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

/**
 * 使用 LLM 添加标点符号
 */
async function addPunctuationWithLLM(
  transcript: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_OPTIMIZE_TIMEOUT_MS)

  // 合并外部信号
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const response = await fetch(LLM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `你是一个专业的中文文本处理助手。你的任务是为没有标点符号的转录文本添加合适的标点符号。

规则：
1. 根据语义和语气添加标点符号（句号、逗号、问号、感叹号等）
2. 保持原文内容不变，不要修改任何文字
3. 不要添加任何解释或说明
4. 直接输出添加标点后的文本`
          },
          {
            role: 'user',
            content: `请为以下转录文本添加合适的标点符号：

${transcript}`
          }
        ]
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`LLM API 错误: ${response.status}`)
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content?.trim()

    if (!result) {
      throw new Error('LLM 未返回有效结果')
    }

    return result
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * 优化转录文本步骤
 *
 * @param context 上下文（包含转录文本和视频信息）
 * @param emit 事件发射器
 * @param optimizeApiKey API Key
 * @param _optimizeModelId 已废弃，保留参数兼容性
 * @param signal 中止信号
 */
export async function optimizeTranscriptStep(
  context: OptimizeTranscriptContext,
  emit: DouyinPipelineEmitter,
  optimizeApiKey?: string,
  _optimizeModelId?: string,
  signal?: AbortSignal
): Promise<OptimizeTranscriptResult> {
  if (signal?.aborted) {
    throw new Error('操作已取消')
  }

  // 基础清理
  const cleanedTranscript = basicCleanup(context.transcript)

  // 如果没有 API Key，只做基础清理
  if (!optimizeApiKey) {
    return {
      optimizedTranscript: cleanedTranscript,
      optimizationUsed: false
    }
  }

  await emit({
    type: 'progress',
    step: 'optimize',
    status: 'active',
    detail: '正在添加标点符号...'
  } as any)

  try {
    const optimizedTranscript = await addPunctuationWithLLM(
      cleanedTranscript,
      optimizeApiKey,
      signal
    )

    // 输出优化后的文本
    await emit({
      type: 'partial',
      key: 'optimized',
      data: optimizedTranscript,
      append: false
    })

    return {
      optimizedTranscript,
      optimizationUsed: true
    }
  } catch (error) {
    // LLM 优化失败，返回基础清理结果
    console.warn('[optimize] LLM 优化失败，使用基础清理结果:', error)

    return {
      optimizedTranscript: cleanedTranscript,
      optimizationUsed: false
    }
  }
}
