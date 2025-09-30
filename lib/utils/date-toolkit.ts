/**
 * 时间处理工具库
 *
 * 注意：以下函数是对原生方法的简单包装，保留它们是为了避免大规模修改
 * Linus: "Never break userspace" - 54个文件依赖这些函数，保持兼容性更重要
 */

/**
 * 获取当前时间
 * @deprecated 直接使用 new Date()
 */
export function now(): Date {
  return new Date()
}

/**
 * 获取当前时间戳（毫秒）
 * @deprecated 直接使用 Date.now()
 */
export function timestamp(): number {
  return Date.now()
}

/**
 * 获取ISO格式字符串
 * @deprecated 直接使用 date.toISOString()
 */
export function toISO(date: Date = new Date()): string {
  return date.toISOString()
}

/**
 * 格式化为日期字符串
 * @deprecated 直接使用 date.toISOString().split('T')[0]
 */
export function toDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

/**
 * 格式化为时间字符串
 * @deprecated 直接使用 date.toISOString().split('T')[1].split('.')[0]
 */
export function toTimeString(date: Date = new Date()): string {
  return date.toISOString().split('T')[1].split('.')[0]
}

/**
 * 格式化为本地化字符串
 */
export function toLocal(
  date: Date = now(),
  locale: string = 'zh-CN',
  options?: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleString(locale, options)
}

/**
 * 解析日期字符串
 * 安全解析，无效日期返回null
 */
export function parse(dateString: string | Date | null | undefined): Date | null {
  if (!dateString) return null
  if (dateString instanceof Date) return dateString

  const date = new Date(dateString)
  return isNaN(date.getTime()) ? null : date
}

/**
 * 检查日期是否有效
 */
export function isValid(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * 比较两个日期
 * 返回: -1 (a < b), 0 (a = b), 1 (a > b)
 */
export function compare(a: Date | string, b: Date | string): number {
  const dateA = parse(a)
  const dateB = parse(b)

  if (!dateA || !dateB) return 0

  const diff = dateA.getTime() - dateB.getTime()
  return diff < 0 ? -1 : diff > 0 ? 1 : 0
}

/**
 * 排序辅助函数
 * @example items.sort(sortByDate(item => item.createdAt))
 */
export function sortByDate<T>(
  getDate: (item: T) => Date | string | null | undefined,
  desc = false
): (a: T, b: T) => number {
  return (a: T, b: T) => {
    const result = compare(getDate(a) || '', getDate(b) || '')
    return desc ? -result : result
  }
}

/**
 * 日期计算：添加时间
 */
export function add(
  date: Date,
  amount: number,
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years'
): Date {
  const result = new Date(date.getTime())

  switch (unit) {
    case 'seconds':
      result.setSeconds(result.getSeconds() + amount)
      break
    case 'minutes':
      result.setMinutes(result.getMinutes() + amount)
      break
    case 'hours':
      result.setHours(result.getHours() + amount)
      break
    case 'days':
      result.setDate(result.getDate() + amount)
      break
    case 'months':
      result.setMonth(result.getMonth() + amount)
      break
    case 'years':
      result.setFullYear(result.getFullYear() + amount)
      break
  }

  return result
}

/**
 * 日期计算：减去时间
 */
export function subtract(
  date: Date,
  amount: number,
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years'
): Date {
  return add(date, -amount, unit)
}

/**
 * 获取时间差
 */
export function diff(
  a: Date | string,
  b: Date | string,
  unit: 'seconds' | 'minutes' | 'hours' | 'days' = 'days'
): number {
  const dateA = parse(a)
  const dateB = parse(b)

  if (!dateA || !dateB) return 0

  const diffMs = Math.abs(dateA.getTime() - dateB.getTime())

  switch (unit) {
    case 'seconds':
      return Math.floor(diffMs / 1000)
    case 'minutes':
      return Math.floor(diffMs / (1000 * 60))
    case 'hours':
      return Math.floor(diffMs / (1000 * 60 * 60))
    case 'days':
      return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }
}

/**
 * 获取相对时间描述
 * @example fromNow(pastDate) -> "3 天前"
 */
export function fromNow(date: Date | string, locale: string = 'zh-CN'): string {
  const parsed = parse(date)
  if (!parsed) return ''

  const diffSeconds = Math.floor((Date.now() - parsed.getTime()) / 1000)

  if (locale === 'zh-CN') {
    if (diffSeconds < 60) return '刚刚'
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} 分钟前`
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} 小时前`
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)} 天前`
    if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 604800)} 周前`
    if (diffSeconds < 31536000) return `${Math.floor(diffSeconds / 2592000)} 个月前`
    return `${Math.floor(diffSeconds / 31536000)} 年前`
  } else {
    if (diffSeconds < 60) return 'just now'
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} minutes ago`
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hours ago`
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)} days ago`
    if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 604800)} weeks ago`
    if (diffSeconds < 31536000) return `${Math.floor(diffSeconds / 2592000)} months ago`
    return `${Math.floor(diffSeconds / 31536000)} years ago`
  }
}

