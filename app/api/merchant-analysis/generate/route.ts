/**
 * 商家分析 API - 功能开发中
 */

import { NextRequest, NextResponse } from 'next/server'

// 统一的"功能开发中"响应
const UNDER_DEVELOPMENT = NextResponse.json(
  {
    error: '商家分析功能正在开发中',
    message: 'Merchant analysis feature is under development'
  },
  { status: 501 }
)

// POST /api/merchant-analysis/generate
export async function POST(_request: NextRequest) {
  return UNDER_DEVELOPMENT
}

// GET /api/merchant-analysis/generate
export async function GET(_request: NextRequest) {
  return UNDER_DEVELOPMENT
}