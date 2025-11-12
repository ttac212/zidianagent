/**
 * Pipeline步骤：生成Markdown总结
 *
 * 职责：
 * - 构建最终的Markdown输出
 * - 流式发送Markdown内容
 */

import type { DouyinPipelineEmitter } from '@/lib/douyin/pipeline'
import type { DouyinVideoInfo } from '@/lib/douyin/pipeline-steps'

export interface SummarizeContext {
  videoInfo: DouyinVideoInfo
  optimizedTranscript: string
}

export interface SummarizeResult {
  markdown: string
}

/**
 * 构建Markdown输出
 */
function buildMarkdown(videoInfo: DouyinVideoInfo, transcript: string): string {
  const lines = [
    `# ${videoInfo.title}`,
    '',
    `**作者**: ${videoInfo.author}`,
    `**时长**: ${videoInfo.duration.toFixed(1)}秒`,
    '',
    '## 📝 文案内容',
    '',
    transcript,
    ''
  ]

  return lines.join('\n')
}

/**
 * 流式发送Markdown内容
 */
async function streamMarkdownChunks(
  emit: DouyinPipelineEmitter,
  markdown: string,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) {
    throw new Error('操作已取消')
  }

  const chunkSize = 100
  const chunks = []

  for (let i = 0; i < markdown.length; i += chunkSize) {
    chunks.push(markdown.slice(i, i + chunkSize))
  }

  for (const chunk of chunks) {
    if (signal?.aborted) {
      throw new Error('操作已取消')
    }

    await emit({
      type: 'partial',
      key: 'markdown',
      data: chunk,
      append: true
    })

    // 模拟流式输出的自然间隔
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/**
 * 生成Markdown步骤
 */
export async function summarize(
  context: SummarizeContext,
  emit: DouyinPipelineEmitter,
  signal?: AbortSignal
): Promise<SummarizeResult> {
  if (signal?.aborted) {
    throw new Error('操作已取消')
  }

  const markdown = buildMarkdown(context.videoInfo, context.optimizedTranscript)

  await streamMarkdownChunks(emit, markdown, signal)

  return {
    markdown
  }
}