/**
 * 检查日期是否在范围内
 */
export function isBetween(
  date: Date | string,
  start: Date | string,
  end: Date | string,
  inclusive = true
): boolean {
  const d = parse(date)
  const s = parse(start)
  const e = parse(end)

  if (!d || !s || !e) return false

  const time = d.getTime()
  const startTime = s.getTime()
  const endTime = e.getTime()

  if (inclusive) {
    return time >= startTime && time <= endTime
  } else {
    return time > startTime && time < endTime
  }
}

/**
 * 检查是否是过去的日期
 */
export function isPast(date: Date | string): boolean {
  const d = parse(date)
  return d ? d.getTime() < Date.now() : false
}

/**
 * 检查是否是未来的日期
 */
export function isFuture(date: Date | string): boolean {
  const d = parse(date)
  return d ? d.getTime() > Date.now() : false
}

/**
 * 检查是否是今天
 */
export function isToday(date: Date | string): boolean {
  const d = parse(date)
  if (!d) return false

  const today = new Date()
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  )
}

/**
 * 获取一天的开始时间 (00:00:00)
 */
export function startOfDay(date: Date = now()): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * 获取一天的结束时间 (23:59:59.999)
 */
export function endOfDay(date: Date = now()): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * 获取月份的第一天
 */
export function startOfMonth(date: Date = now()): Date {
  const result = new Date(date)
  result.setDate(1)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * 获取月份的最后一天
 */
export function endOfMonth(date: Date = now()): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + 1)
  result.setDate(0)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * 性能计时器
 */
export class Timer {
  private startTime: number

  constructor() {
    this.startTime = Date.now()
  }

  /**
   * 获取经过的时间（毫秒）
   */
  elapsed(): number {
    return Date.now() - this.startTime
  }

  /**
   * 获取经过的时间（秒）
   */
  elapsedSeconds(): number {
    return this.elapsed() / 1000
  }

  /**
   * 重置计时器
   */
  reset(): void {
    this.startTime = Date.now()
  }

  /**
   * 获取经过时间并重置
   */
  lap(): number {
    const elapsed = this.elapsed()
    this.reset()
    return elapsed
  }
}

/**
 * 生成基于时间的唯一ID
 * @example uniqueId() -> "1706432400000_abc123"
 * @example uniqueId('user') -> "user_1706432400000_abc123"
 */
export function uniqueId(prefix?: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`
}

/**
 * 格式化持续时间
 * @example formatDuration(3661000) -> "1小时1分钟1秒"
 */
export function formatDuration(
  ms: number,
  locale: string = 'zh-CN'
): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (locale === 'zh-CN') {
    if (days > 0) return `${days}天${hours % 24}小时`
    if (hours > 0) return `${hours}小时${minutes % 60}分钟`
    if (minutes > 0) return `${minutes}分钟${seconds % 60}秒`
    return `${seconds}秒`
  } else {
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }
}

/**
 * 时间常量（毫秒）
 */
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000
} as const

/**
 * 默认导出所有函数
 */
const dateToolkit = {
  now,
  timestamp,
  toISO,
  toDateString,
  toTimeString,
  toLocal,
  parse,
  isValid,
  compare,
  sortByDate,
  add,
  subtract,
  diff,
  fromNow,
  isBetween,
  isPast,
  isFuture,
  isToday,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  Timer,
  uniqueId,
  formatDuration,
  TIME
}

export default dateToolkit