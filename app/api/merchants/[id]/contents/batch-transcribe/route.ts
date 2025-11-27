/**
 * 批量转录视频内容 API
 * POST /api/merchants/[id]/contents/batch-transcribe
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { VideoProcessor } from '@/lib/video/video-processor'
import { getTikHubClient } from '@/lib/tikhub'
import {
  success,
  unauthorized,
  badRequest,
  serverError,
} from '@/lib/api/http-response'
import { buildLLMRequestAuto } from '@/lib/ai/request-builder'
import { DOUYIN_DEFAULT_HEADERS, DOUYIN_PIPELINE_LIMITS, isVercelEnvironment } from '@/lib/douyin/constants'

export const maxDuration = 300 // 5分钟超时

/**
 * 转录单个视频内容
 */
async function transcribeContent(
  contentId: string,
  merchantId: string,
  apiKey: string
): Promise<{
  contentId: string
  status: 'success' | 'failed' | 'skipped'
  transcript?: string
  textLength?: number
  reason?: string
  error?: string
}> {
  try {
    // 1. 获取内容详情
    const content = await prisma.merchantContent.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        externalId: true,
        transcript: true,
        merchantId: true,
      },
    })

    if (!content) {
      return {
        contentId,
        status: 'failed',
        error: '内容不存在',
      }
    }

    if (content.merchantId !== merchantId) {
      return {
        contentId,
        status: 'failed',
        error: '内容不属于该商家',
      }
    }

    // 2. 获取视频详情
    const tikhubClient = getTikHubClient()
    const videoDetail = await tikhubClient.getVideoDetail({
      aweme_id: content.externalId,
    })

    const awemeDetail = videoDetail.aweme_detail

    // 3. 获取音频直链（优先）或视频播放地址（备用）
    const audioUrl = resolveAudioUrl(awemeDetail)
    let audioBuffer: Buffer

    if (audioUrl) {
      // 尝试直接下载音频（跳过 FFmpeg）
      console.info(`[批量转录] 发现音频直链，直接下载: ${audioUrl.substring(0, 80)}...`)

      try {
        // 创建带超时的 AbortController
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), DOUYIN_PIPELINE_LIMITS.DOWNLOAD_TIMEOUT_MS)

        try {
          const audioResponse = await fetch(audioUrl, {
            headers: DOUYIN_DEFAULT_HEADERS,
            signal: controller.signal,
          })

          if (!audioResponse.ok) {
            throw new Error(`HTTP ${audioResponse.status}`)
          }

          const rawAudioBuffer = Buffer.from(await audioResponse.arrayBuffer())
          console.info(`[批量转录] 音频下载完成，大小: ${(rawAudioBuffer.length / 1024).toFixed(2)} KB`)

          // 抖音音频直链返回的是 AAC/M4A 格式，GPT-4o Audio 不支持
          // 需要使用 FFmpeg 转换为 MP3 格式
          if (isVercelEnvironment()) {
            // Vercel 环境无法使用 FFmpeg 进行格式转换
            throw new Error('音频直链格式(AAC)不兼容，Vercel环境无法转换')
          }

          console.info('[批量转录] 正在转换音频格式（AAC→MP3）...')
          audioBuffer = await VideoProcessor.extractAudio(rawAudioBuffer, {
            format: 'mp3',
            sampleRate: 16000,
            channels: 1,
            bitrate: '128k',
          })
          console.info(`[批量转录] 音频转换完成，大小: ${(audioBuffer.length / 1024).toFixed(2)} KB`)
        } finally {
          clearTimeout(timeoutId)
        }
      } catch (error) {
        // 音频直链下载失败，检查是否可以回退
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.warn(`[批量转录] 音频直链下载失败: ${errorMessage}`)

        // Vercel 环境不支持 FFmpeg 回退，直接返回失败
        if (isVercelEnvironment()) {
          const isTimeout = error instanceof Error && error.name === 'AbortError'
          return {
            contentId,
            status: 'failed',
            error: isTimeout
              ? '下载音频超时且无法回退 (Vercel环境)'
              : `音频直链下载失败且无法回退 (Vercel环境): ${errorMessage}`,
          }
        }

        // 本地环境：无论超时还是其他错误都可以回退到 FFmpeg 流程
        console.info('[批量转录] 回退到传统 FFmpeg 流程')
        const videoUrl = resolvePlayableVideoUrl(awemeDetail)
        if (!videoUrl) {
          return { contentId, status: 'failed', error: '无法获取视频播放地址' }
        }

        const videoInfo = await VideoProcessor.getVideoInfo(videoUrl, {
          headers: DOUYIN_DEFAULT_HEADERS,
        })

        const downloadResult = await VideoProcessor.downloadVideo(videoUrl, videoInfo, {
          headers: DOUYIN_DEFAULT_HEADERS,
          maxRetries: 3,
        })

        audioBuffer = await VideoProcessor.extractAudio(downloadResult.buffer, {
          format: 'mp3',
          sampleRate: 16000,
          channels: 1,
          bitrate: '128k',
        })
      }
    } else {
      // 备用：下载视频 + FFmpeg 提取（仅本地环境可用）
      console.warn('[批量转录] 未找到音频直链，使用传统 FFmpeg 流程')

      // Vercel 环境不支持 FFmpeg
      if (isVercelEnvironment()) {
        return {
          contentId,
          status: 'failed',
          error: '未找到音频直链，Vercel环境不支持FFmpeg',
        }
      }

      const videoUrl = resolvePlayableVideoUrl(awemeDetail)
      if (!videoUrl) {
        return { contentId, status: 'failed', error: '无法获取视频播放地址' }
      }

      const videoInfo = await VideoProcessor.getVideoInfo(videoUrl, {
        headers: DOUYIN_DEFAULT_HEADERS,
      })

      const downloadResult = await VideoProcessor.downloadVideo(videoUrl, videoInfo, {
        headers: DOUYIN_DEFAULT_HEADERS,
        maxRetries: 3,
      })

      audioBuffer = await VideoProcessor.extractAudio(downloadResult.buffer, {
        format: 'mp3',
        sampleRate: 16000,
        channels: 1,
        bitrate: '128k',
      })
    }

    // 6. GPT-4o 转录
    const base64Audio = audioBuffer.toString('base64')
    const asrResponse = await fetch('https://api.302.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-audio-preview',
        modalities: ['text'],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `这是一段抖音视频的音频转录任务。请仔细转录音频内容，注意以下要点：

1. **准确识别**：尽可能准确地识别每个字词，特别注意处理方言口音和不标准发音
2. **同音字辨析**：遇到同音字时，结合上下文语境选择正确的汉字
3. **专业术语**：遇到行业术语、品牌名称或网络用语时，使用最常见的规范写法
4. **保持原意**：完整转录说话内容，包括语气词（如"嗯"、"啊"、"哦"等）
5. **纯文本输出**：只返回转录的文字，不要添加任何说明、解释或格式标记

请开始转录：`,
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: base64Audio,
                  format: 'mp3',
                },
              },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    })

    if (!asrResponse.ok) {
      const errorText = await asrResponse.text()
      return {
        contentId,
        status: 'failed',
        error: `GPT-4o转录失败: ${asrResponse.status} - ${errorText}`,
      }
    }

    const asrResult = await asrResponse.json()
    const transcribedText = asrResult.choices?.[0]?.message?.content || ''

    if (!transcribedText) {
      return {
        contentId,
        status: 'failed',
        error: '转录失败,未返回文本',
      }
    }

    // 7. Claude 优化文案
    const hashtags =
      awemeDetail.text_extra
        ?.filter((item: any) => item.hashtag_name)
        .map((item: any) => item.hashtag_name) || []

    const videoTags =
      awemeDetail.video_tag?.map((tag: any) => tag.tag_name).filter(Boolean) || []

    const optimizedText = await optimizeTextWithLLM(transcribedText, apiKey, {
      title: awemeDetail.desc || '未知标题',
      author: awemeDetail.author?.nickname || '未知作者',
      hashtags,
      videoTags,
    })

    const finalTranscript = optimizedText || transcribedText

    // 8. 更新数据库
    await prisma.merchantContent.update({
      where: { id: contentId },
      data: {
        transcript: finalTranscript,
        hasTranscript: true,
      },
    })

    return {
      contentId,
      status: 'success',
      transcript: finalTranscript,
      textLength: finalTranscript.length,
    }
  } catch (error: any) {
    console.error(`转录内容 ${contentId} 失败:`, error)
    return {
      contentId,
      status: 'failed',
      error: error.message || '未知错误',
    }
  }
}

