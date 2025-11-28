/**
 * 抖音视频文案提取 API (GPT-4o Audio Preview)
 *
 * 简化流程（仅音频直链方案）:
 * 1. 解析分享链接并获取视频信息
 * 2. 下载音频直链
 * 3. 使用 GPT-4o Audio Preview 转录
 * 4. 使用LLM优化文案
 */

import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createVideoSourceFromShareLink } from '@/lib/douyin/video-source';
import { mapStageProgress } from '@/lib/douyin/progress-mapper';
import { DOUYIN_DEFAULT_HEADERS, DOUYIN_PIPELINE_LIMITS } from '@/lib/douyin/constants';
import { buildLLMRequestAuto } from '@/lib/ai/request-builder';

export async function POST(req: NextRequest) {
  try {
    // 验证用户认证 - 支持两种方式：
    // 1. 正常的用户 session token
    // 2. 内部服务调用（通过 X-Internal-Key header）
    const token = await getToken({ req });
    const internalKey = req.headers.get('X-Internal-Key');
    const expectedInternalKey = process.env.INTERNAL_API_KEY || process.env.NEXTAUTH_SECRET;

    const isAuthorized = token?.sub || (internalKey && internalKey === expectedInternalKey);

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: '未授权访问' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

        const sendEvent = (type: string, data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`)
          );
        };

        try {
          // 1. 解析分享链接并获取视频信息
          sendEvent('progress', {
            stage: 'parsing',
            message: '正在解析抖音链接...',
            percent: 0,
          });

          const videoSource = await createVideoSourceFromShareLink(shareLink);

          sendEvent('info', {
            stage: 'analyzed',
            message: '视频信息获取成功',
            duration: videoSource.duration ? videoSource.duration.toFixed(1) + '秒' : '未知',
            videoInfo: {
              title: videoSource.title,
              author: videoSource.author,
            },
          });

          // 2. 检查音频直链
          if (!videoSource.audioUrl) {
            throw new Error('未找到音频直链，该视频可能不包含背景音乐或音频不可用');
          }

          // 3. 下载音频
          sendEvent('progress', {
            stage: 'downloading',
            message: '正在下载音频...',
            percent: mapStageProgress('downloading', 10),
          });

          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), DOUYIN_PIPELINE_LIMITS.DOWNLOAD_TIMEOUT_MS);
          const abortHandler = () => abortController.abort();
          req.signal.addEventListener('abort', abortHandler);

          let audioBuffer: Buffer;
          try {
            const audioResponse = await fetch(videoSource.audioUrl, {
              headers: DOUYIN_DEFAULT_HEADERS,
              signal: abortController.signal,
            });

            if (!audioResponse.ok) {
              throw new Error(`音频下载失败: HTTP ${audioResponse.status}`);
            }

            audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

            sendEvent('info', {
              stage: 'downloaded',
              message: '音频下载完成',
              size: (audioBuffer.length / 1024).toFixed(0) + ' KB',
            });

            console.info(`[文案提取] 音频下载成功: ${(audioBuffer.length / 1024).toFixed(0)} KB`);
          } finally {
            clearTimeout(timeoutId);
            req.signal.removeEventListener('abort', abortHandler);
          }

          // 4. 使用 GPT-4o Audio Preview 转录
          sendEvent('progress', {
            stage: 'transcribing',
            message: '正在转录语音...',
            percent: mapStageProgress('transcribing', 0),
          });

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
                      text: `请转录这段音频的内容。注意以下要点：

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
                        format: 'mp3',  // 抖音音频直链为MP3格式
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

          // 5. 使用LLM优化文案
          sendEvent('progress', {
            stage: 'optimizing',
            message: '正在优化文案...',
            percent: mapStageProgress('optimizing', 0),
          });

          const optimizedText = await optimizeTextWithLLM(transcribedText, apiKey, {
            title: videoSource.title,
            author: videoSource.author,
            hashtags: videoSource.hashtags,
            videoTags: videoSource.videoTags,
          });

          // 6. 返回最终结果
          sendEvent('done', {
            text: optimizedText || transcribedText,
            originalText: transcribedText,
            videoInfo: {
              title: videoSource.title,
              author: videoSource.author,
              duration: videoSource.duration,
              videoId: videoSource.videoId,
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
      maxTokens: 4000,
      temperature: 0.2,
    });

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zenmuxApiKey}`,
      },
      body: JSON.stringify(requestBody),
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
