/**
 * 抖音链接检测和处理工具
 *
 * 支持的链接格式:
 * - 短链接: https://v.douyin.com/xxx
 * - 作品链接: https://www.douyin.com/video/[19位ID]
 * - 图文链接: https://www.douyin.com/note/[19位ID]
 * - 图集链接: https://www.douyin.com/slides/[19位ID]
 * - 账号主页: https://www.douyin.com/user/[用户ID]
 * - 分享链接: https://www.iesdouyin.com/share/video/[19位ID]
 *
 * 域名定义：
 * - 所有域名定义来自 @/lib/douyin/domains
 * - 新增域名时，请同时更新 domains.ts 和本文件的 PATTERNS
 */

import { processSSEStream } from '@/lib/utils/sse-parser'
import { ALLOWED_DOUYIN_DOMAINS } from '@/lib/douyin/domains'


/**
 * 抖音链接类型
 */
export type DouyinLinkType =
  | 'short_link'      // v.douyin.com 短链接
  | 'video'           // 视频作品
  | 'note'            // 图文作品
  | 'slides'          // 图集作品
  | 'user'            // 用户主页
  | 'share'           // 分享链接
  | 'unknown';        // 未知类型

/**
 * 链接提取结果
 */
export interface DouyinLinkInfo {
  url: string;                    // 原始URL
  type: DouyinLinkType;           // 链接类型
  id?: string;                    // 作品ID或用户ID
  needsRedirect: boolean;         // 是否需要重定向解析
}

/**
 * 正则表达式模式集合
 */
const PATTERNS = {
  // 短链接: https://v.douyin.com/k5Nc3QsEQH8 (支持字母、数字、下划线、连字符)
  shortLink: /https?:\/\/v\.douyin\.com\/[A-Za-z0-9_-]+/i,

  // 作品链接: https://www.douyin.com/video/7445678901234567890
  videoLink: /https?:\/\/www\.douyin\.com\/video\/(\d{19})/i,

  // 图文链接: https://www.douyin.com/note/7445678901234567890
  noteLink: /https?:\/\/www\.douyin\.com\/note\/(\d{19})/i,

  // 图集链接: https://www.douyin.com/slides/7445678901234567890
  slidesLink: /https?:\/\/www\.douyin\.com\/slides\/(\d{19})/i,

  // 账号主页: https://www.douyin.com/user/MS4wLjABAAAA...
  // 可能包含 modal_id 参数显示特定作品
  userLink: /https?:\/\/www\.douyin\.com\/user\/([A-Za-z0-9_-]+)(?:\S*?\bmodal_id=(\d{19}))?/i,

  // 分享链接: https://www.iesdouyin.com/share/video/7445678901234567890
  shareLink: /https?:\/\/www\.iesdouyin\.com\/share\/(?:video|note|slides)\/(\d{19})/i,

  // 搜索结果作品: https://www.douyin.com/search/...?modal_id=7445678901234567890
  searchLink: /https?:\/\/www\.douyin\.com\/search\/\S+?modal_id=(\d{19})/i,

  // 首页推荐作品: https://www.douyin.com/discover?modal_id=7445678901234567890
  discoverLink: /https?:\/\/www\.douyin\.com\/discover\S*?modal_id=(\d{19})/i,

  // 纯19位作品ID
  videoId: /\b(\d{19})\b/,
};

/**
 * 开发时验证：确保 PATTERNS 中的域名与 ALLOWED_DOUYIN_DOMAINS 保持一致
 * 这个检查在开发环境运行，帮助及早发现不一致
 */
if (process.env.NODE_ENV === 'development') {
  const patternDomains = new Set<string>();

  // 从所有正则中提取域名
  Object.values(PATTERNS).forEach(pattern => {
    const match = pattern.source.match(/(?:https?:\\\/\\\/)([\w.-]+)/);
    if (match && match[1]) {
      // 反转义域名中的点号
      const domain = match[1].replace(/\\\./g, '.');
      patternDomains.add(domain);
    }
  });

  // 检查是否所有提取的域名都在允许列表中
  for (const domain of patternDomains) {
    if (!ALLOWED_DOUYIN_DOMAINS.includes(domain as any)) {
      console.warn(
        `[link-detector] 警告: PATTERNS中的域名 "${domain}" 不在 ALLOWED_DOUYIN_DOMAINS 中。\n` +
        `请更新 lib/douyin/domains.ts 或修改本文件的正则表达式。`
      );
    }
  }
}

/**
 * 检测文本中是否包含任何抖音链接
 */
export function detectDouyinLink(text: string): boolean {
  return Object.values(PATTERNS).some(pattern => pattern.test(text));
}

/**
 * 从文本中提取第一个抖音链接URL
 * @returns URL字符串或null
 */
