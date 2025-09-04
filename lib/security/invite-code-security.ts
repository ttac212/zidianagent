import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'
import { NextRequest } from 'next/server'

// 邀请码安全配置
export const SECURITY_CONFIG = {
  // 验证失败限制
  MAX_ATTEMPTS_PER_IP: 5,        // 每个IP最多尝试次数
  MAX_ATTEMPTS_PER_DAY: 20,      // 每天全局最多尝试次数
  LOCKOUT_DURATION: 15 * 60 * 1000, // 锁定时长（15分钟）
  
  // 速率限制
  RATE_LIMIT_WINDOW: 60 * 1000,  // 时间窗口（1分钟）
  RATE_LIMIT_MAX_REQUESTS: 3,    // 时间窗口内最多请求次数
  
  // 邀请码格式
  CODE_MIN_LENGTH: 20,            // 邀请码最小长度
  CODE_CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%', // 扩展字符集
}

// 验证尝试记录（内存缓存，生产环境应使用Redis）
const attemptCache = new Map<string, {
  count: number
  firstAttempt: Date
  lastAttempt: Date
  locked: boolean
  lockedUntil?: Date
}>()

// 速率限制缓存
const rateLimitCache = new Map<string, {
  requests: Date[]
}>()

/**
 * 生成安全的邀请码
 */
export function generateSecureInviteCode(): string {
  const charset = SECURITY_CONFIG.CODE_CHARSET
  const length = 24 // 增加长度
  let code = ''
  
  // 使用加密随机数生成器
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  
  for (let i = 0; i < length; i++) {
    code += charset[randomValues[i] % charset.length]
  }
  
  // 添加校验和（防止随机猜测）
  const checksum = createHash('sha256')
    .update(code + process.env.NEXTAUTH_SECRET)
    .digest('hex')
    .substring(0, 4)
    .toUpperCase()
  
  return `${code}-${checksum}`
}

/**
 * 验证邀请码格式和校验和
 */
export function validateInviteCodeFormat(code: string): boolean {
  const parts = code.split('-')
  if (parts.length !== 2) return false
  
  const [mainCode, providedChecksum] = parts
  
  // 验证长度
  if (mainCode.length < SECURITY_CONFIG.CODE_MIN_LENGTH) return false
  
  // 验证校验和
  const expectedChecksum = createHash('sha256')
    .update(mainCode + process.env.NEXTAUTH_SECRET)
    .digest('hex')
    .substring(0, 4)
    .toUpperCase()
  
  return providedChecksum === expectedChecksum
}

/**
 * 获取客户端IP
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIP || 'unknown'
  
  // 对IP进行哈希处理，保护隐私
  return createHash('sha256').update(ip).digest('hex').substring(0, 16)
}

/**
 * 检查IP是否被锁定
 */
export function isIPLocked(ipHash: string): boolean {
  const attempts = attemptCache.get(ipHash)
  
  if (!attempts || !attempts.locked) return false
  
  if (attempts.lockedUntil && new Date() > attempts.lockedUntil) {
    // 解锁
    attempts.locked = false
    attempts.count = 0
    return false
  }
  
  return true
}

/**
 * 记录失败尝试
 */
export function recordFailedAttempt(ipHash: string): void {
  const now = new Date()
  const attempts = attemptCache.get(ipHash) || {
    count: 0,
    firstAttempt: now,
    lastAttempt: now,
    locked: false
  }
  
  attempts.count++
  attempts.lastAttempt = now
  
  // 检查是否需要锁定
  if (attempts.count >= SECURITY_CONFIG.MAX_ATTEMPTS_PER_IP) {
    attempts.locked = true
    attempts.lockedUntil = new Date(now.getTime() + SECURITY_CONFIG.LOCKOUT_DURATION)
  }
  
  attemptCache.set(ipHash, attempts)
}

/**
 * 清除成功验证后的记录
 */
export function clearAttempts(ipHash: string): void {
  attemptCache.delete(ipHash)
  rateLimitCache.delete(ipHash)
}

/**
 * 检查速率限制
 */
export function checkRateLimit(ipHash: string): boolean {
  const now = new Date()
  const limit = rateLimitCache.get(ipHash) || { requests: [] }
  
  // 清理过期的请求记录
  limit.requests = limit.requests.filter(
    date => now.getTime() - date.getTime() < SECURITY_CONFIG.RATE_LIMIT_WINDOW
  )
  
  // 检查是否超过限制
  if (limit.requests.length >= SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS) {
    return false
  }
  
  // 记录新请求
  limit.requests.push(now)
  rateLimitCache.set(ipHash, limit)
  
  return true
}

/**
 * 生成时效性令牌（可选方案）
 */
export function generateTemporaryToken(inviteCode: string): string {
  const timestamp = Date.now()
  const data = `${inviteCode}:${timestamp}`
  const signature = createHash('sha256')
    .update(data + process.env.NEXTAUTH_SECRET)
    .digest('hex')
  
  return Buffer.from(`${data}:${signature}`).toString('base64')
}

/**
 * 验证时效性令牌
 */
export function validateTemporaryToken(token: string, maxAge: number = 5 * 60 * 1000): {
  valid: boolean
  inviteCode?: string
} {
  try {
    const decoded = Buffer.from(token, 'base64').toString()
    const parts = decoded.split(':')
    
    if (parts.length !== 3) return { valid: false }
    
    const [inviteCode, timestamp, signature] = parts
    const now = Date.now()
    
    // 检查时效性
    if (now - parseInt(timestamp) > maxAge) {
      return { valid: false }
    }
    
    // 验证签名
    const expectedSignature = createHash('sha256')
      .update(`${inviteCode}:${timestamp}` + process.env.NEXTAUTH_SECRET)
      .digest('hex')
    
    if (signature !== expectedSignature) {
      return { valid: false }
    }
    
    return { valid: true, inviteCode }
  } catch {
    return { valid: false }
  }
}

/**
 * 记录所有验证尝试（用于审计）
 */
export async function logVerificationAttempt(
  ipHash: string,
  code: string,
  success: boolean,
  userAgent?: string
) {
  // 在生产环境中，应该记录到数据库或日志系统
  console.log('Invite code verification attempt:', {
    timestamp: new Date().toISOString(),
    ipHash,
    codePrefix: code.substring(0, 4) + '***', // 不记录完整邀请码
    success,
    userAgent: userAgent?.substring(0, 50) // 截断User-Agent
  })
  
  // 可选：记录到数据库
  // await prisma.auditLog.create({
  //   data: {
  //     action: 'INVITE_CODE_VERIFICATION',
  //     ipHash,
  //     success,
  //     metadata: { userAgent }
  //   }
  // })
}