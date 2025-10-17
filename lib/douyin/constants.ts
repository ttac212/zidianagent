export const DOUYIN_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const DOUYIN_DEFAULT_HEADERS = {
  'User-Agent': DOUYIN_USER_AGENT,
  Referer: 'https://www.douyin.com/',
  Accept: '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
} as const;
