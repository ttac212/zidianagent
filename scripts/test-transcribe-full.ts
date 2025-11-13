/**
 * 完整的抖音视频转录测试
 *
 * 执行完整的转录流程并显示结果
 */

import { parseDouyinVideoShare } from '@/lib/douyin/share-link';
import { getTikHubClient } from '@/lib/tikhub';
import { VideoProcessor } from '@/lib/video/video-processor';
import { DOUYIN_DEFAULT_HEADERS } from '@/lib/douyin/constants';

const testLink = `6.64 ygo:/ 08/06 U@L.JV 成都一站式装修建材超市 正在筹备中 敬请期待# 装修材料 # 工程材料 # 批发 # 一站式采购 # 集采  https://v.douyin.com/dn2WTcNpnRA/ 复制此链接，打开Dou音搜索，直接观看视频！  文案`;

async function testFullTranscription() {
  console.log('🎬 开始完整转录测试...\n');
  console.log('测试链接:', testLink);
  console.log('\n' + '='.repeat(80) + '\n');

  try {
    // 检查API Key
    const apiKey = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY;
    if (!apiKey) {
      console.error('❌ 错误: 未配置 DOUBAO_ASR_API_KEY 或 LLM_API_KEY');
      console.log('\n请在 .env.local 中配置以下变量之一:');
      console.log('  DOUBAO_ASR_API_KEY=your-api-key');
      console.log('  或');
      console.log('  LLM_API_KEY=your-api-key');
      return;
    }

    // 步骤1: 解析链接
    console.log('📋 步骤1: 解析抖音链接...');
    const shareResult = await parseDouyinVideoShare(testLink);

    if (!shareResult.videoId) {
      throw new Error('无法从链接中提取视频ID');
    }

    console.log('✅ 链接解析成功');
    console.log(`  视频ID: ${shareResult.videoId}`);

    // 步骤2: 获取视频详情
    console.log('\n📋 步骤2: 获取视频详情...');
    const tikhubClient = getTikHubClient();
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

    console.log('✅ 视频信息获取成功');
    console.log(`  标题: ${awemeDetail.desc || '未知标题'}`);
    console.log(`  作者: ${awemeDetail.author?.nickname || '未知作者'}`);
    console.log(`  时长: ${videoDuration.toFixed(1)}秒`);

    // 步骤3: 下载视频
    console.log('\n📋 步骤3: 下载视频...');
    const requestHeaders: Record<string, string> = {
      ...DOUYIN_DEFAULT_HEADERS,
    };

    const videoInfo = await VideoProcessor.getVideoInfo(videoUrl, {
      headers: requestHeaders,
    });

    console.log(`  视频大小: ${(videoInfo.size / 1024 / 1024).toFixed(2)} MB`);

    const downloadResult = await VideoProcessor.downloadVideo(videoUrl, videoInfo, {
      headers: requestHeaders,
      onProgress: async (downloaded, total) => {
        if (!total) return;
        const percent = Math.floor((downloaded / total) * 100);
        process.stdout.write(`\r  下载进度: ${percent}%`);
      },
    });
    const videoBuffer = downloadResult.buffer;

    console.log('\n✅ 视频下载完成');
    console.log(`  实际大小: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // 步骤4: 提取音频
    console.log('\n📋 步骤4: 提取音频...');
    const audioBuffer = await VideoProcessor.extractAudio(videoBuffer, {
      format: 'mp3',
      sampleRate: 16000,
      channels: 1,
      bitrate: '128k',
    });

    console.log('✅ 音频提取完成');
    console.log(`  音频大小: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // 步骤5: 使用 GPT-4o Audio Preview 转录
    console.log('\n📋 步骤5: 正在转录语音...');
    console.log('  (这可能需要一段时间,请耐心等待...)');

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

    console.log('✅ 语音转录完成');
    console.log(`  文本长度: ${transcribedText.length} 字符`);

    // 步骤6: 使用LLM优化文案
    console.log('\n📋 步骤6: 优化文案...');

    const hashtags = awemeDetail.text_extra
      ?.filter((item: any) => item.hashtag_name)
      .map((item: any) => item.hashtag_name) || [];

    const videoTags = awemeDetail.video_tag
      ?.map((tag: any) => tag.tag_name)
      .filter(Boolean) || [];

    const optimizedText = await optimizeTextWithLLM(transcribedText, apiKey, {
      title: awemeDetail.desc || '未知标题',
      author: awemeDetail.author?.nickname || '未知作者',
      hashtags,
      videoTags,
    });

    if (optimizedText) {
      console.log('✅ 文案优化完成');
    } else {
      console.log('⚠️  文案优化失败,将使用原始转录文本');
    }

    // 显示最终结果
    console.log('\n' + '='.repeat(80));
    console.log('📝 转录结果');
    console.log('='.repeat(80));
    console.log('\n【原始转录】\n');
    console.log(transcribedText);

    if (optimizedText && optimizedText !== transcribedText) {
      console.log('\n' + '-'.repeat(80));
      console.log('\n【优化后文案】\n');
      console.log(optimizedText);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ 测试完成!');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error('错误信息:', error.message);
    }
  }
}

function resolvePlayableVideoUrl(video: any): string | null {
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
    title: string;
    author: string;
    hashtags?: string[];
    videoTags?: string[];
  }
): Promise<string | null> {
  try {
    const apiBase = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1';
    const optimizationModel = process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5';
    const zenmuxApiKey = process.env.ZENMUX_API_KEY || apiKey;

    const contextParts = [
      `视频标题：${videoInfo.title}`,
      `作者：${videoInfo.author}`,
    ];

    if (videoInfo.hashtags && videoInfo.hashtags.length > 0) {
      contextParts.push(`话题标签：${videoInfo.hashtags.join('、')}`);
    }

    if (videoInfo.videoTags && videoInfo.videoTags.length > 0) {
      contextParts.push(`视频标签：${videoInfo.videoTags.join('、')}`);
    }

    const contextInfo = contextParts.join('\n');

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zenmuxApiKey}`,
      },
      body: JSON.stringify({
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

// 运行测试
testFullTranscription().catch(console.error);