export function extractDouyinLink(text: string): string | null {
  // 按优先级尝试匹配各种格式
  const patterns = [
    PATTERNS.shortLink,
    PATTERNS.videoLink,
    PATTERNS.noteLink,
    PATTERNS.slidesLink,
    PATTERNS.userLink,
    PATTERNS.shareLink,
    PATTERNS.searchLink,
    PATTERNS.discoverLink,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

/**
 * 提取链接的详细信息
 */
export function extractDouyinLinkInfo(text: string): DouyinLinkInfo | null {
  // 1. 短链接
  const shortLinkMatch = text.match(PATTERNS.shortLink);
  if (shortLinkMatch) {
    return {
      url: shortLinkMatch[0],
      type: 'short_link',
      needsRedirect: true,
    };
  }

  // 2. 视频作品链接
  const videoMatch = text.match(PATTERNS.videoLink);
  if (videoMatch) {
    return {
      url: videoMatch[0],
      type: 'video',
      id: videoMatch[1],
      needsRedirect: false,
    };
  }

  // 3. 图文作品链接
  const noteMatch = text.match(PATTERNS.noteLink);
  if (noteMatch) {
    return {
      url: noteMatch[0],
      type: 'note',
      id: noteMatch[1],
      needsRedirect: false,
    };
  }

  // 4. 图集作品链接
  const slidesMatch = text.match(PATTERNS.slidesLink);
  if (slidesMatch) {
    return {
      url: slidesMatch[0],
      type: 'slides',
      id: slidesMatch[1],
      needsRedirect: false,
    };
  }

  // 5. 用户主页链接
  const userMatch = text.match(PATTERNS.userLink);
  if (userMatch) {
    return {
      url: userMatch[0],
      type: 'user',
      id: userMatch[2] || userMatch[1], // 优先返回modal_id(作品ID),否则返回用户ID
      needsRedirect: false,
    };
  }

  // 6. 分享链接
  const shareMatch = text.match(PATTERNS.shareLink);
  if (shareMatch) {
    return {
      url: shareMatch[0],
      type: 'share',
      id: shareMatch[1],
      needsRedirect: false,
    };
  }

  // 7. 搜索结果链接
  const searchMatch = text.match(PATTERNS.searchLink);
  if (searchMatch) {
    return {
      url: searchMatch[0],
      type: 'video',
      id: searchMatch[1],
      needsRedirect: false,
    };
  }

  // 8. 首页推荐链接
  const discoverMatch = text.match(PATTERNS.discoverLink);
  if (discoverMatch) {
    return {
      url: discoverMatch[0],
      type: 'video',
      id: discoverMatch[1],
      needsRedirect: false,
    };
  }

  return null;
}

/**
 * 从URL中提取作品ID(19位数字)
 */
export function extractVideoId(url: string): string | null {
  const linkInfo = extractDouyinLinkInfo(url);

  // 如果是用户主页且没有modal_id,返回null
  if (linkInfo?.type === 'user' && !linkInfo.id?.match(/^\d{19}$/)) {
    return null;
  }

  return linkInfo?.id || null;
}

/**
 * 解析短链接重定向,获取完整URL
 * 使用HEAD请求追踪重定向,不下载完整内容
 *
 * @param shortUrl - v.douyin.com 短链接
 * @returns 重定向后的完整URL,失败返回原URL
 */
export async function resolveShortLink(shortUrl: string): Promise<string> {
  try {
    // 使用HEAD请求,只获取响应头
    const response = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow', // 自动跟随重定向
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    // 返回最终重定向后的URL
    return response.url || shortUrl;
  } catch (error) {
    console.error('Failed to resolve short link:', error);
    return shortUrl; // 失败时返回原URL
  }
}

/**
 * 从文本中提取链接并解析(如果是短链接则自动重定向)
 *
 * @param text - 包含抖音链接的文本
 * @returns 链接信息,如果是短链接则包含重定向后的完整URL
 */
export async function extractAndResolveLink(text: string): Promise<DouyinLinkInfo | null> {
  const linkInfo = extractDouyinLinkInfo(text);

  if (!linkInfo) return null;

  // 如果需要重定向,则解析短链接
  if (linkInfo.needsRedirect) {
    const fullUrl = await resolveShortLink(linkInfo.url);

    // 从重定向后的URL中提取详细信息
    const resolvedInfo = extractDouyinLinkInfo(fullUrl);

    if (resolvedInfo) {
      // 保留原始短链接URL,但使用重定向后的类型和ID
      return {
        ...resolvedInfo,
        url: linkInfo.url, // 保留原始短链接
      };
    }
  }

  return linkInfo;
}

/**
 * 检查文本是否明确请求视频文案提取(需要关键词)
 */
export function isDouyinVideoExtractionRequest(text: string): boolean {
  const trimmed = text.trim();

  // 检查是否包含抖音链接
  const shareLink = extractDouyinLink(trimmed);
  if (!shareLink) return false;

  // 视频文案提取关键词
  const extractionKeywords = [
    '提取',
    '文案',
    '转录',
    '字幕',
    '音频',
    '视频内容',
    '说了什么',
    '讲的什么'
  ];

  // 检查是否包含提取关键词
  return extractionKeywords.some((keyword) => trimmed.includes(keyword));
}

/**
 * 检查文本是否主要是抖音分享请求(默认评论分析)
 */
export function isDouyinShareRequest(text: string): boolean {
  const trimmed = text.trim();

  // 检查是否包含抖音链接
  const shareLink = extractDouyinLink(trimmed);
  if (!shareLink) return false;

  // 如果明确请求视频提取,不走评论分析
  if (isDouyinVideoExtractionRequest(text)) {
    return false;
  }

  // 去掉链接后的剩余文本
  const withoutLink = trimmed.replace(shareLink, '').trim();

  // 对话意图的特征词(如果包含这些,说明用户想讨论而不是提取)
  const conversationIndicators = [
    '你怎么看',
    '你觉得',
    '对吗',
    '是不是',
    '为什么',
    '怎么样',
    '我觉得',
    '我认为',
    '?', // 问号通常表示对话意图
  ];

  // 如果包含对话意图,不认为是纯分享请求
  if (conversationIndicators.some((indicator) => withoutLink.includes(indicator))) {
    return false;
  }

  // 抖音官方分享文本的特征词
  const shareIndicators = [
    '复制此链接',
    '打开Dou音',
    '打开抖音',
    '直接观看视频',
    '复制此内容',
    '长按复制',
  ];

  // 用户请求处理视频的关键词(去掉这些,因为默认是评论分析)
  // const requestKeywords = ['帮我', '提取', '分析', '转录', '文案'];

  // 1. 如果包含抖音官方分享文案特征,肯定是分享请求(默认评论分析)
  if (shareIndicators.some((indicator) => trimmed.includes(indicator))) {
    return true;
  }

  // 2. 如果去掉链接后剩余文本很少,认为是纯链接分享(默认评论分析)
  if (withoutLink.length < 50) {
    return true;
  }

  // 3. 如果链接占文本的比例很大(说明主要内容是链接)
  const linkRatio = shareLink.length / trimmed.length;
  if (linkRatio > 0.3) {
    return true;
  }

  // 4. 否则,认为不是纯粹的分享请求
  return false;
}

/**
 * 生成抖音视频处理提示
 */
export function generateDouyinProcessingPrompt(
  videoInfo: {
    title: string;
    author: string;
    duration: number;
    videoId: string;
  },
  transcribedText: string,
  originalUserMessage: string
): string {
  return `用户发送了一个抖音视频分享链接。我已经为你提取了视频信息和转录文案:

**视频信息:**
- 标题: ${videoInfo.title}
- 作者: ${videoInfo.author}
- 时长: ${videoInfo.duration.toFixed(1)}秒
- 视频ID: ${videoInfo.videoId}

**转录文案:**
${transcribedText}

---

用户的原始消息: "${originalUserMessage}"

请根据视频信息和转录文案,为用户提供有价值的分析或回答用户的问题。`;
}

/**
 * 调用抖音文案提取API
 */
export async function processDouyinVideo(shareLink: string): Promise<{
  success: boolean;
  data?: {
    text: string;
    originalText: string;
    videoInfo: {
      title: string;
      author: string;
      duration: number;
      videoId: string;
    };
    stats: {
      totalCharacters: number;
    };
  };
  error?: string;
}> {
  try {
    const response = await fetch('/api/douyin/extract-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shareLink }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API调用失败: ${response.status}`,
      };
    }

    // 读取SSE流
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        success: false,
        error: '响应体为空',
      };
    }

    let result: any = null;

    // 使用统一的 SSE 解析器 (支持 ZenMux 和标准格式)
    await processSSEStream(reader, {
      onMessage: (message) => {
        // 查找 type === 'done' 的事件
        if (message.payload && typeof message.payload === 'object') {
          const payload = message.payload as Record<string, any>
          if (payload.type === 'done') {
            result = payload
          }
        }
      },
      onError: (error) => {
        console.error('[链接检测] SSE错误:', error)
      }
    })

    if (!result) {
      return {
        success: false,
        error: '未收到完整响应',
      };
    }

    return {
      success: true,
      data: {
        text: result.text,
        originalText: result.originalText,
        videoInfo: result.videoInfo,
        stats: result.stats,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}
