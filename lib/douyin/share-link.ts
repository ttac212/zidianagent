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
  const match = text.match(/https?:\/\/[^\s]+/);
  if (!match) {
    throw new Error('文本中未找到有效的抖音链接');
  }

  // 去除末尾可能的标点
  return match[0].replace(/[)"\u3002\uff01\uff1f\uff0c\uff1b\uff1a\uff09]+$/, '');
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
