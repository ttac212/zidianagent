/**
 * 解析抖音分享链接 API
 * POST /api/douyin/parse-share
 *
 * 安全策略:
 * - 要求用户登录认证
 * - 仅允许解析抖音官方域名的链接
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { parseDouyinUserShare } from '@/lib/douyin/share-link'

export async function POST(request: NextRequest) {
  try {
    // 鉴权检查：要求用户登录
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权访问，请先登录' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { shareText } = body

    if (!shareText || typeof shareText !== 'string') {
      return NextResponse.json(
        { error: '请提供分享链接或文案' },
        { status: 400 }
      )
    }

    // 解析分享链接（内部已进行域名白名单校验）
    const result = await parseDouyinUserShare(shareText)

    if (!result.secUserId && !result.userId) {
      return NextResponse.json(
        { error: '无法从分享内容中提取用户ID' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result,
    })

  } catch (error) {
    console.error('解析分享链接失败:', error)
    return NextResponse.json(
      {
        error: '解析失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
