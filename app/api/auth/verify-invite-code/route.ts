import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { 
  getClientIP,
  isIPLocked,
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
  logVerificationAttempt,
  validateInviteCodeFormat
} from '@/lib/security/invite-code-security'

export async function POST(request: NextRequest) {
  try {
    // 1. 获取客户端IP（哈希处理）
    const ipHash = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || ''
    
    // 2. 检查IP是否被锁定
    if (isIPLocked(ipHash)) {
      await logVerificationAttempt(ipHash, '***locked***', false, userAgent)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many failed attempts. Please try again later.',
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        },
        { status: 403 }
      )
    }
    
    // 3. 检查速率限制
    if (!checkRateLimit(ipHash)) {
      await logVerificationAttempt(ipHash, '***rate-limited***', false, userAgent)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many requests. Please slow down.',
          retryAfter: 60 // 秒
        },
        { status: 429 }
      )
    }
    
    // 4. 获取请求数据
    const { inviteCode, captchaToken } = await request.json()
    void captchaToken // 为未来验证码功能预留，暂时未使用
    
    if (!inviteCode) {
      return NextResponse.json(
        { success: false, error: 'Invite code is required' },
        { status: 400 }
      )
    }
    
    // 5. 验证邀请码格式（包括校验和）
    if (!validateInviteCodeFormat(inviteCode)) {
      recordFailedAttempt(ipHash)
      await logVerificationAttempt(ipHash, inviteCode, false, userAgent)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid invite code format',
          remainingAttempts: Math.max(0, 5 - (await getAttemptCount(ipHash)))
        },
        { status: 400 }
      )
    }
    
    // 6. TODO: 验证验证码（如果需要）
    // if (captchaToken) {
    //   const captchaValid = await verifyCaptcha(captchaToken)
    //   if (!captchaValid) {
    //     return NextResponse.json(
    //       { success: false, error: 'Invalid captcha' },
    //       { status: 400 }
    //     )
    //   }
    // }
    
    // 7. 查询数据库验证邀请码
    const invite = await prisma.inviteCode.findUnique({
      where: { code: inviteCode },
      select: {
        id: true,
        code: true,
        isActive: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        defaultRole: true,
        monthlyTokenLimit: true,
        description: true
      }
    })
    
    // 8. 验证邀请码有效性
    if (!invite) {
      recordFailedAttempt(ipHash)
      await logVerificationAttempt(ipHash, inviteCode, false, userAgent)
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or expired invite code',
          remainingAttempts: Math.max(0, 5 - (await getAttemptCount(ipHash)))
        },
        { status: 400 }
      )
    }
    
    // 检查是否激活
    if (!invite.isActive) {
      recordFailedAttempt(ipHash)
      await logVerificationAttempt(ipHash, inviteCode, false, userAgent)
      
      return NextResponse.json(
        { success: false, error: 'This invite code has been deactivated' },
        { status: 400 }
      )
    }
    
    // 检查使用次数
    if (invite.usedCount >= invite.maxUses) {
      recordFailedAttempt(ipHash)
      await logVerificationAttempt(ipHash, inviteCode, false, userAgent)
      
      return NextResponse.json(
        { success: false, error: 'This invite code has reached its usage limit' },
        { status: 400 }
      )
    }
    
    // 检查过期时间
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      recordFailedAttempt(ipHash)
      await logVerificationAttempt(ipHash, inviteCode, false, userAgent)
      
      return NextResponse.json(
        { success: false, error: 'This invite code has expired' },
        { status: 400 }
      )
    }
    
    // 9. 验证成功，清除失败记录
    clearAttempts(ipHash)
    await logVerificationAttempt(ipHash, inviteCode, true, userAgent)
    
    // 10. 返回成功响应（不包含敏感信息）
    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        remainingUses: invite.maxUses - invite.usedCount,
        description: invite.description,
        // 生成临时令牌，用于注册时验证
        registrationToken: generateRegistrationToken(invite.id, ipHash)
      }
    })
    
  } catch (error) {
    void error
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 获取尝试次数（简化版，实际应从缓存获取）
async function getAttemptCount(_ipHash: string): Promise<number> {
  // 这里应该从Redis或内存缓存获取
  // 暂时返回模拟值
  return 0
}

// 生成注册令牌
function generateRegistrationToken(inviteId: string, ipHash: string): string {
  // 生成一个临时令牌，包含邀请码ID和IP哈希
  // 实际实现应该使用JWT或加密
  const crypto = require('crypto')
  const data = `${inviteId}:${ipHash}:${Date.now()}`
  const signature = crypto
    .createHash('sha256')
    .update(data + process.env.NEXTAUTH_SECRET)
    .digest('hex')
  
  return Buffer.from(`${data}:${signature}`).toString('base64')
}

// OPTIONS请求处理（CORS）
export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}