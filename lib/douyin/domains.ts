/**
 * 抖音官方域名统一定义
 *
 * 职责：
 * - 提供抖音官方域名白名单（防止SSRF攻击）
 * - 统一数据源，避免重复维护
 * - 支持域名验证和正则模式生成
 *
 * 设计原则（Linus风格）：
 * - 单一数据源（DRY原则）
 * - 简单的数据结构优于复杂的代码
 * - 其他模块从这里导入，不要自己定义
 */

/**
 * 抖音官方域名白名单
 * 严格限制只允许抖音官方域名，防止SSRF攻击
 */
export const ALLOWED_DOUYIN_DOMAINS = [
  'v.douyin.com',          // 短链接域名
  'www.douyin.com',        // 主站域名
  'douyin.com',            // 顶级域名
  'm.douyin.com',          // 移动端域名
  'www.iesdouyin.com',     // 视频服务域名（重定向目标）
]

/**
 * 域名Set，用于O(1)查找验证
 */
export const DOMAIN_SET = new Set(ALLOWED_DOUYIN_DOMAINS)

/**
 * 域名类型（用于类型检查）
 */
export type DouyinDomain = 'v.douyin.com' | 'www.douyin.com' | 'douyin.com' | 'm.douyin.com' | 'www.iesdouyin.com'

/**
 * 验证URL是否属于抖音官方域名
 *
 * @param url - 要验证的URL
 * @returns 是否为抖音官方域名
 */
export function isDouyinDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return DOMAIN_SET.has(hostname)
  } catch {
    return false
  }
}

/**
 * 构建域名匹配的正则表达式模式
 *
 * @param domain - 域名（如 'v.douyin.com'）
 * @returns 正则表达式（如 /https?:\/\/v\.douyin\.com/）
 */
export function buildDomainPattern(domain: string): RegExp {
  // 转义点号：. → \.
  const escaped = domain.replace(/\./g, '\\.')
  return new RegExp(`https?://${escaped}`)
}

/**
 * 获取所有域名的正则模式
 *
 * @returns 域名到正则表达式的映射
 */
export function getAllDomainPatterns(): Map<string, RegExp> {
  const patterns = new Map<string, RegExp>()
  for (const domain of ALLOWED_DOUYIN_DOMAINS) {
    patterns.set(domain, buildDomainPattern(domain))
  }
  return patterns
}

/**
 * 从URL中提取域名（安全版本）
 *
 * @param url - URL字符串
 * @returns 域名或null（如果URL格式无效）
 */
export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}
