/**
 * 抖音视频文案提取 API (GPT-4o Audio Preview)
 *
 * 流程:
 * 1. 下载视频
 * 2. 提取音频
 * 3. 使用 GPT-4o Audio Preview 转录
 * 4. 使用LLM优化文案
 */

import { NextRequest } from 'next/server';
import { VideoProcessor } from '@/lib/video/video-processor';
import { parseDouyinVideoShare } from '@/lib/douyin/share-link';
import { DOUYIN_DEFAULT_HEADERS } from '@/lib/douyin/constants';
import { getTikHubClient } from '@/lib/tikhub';
import type { DouyinVideo } from '@/lib/tikhub/types';

export async function POST(req: NextRequest) {
  try {
    const { shareLink } = await req.json();

    if (!shareLink) {
      return new Response(
        JSON.stringify({ error: '缺少分享链接参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY;
    if (!apiKey) {
      throw new Error('未配置DOUBAO_ASR_API_KEY或LLM_API_KEY环境变量');
    }

    // 创建SSE流
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (type: string, data: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`)
          );
        };

        try {
          // 1. 解析抖音链接
          sendEvent('progress', { stage: 'parsing', message: '正在解析抖音链接...' });

          const tikhubClient = getTikHubClient();
          const shareResult = await parseDouyinVideoShare(shareLink);

          if (!shareResult.videoId) {
            throw new Error('无法从链接中提取视频ID');
          }

          sendEvent('info', {
            stage: 'parsed',
            message: '短链解析成功',
            videoInfo: { videoId: shareResult.videoId },
          });

          // 2. 获取视频详情
          sendEvent('progress', { stage: 'analyzing', message: '正在获取视频详情...' });

          const videoDetail = await tikhubClient.getVideoDetail({
            aweme_id: shareResult.videoId,
          });

          const awemeDetail = videoDetail?.aweme_detail;
          if (!awemeDetail) {
            throw new Error('TikHub未返回视频详情数据');
          }

          const videoUrl = resolvePlayableVideoUrl(awemeDetail);
          if (!videoUrl) {
            throw new Error('未能获取可用的视频播放地址');
          }

          const videoDuration = normalizeDurationSeconds(awemeDetail.video?.duration) || 0;

          sendEvent('info', {
            stage: 'analyzed',
            message: '视频信息获取成功',
            duration: videoDuration ? videoDuration.toFixed(1) + '秒' : '未知',
            videoInfo: {
              title: awemeDetail.desc || '未知标题',
              author: awemeDetail.author?.nickname || '未知作者',
            },
          });

          // 3. 下载视频
          sendEvent('progress', { stage: 'downloading', message: '正在下载视频...', percent: 20 });

          const requestHeaders: Record<string, string> = {
            ...DOUYIN_DEFAULT_HEADERS,
          };

          // 先获取视频大小
          const videoInfo = await VideoProcessor.getVideoInfo(videoUrl, {
            headers: requestHeaders,
          });

          let lastDownloadPercent = -1;
          const downloadResult = await VideoProcessor.downloadVideo(videoUrl, videoInfo, {
            headers: requestHeaders,
            signal: req.signal,
            onProgress: async (downloaded, total) => {
              if (!total) return;
              const percent = Math.floor((downloaded / total) * 100);
              if (percent === lastDownloadPercent) return;
              lastDownloadPercent = percent;
              const mappedPercent = Math.min(40, Math.max(20, 20 + Math.floor((percent / 100) * 20)));
              sendEvent('progress', {
                stage: 'downloading',
                message: `下载进度 ${percent}%`,
                percent: mappedPercent,
              });
            },
          });
          const videoBuffer = downloadResult.buffer;

          sendEvent('info', {
            stage: 'downloaded',
            message:
              downloadResult.strategy === 'chunked' ? '视频分段下载完成' : '视频下载完成',
            size: (videoBuffer.length / (1024 * 1024)).toFixed(2) + ' MB',
          });

          // 4. 提取音频
          sendEvent('progress', { stage: 'extracting', message: '正在提取音频...', percent: 40 });

          const audioBuffer = await VideoProcessor.extractAudio(videoBuffer, {
            format: 'mp3',
            sampleRate: 16000,
            channels: 1,
            bitrate: '128k',
          });

          sendEvent('info', {
            stage: 'extracted',
            message: '音频提取完成',
            size: (audioBuffer.length / (1024 * 1024)).toFixed(2) + ' MB',
          });

          // 5. 使用 GPT-4o Audio Preview 转录
          sendEvent('progress', { stage: 'transcribing', message: '正在转录语音...', percent: 60 });

          const base64Audio = audioBuffer.toString('base64');

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
          });

          if (!asrResponse.ok) {
            const errorText = await asrResponse.text();
            throw new Error(`GPT-4o转录失败: ${asrResponse.status} - ${errorText}`);
          }

          const asrResult = await asrResponse.json();
          const transcribedText = asrResult.choices?.[0]?.message?.content || '';

          if (!transcribedText) {
            throw new Error('转录失败,未返回文本');
          }

          sendEvent('info', {
            stage: 'transcribed',
            message: '语音转录完成',
            textLength: transcribedText.length,
          });

          // 6. 使用LLM优化文案
          sendEvent('progress', { stage: 'optimizing', message: '正在优化文案...', percent: 90 });

          // 提取视频元数据
          const hashtags = awemeDetail.text_extra
            ?.filter((item: any) => item.hashtag_name)
            .map((item: any) => item.hashtag_name) || []

          const videoTags = awemeDetail.video_tag
            ?.map((tag: any) => tag.tag_name)
            .filter(Boolean) || []

          const optimizedText = await optimizeTextWithLLM(transcribedText, apiKey, {
            title: awemeDetail.desc || '未知标题',
            author: awemeDetail.author?.nickname || '未知作者',
            hashtags,
            videoTags
          });

          // 7. 返回最终结果
          sendEvent('done', {
            text: optimizedText || transcribedText,
            originalText: transcribedText,
            videoInfo: {
              title: awemeDetail.desc || '未知标题',
              author: awemeDetail.author?.nickname || '未知作者',
              duration: videoDuration,
              videoId: shareResult.videoId,
            },
            stats: {
              totalCharacters: transcribedText.length,
            },
          });

          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';

          console.error('处理失败:', {
            message: errorMessage,
            error,
          });

          sendEvent('error', {
            message: errorMessage,
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API错误:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '未知错误',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function resolvePlayableVideoUrl(video: DouyinVideo): string | null {
  const videoData: any = video.video || video;
  if (!videoData) return null;

  const candidates: Array<string | undefined> = [];

  if (Array.isArray(videoData.play_addr?.url_list)) {
    candidates.push(...videoData.play_addr.url_list);
  }

  if (Array.isArray(videoData.bit_rate)) {
    for (const item of videoData.bit_rate) {
      if (Array.isArray(item?.play_addr?.url_list)) {
        candidates.push(...item.play_addr.url_list);
      }
    }
  }

  if (Array.isArray(videoData.download_addr?.url_list)) {
    candidates.push(...videoData.download_addr.url_list);
  }

  const sanitized = candidates
    .map((url) => (url?.includes('playwm') ? url.replace('playwm', 'play') : url))
    .filter((url): url is string => Boolean(url));

  return sanitized.find((url) => url.includes('aweme')) || sanitized[0] || null;
}

function normalizeDurationSeconds(duration?: number | null): number {
  if (!duration || Number.isNaN(duration)) return 0;
  return duration >= 1000 ? duration / 1000 : duration;
}

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
    // 构建视频上下文信息
    const contextParts = [
      `视频标题：${videoInfo.title}`,
      `作者：${videoInfo.author}`
    ]

    if (videoInfo.hashtags && videoInfo.hashtags.length > 0) {
      contextParts.push(`话题标签：${videoInfo.hashtags.join('、')}`)
    }

    if (videoInfo.videoTags && videoInfo.videoTags.length > 0) {
      contextParts.push(`视频标签：${videoInfo.videoTags.join('、')}`)
    }

    const contextInfo = contextParts.join('\n')

    const response = await fetch('https://api.302.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
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
            content: `【示例1：地名和人名纠错】
视频信息：
标题：君姐在南宁做旧房改造
作者：君姐改旧房

转录文本：
"金姐在南京做了15年旧房改造..."

正确修正：
"君姐在南宁做了15年旧房改造..."

---

【示例2：专业术语纠错】
视频信息：
标题：iPhone 15 Pro Max 开箱
话题标签：#苹果手机 #iPhone15ProMax

转录文本：
"今天给大家开箱爱疯15 Pro Max..."

正确修正：
"今天给大家开箱iPhone 15 Pro Max..."

---

现在请你修正以下视频的转录文本：`,
          },
          {
            role: 'user',
            content: `${contextInfo}

---

**转录文本：**
${text}

---

**修正要求：**
1. 检查转录文本中是否有与标题、作者、标签发音相同但写法不同的词语，如有则修正为标题/标签中的写法
2. 特别注意地名、人名、品牌名的正确性
3. 添加标点符号，使文本更易读
4. 直接返回修正后的文本，不要任何解释`,
          },
        ],
        max_tokens: 4000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error('LLM优化失败:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('LLM优化出错:', error);
    return null;
  }
}
