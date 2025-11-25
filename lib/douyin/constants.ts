export const DOUYIN_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const DOUYIN_DEFAULT_HEADERS = {
  'User-Agent': DOUYIN_USER_AGENT,
  Referer: 'https://www.douyin.com/',
  Accept: '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
} as const;

/**
 * Vercel 部署限制配置
 *
 * Vercel Serverless Functions 限制：
 * - 执行时间：免费版10s，Pro版60s，Enterprise可配置
 * - 内存：1024MB（默认），最大3008MB
 * - 请求体大小：4.5MB（Hobby），100MB（Pro）
 * - 响应体大小：4.5MB（Hobby），100MB（Pro）
 *
 * 为安全起见，设置保守的限制：
 * - 视频时长：2分钟（120秒）
 * - 视频文件大小：50MB
 * - 音频文件大小：10MB
 * - 下载超时：30秒
 */
export const DOUYIN_PIPELINE_LIMITS = {
  /** 最大视频时长（秒），超过此时长拒绝处理 */
  MAX_VIDEO_DURATION_SECONDS: 120,

  /** 最大视频文件大小（字节），50MB */
  MAX_VIDEO_SIZE_BYTES: 50 * 1024 * 1024,

  /** 最大音频文件大小（字节），10MB */
  MAX_AUDIO_SIZE_BYTES: 10 * 1024 * 1024,

  /** 下载超时时间（毫秒），30秒 */
  DOWNLOAD_TIMEOUT_MS: 30_000,

  /** TikHub API 请求超时（毫秒），10秒 */
  TIKHUB_TIMEOUT_MS: 10_000,

  /** 是否启用限制（可通过环境变量禁用，用于自托管环境） */
  get ENABLED(): boolean {
    return process.env.DISABLE_DOUYIN_LIMITS !== 'true'
  }
} as const;

/**
 * 检查是否为 Vercel 环境
 */
export function isVercelEnvironment(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV)
}

/**
 * 格式化文件大小为人类可读格式
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 格式化时长为人类可读格式
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`
}
