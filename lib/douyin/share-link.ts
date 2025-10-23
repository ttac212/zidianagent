import { DOUYIN_DEFAULT_HEADERS } from '@/lib/douyin/constants';

const VIDEO_ID_RE = /\/(?:video|note|slides)\/(\d{19})/;
const USER_ID_RE = /\/user\/([A-Za-z0-9_-]+)/;
const LIVE_REDIRECT_RE = /\/douyin\/webcast\/reflow\//;

/**
 * 抖音官方域名白名单
 * 严格限制只允许抖音官方域名，防止SSRF攻击
 */
const ALLOWED_DOUYIN_DOMAINS = new Set([
  'v.douyin.com',          // 短链接域名
  'www.douyin.com',        // 主站域名
  'douyin.com',            // 顶级域名
  'm.douyin.com',          // 移动端域名
  'www.iesdouyin.com',     // 视频服务域名（重定向目标）
]);

/**
 * 验证URL是否属于抖音官方域名
 * @throws Error 如果域名不在白名单中
 */
function validateDouyinDomain(url: string, context: string): void {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`${context}: URL格式无效`);
  }

  if (!ALLOWED_DOUYIN_DOMAINS.has(hostname)) {
    throw new Error(
      `${context}: 不允许的域名 "${hostname}"。\n` +
      `出于安全考虑，仅支持抖音官方域名: ${Array.from(ALLOWED_DOUYIN_DOMAINS).join(', ')}`
    );
  }
}

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
  // 安全检查：验证初始URL域名
  validateDouyinDomain(firstUrl, '初始链接校验');

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
 *
 * 处理策略：
 * - 优先使用从URL提取的secUserId
 * - 如果只有userId或videoId，尝试抓取页面获取secUserId
 * - 确保同步路径稳定，不直接把userId当作sec_uid使用
 */
export async function parseDouyinUserShare(
  text: string
): Promise<ShareLinkParseResult> {
  const firstUrl = extractFirstUrl(text);
  // 安全检查：验证初始URL域名
  validateDouyinDomain(firstUrl, '初始链接校验');

  const resolvedUrl = await resolveRedirect(firstUrl);
  const ids = extractIdsFromUrl(resolvedUrl);

  // 如果没有直接获取到secUserId，尝试从页面抓取
  // 这确保了无论是用户主页链接还是视频链接，都能获取到正确的secUserId
  if (!ids.secUserId) {
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
  // 优先匹配 v.douyin.com 链接 (支持字母、数字、下划线、连字符)
  const urlMatch = text.match(/https?:\/\/v\.douyin\.com\/[A-Za-z0-9_-]+/);
  if (urlMatch) {
    return urlMatch[0].replace(/[)"\u3002\uff01\uff1f\uff0c\uff1b\uff1a\uff09]+$/, '');
  }

  // 尝试匹配其他抖音官方域名链接（仅白名单内的域名）
  // 注意：这里只匹配URL模式，具体域名验证在 validateDouyinDomain 中进行
  const anyUrlMatch = text.match(/https?:\/\/[^\s]+/);
  if (anyUrlMatch) {
    const url = anyUrlMatch[0].replace(/[)"\u3002\uff01\uff1f\uff0c\uff1b\uff1a\uff09]+$/, '');
    // 验证是否为抖音官方域名
    try {
      const hostname = new URL(url).hostname;
      if (ALLOWED_DOUYIN_DOMAINS.has(hostname)) {
        return url;
      }
    } catch {
      // URL格式无效，继续抛出原有错误
    }
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
    // 安全检查：验证重定向后的最终URL域名
    validateDouyinDomain(headResponse.url, '重定向结果校验');
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

  // 安全检查：验证重定向后的最终URL域名
  validateDouyinDomain(getResponse.url, '重定向结果校验');

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
    // 安全检查：验证要抓取的URL域名
    validateDouyinDomain(url, '抓取页面校验');

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
