import { DOUYIN_DEFAULT_HEADERS } from '@/lib/douyin/constants';

const VIDEO_ID_RE = /\/(?:video|note|slides)\/(\d{19})/;
const USER_ID_RE = /\/user\/([A-Za-z0-9_-]+)/;
const LIVE_REDIRECT_RE = /\/douyin\/webcast\/reflow\//;

export interface ShareLinkParseResult {
  originalUrl: string;
  resolvedUrl: string;
  videoId?: string;
  userId?: string;
  secUserId?: string;
}

/**
 * 解析抖音作品分享文案，返回作品ID及相关信息
 *
 * 注意: 只支持包含 v.douyin.com URL 的分享链接
 * 纯短代码格式(如"2.84 dan:/ 12/24...")无法解析,因为短代码需要在抖音APP内打开
 */
export async function parseDouyinVideoShare(
  text: string
): Promise<ShareLinkParseResult> {
  const firstUrl = extractFirstUrl(text);
  const resolvedUrl = await resolveRedirect(firstUrl);
  const ids = extractIdsFromUrl(resolvedUrl);

  return {
    originalUrl: firstUrl,
    resolvedUrl,
    ...ids,
  };
}

/**
 * 解析抖音账号分享文案，返回账号ID等信息
 * 如果直接跳转到作品，会尝试回查作者sec_uid
 */
export async function parseDouyinUserShare(
  text: string
): Promise<ShareLinkParseResult> {
  const firstUrl = extractFirstUrl(text);
  const resolvedUrl = await resolveRedirect(firstUrl);
  const ids = extractIdsFromUrl(resolvedUrl);

  if (!ids.userId && ids.videoId) {
    const secUid = await fetchAuthorSecUid(resolvedUrl);
    if (secUid) {
      ids.secUserId = secUid;
    }
  }

  return {
    originalUrl: firstUrl,
    resolvedUrl,
    ...ids,
  };
}

function extractFirstUrl(text: string): string {
  // 优先匹配 v.douyin.com 链接 (支持字母、数字、下划线)
  const urlMatch = text.match(/https?:\/\/v\.douyin\.com\/[A-Za-z0-9_]+/);
  if (urlMatch) {
    return urlMatch[0].replace(/[)"\u3002\uff01\uff1f\uff0c\uff1b\uff1a\uff09]+$/, '');
  }

  // 尝试匹配其他抖音域名链接
  const anyDouyinUrlMatch = text.match(/https?:\/\/[^\s]*douyin[^\s]*/);
  if (anyDouyinUrlMatch) {
    return anyDouyinUrlMatch[0].replace(/[)"\u3002\uff01\uff1f\uff0c\uff1b\uff1a\uff09]+$/, '');
  }

  throw new Error(
    '文本中未找到有效的抖音链接。\n\n' +
      '提示: 纯短代码格式(如"2.84 dan:/ 12/24...")无法解析,因为短代码需要在抖音APP内打开。\n' +
      '请使用包含 v.douyin.com URL 的完整分享链接。\n\n' +
      '如何获取可用的链接:\n' +
      '1. 在抖音APP中打开视频\n' +
      '2. 点击"分享"按钮\n' +
      '3. 选择"复制链接"(不是"复制文案")\n' +
      '4. 粘贴包含 https://v.douyin.com/xxx 的完整文本'
  );
}

async function resolveRedirect(url: string): Promise<string> {
  const headers = { ...DOUYIN_DEFAULT_HEADERS };

  const headResponse = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    headers,
  });

  if (headResponse.ok) {
    return headResponse.url;
  }

  // 某些情况下服务端不允许HEAD，降级为GET
  const getResponse = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers,
  });

  if (!getResponse.ok) {
    throw new Error(`短链重定向失败: ${getResponse.status}`);
  }

  // 读取并丢弃body，避免资源未释放
  await getResponse.arrayBuffer();

  return getResponse.url;
}

function extractIdsFromUrl(
  url: string
): Omit<ShareLinkParseResult, 'originalUrl' | 'resolvedUrl'> {
  const parsed = new URL(url);
  const query = parsed.searchParams;

  const result: Omit<ShareLinkParseResult, 'originalUrl' | 'resolvedUrl'> = {};

  const videoMatch = VIDEO_ID_RE.exec(parsed.pathname);
  if (videoMatch) {
    result.videoId = videoMatch[1];
  } else {
    const modalId = query.get('modal_id');
    if (modalId) {
      result.videoId = modalId;
    }
  }

  const userMatch = USER_ID_RE.exec(parsed.pathname);
  if (userMatch) {
    result.userId = userMatch[1];
  } else {
    const accountId = query.get('account_id');
    if (accountId) {
      result.userId = accountId;
    }
  }

  if (LIVE_REDIRECT_RE.test(parsed.pathname) || query.has('sec_user_id')) {
    const secId = query.get('sec_user_id');
    if (secId) {
      result.secUserId = secId;
    }
  }

  return result;
}

async function fetchAuthorSecUid(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, {
      headers: { ...DOUYIN_DEFAULT_HEADERS },
    });

    if (!response.ok) {
      return undefined;
    }

    const html = await response.text();
    const match = html.match(/"secUid":"([A-Za-z0-9_-]+)"/);
    return match ? match[1] : undefined;
  } catch (error) {
    console.warn('抓取作者secUid失败:', error);
    return undefined;
  }
}