/**
 * 批量处理内容
 */
async function processBatch<T>(
  items: T[],
  handler: (item: T) => Promise<any>,
  concurrent = 3
): Promise<PromiseSettledResult<any>[]> {
  const results: PromiseSettledResult<any>[] = []

  for (let i = 0; i < items.length; i += concurrent) {
    const batch = items.slice(i, i + concurrent)
    const batchResults = await Promise.allSettled(batch.map(handler))
    results.push(...batchResults)

    // 批次间延迟，避免API限流
    if (i + concurrent < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return results
}

/**
 * 优化转录文本
 */
async function optimizeTextWithLLM(
  text: string,
  apiKey: string,
  videoInfo: {
    title: string
    author: string
    hashtags?: string[]
    videoTags?: string[]
  }
): Promise<string | null> {
  try {
    // 使用 ZenMux API 进行文案优化
    const apiBase = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
    const optimizationModel = process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5'
    const zenmuxApiKey = process.env.ZENMUX_API_KEY || apiKey

    const contextParts = [
      `视频标题：${videoInfo.title}`,
      `作者：${videoInfo.author}`,
    ]

    if (videoInfo.hashtags && videoInfo.hashtags.length > 0) {
      contextParts.push(`话题标签：${videoInfo.hashtags.join('、')}`)
    }

    if (videoInfo.videoTags && videoInfo.videoTags.length > 0) {
      contextParts.push(`视频标签：${videoInfo.videoTags.join('、')}`)
    }

    const contextInfo = contextParts.join('\n')

    // 使用统一的请求构建函数，自动处理ZenMux参数规范
    const requestBody = buildLLMRequestAuto({
      model: optimizationModel,
      messages: [
        {
          role: 'system',
          content: `你是一个专业的抖音视频文案编辑。你的核心任务是利用视频的标题、标签等上下文信息，修正语音转录中的同音字错误和识别错误。

**工作流程：**
1. **仔细阅读视频上下文信息**（标题、作者、标签），理解视频主题
2. **识别关键词**：从标题和标签中提取地名、人名、品牌、专业术语等关键信息
3. **逐句核对转录文本**：检查是否有与关键词发音相同但字形错误的内容
4. **修正错误**：
   - 地名错误：如"南京"→"南宁"（根据标题确认）
   - 人名错误：如"金姐"→"君姐"（根据作者名确认）
   - 品牌/术语错误：根据标签中的规范写法修正
5. **添加标点**：为文本添加适当的标点符号和段落
6. **保持原意**：只修正错误，不添加原文没有的内容

**重要原则：**
- ⚠️ **优先使用视频标题和标签中的词语**：如果转录文本中出现与标题/标签发音相似的词，必须以标题/标签为准
- ⚠️ **地名、人名必须严格核对**：这类错误最常见，必须仔细比对
- ⚠️ **专业术语以标签为准**：标签中的写法通常是规范的
- 直接输出优化后的文本，不要添加任何说明`,
        },
        {
          role: 'user',
          content: `${contextInfo}

---

**转录文本：**
${text}

---

**修正要求：**
1. 根据标题、标签修正同音字错误
2. 添加标点符号和分段
3. 保持原文意思，只修正错误
4. 直接输出优化后的文本`,
        },
      ],
      maxTokens: 4000,
      temperature: 0.3,
    });

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zenmuxApiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      console.error('Claude优化失败:', await response.text())
      return null
    }

    const result = await response.json()
    return result.choices?.[0]?.message?.content || null
  } catch (error) {
    console.error('优化文案失败:', error)
    return null
  }
}

/**
 * 解析视频播放地址
 */
function resolvePlayableVideoUrl(awemeDetail: any): string | null {
  // 优先使用 play_addr
  if (awemeDetail.video?.play_addr?.url_list?.length > 0) {
    return awemeDetail.video.play_addr.url_list[0]
  }

  // 备用: download_addr
  if (awemeDetail.video?.download_addr?.url_list?.length > 0) {
    return awemeDetail.video.download_addr.url_list[0]
  }

  return null
}

/**
 * 从 aweme_detail 中提取音频 URL
 * 音频 URL 来自 music.play_url.url_list，可直接下载 MP3
 * 这样可以跳过 FFmpeg 音频提取步骤，解决 Vercel 部署问题
 */
function resolveAudioUrl(awemeDetail: any): string | null {
  const music = awemeDetail?.music
  if (!music) return null

  // 优先使用 play_url.url_list
  if (Array.isArray(music.play_url?.url_list) && music.play_url.url_list.length > 0) {
    return music.play_url.url_list[0]
  }

  // 备选：直接使用 play_url.uri（如果是完整 URL）
  if (music.play_url?.uri && music.play_url.uri.startsWith('http')) {
    return music.play_url.uri
  }

  return null
}

/**
 * POST /api/merchants/[id]/contents/batch-transcribe
 * 批量转录视频内容
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 权限验证（仅管理员）
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return unauthorized('需要管理员权限')
    }

    const { id: merchantId } = await params

    // 2. 解析请求参数
    const body = await req.json()
    const {
      contentIds,
      mode = 'missing',
      concurrent = 100,
    } = body as {
      contentIds: string[]
      mode?: 'missing' | 'all' | 'force'
      concurrent?: number
    }

    if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
      return badRequest('contentIds 参数必须是非空数组')
    }

    if (contentIds.length > 1000) {
      return badRequest('单次最多处理1000个视频')
    }

    // 3. 验证商家存在
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    })

    if (!merchant) {
      return badRequest('商家不存在')
    }

    // 4. 获取API Key
    const apiKey = process.env.LLM_API_KEY
    if (!apiKey) {
      return serverError('未配置API Key')
    }

    // 5. 根据mode过滤内容
    let targetContents = await prisma.merchantContent.findMany({
      where: {
        id: { in: contentIds },
        merchantId,
      },
      select: {
        id: true,
        transcript: true,
        hasTranscript: true,
      },
    })

    // 过滤逻辑
    if (mode === 'missing') {
      // 只处理没有转录的内容
      targetContents = targetContents.filter(
        (c) => !c.transcript || !c.hasTranscript
      )
    } else if (mode === 'all') {
      // 处理所有内容，但跳过已有转录的（不重新转录）
      // 不需要过滤，但后续处理时会检查
    } else if (mode === 'force') {
      // 强制覆盖所有内容，不过滤
    }

    if (targetContents.length === 0) {
      return success({
        summary: {
          total: contentIds.length,
          processed: 0,
          skipped: contentIds.length,
          failed: 0,
        },
        results: contentIds.map((id) => ({
          contentId: id,
          status: 'skipped',
          reason: mode === 'missing' ? 'already_has_transcript' : 'not_found',
        })),
      })
    }

    // 6. 批量处理
    const results = await processBatch(
      targetContents,
      async (content) => {
        // 根据不同mode处理已有转录的内容
        if (content.transcript && content.hasTranscript) {
          if (mode === 'all') {
            // all 模式：跳过已有转录的内容
            return {
              contentId: content.id,
              status: 'skipped',
              reason: 'already_has_transcript',
            }
          } else if (mode === 'force') {
            // force 模式：强制覆盖已有转录
            return transcribeContent(content.id, merchantId, apiKey)
          }
        }

        // missing 模式和没有转录的内容：正常转录
        return transcribeContent(content.id, merchantId, apiKey)
      },
      concurrent
    )

    // 7. 统计结果
    const detailedResults = results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value
      } else {
        return {
          contentId: targetContents[i].id,
          status: 'failed',
          error: r.reason?.message || '未知错误',
        }
      }
    })

    const summary = {
      total: contentIds.length,
      processed: detailedResults.filter((r) => r.status === 'success').length,
      skipped:
        contentIds.length -
        targetContents.length +
        detailedResults.filter((r) => r.status === 'skipped').length,
      failed: detailedResults.filter((r) => r.status === 'failed').length,
    }

    return success({
      summary,
      results: detailedResults,
    })
  } catch (error: any) {
    console.error('批量转录失败:', error)
    return serverError('批量转录失败', {
      message: error.message,
    })
  }
}

export const dynamic = 'force-dynamic'
