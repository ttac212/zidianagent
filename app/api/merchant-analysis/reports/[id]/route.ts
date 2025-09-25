/**
 * 商家分析报告详情 API - 功能开发中
 */

import { NextRequest, NextResponse } from 'next/server'

const UNDER_DEVELOPMENT = NextResponse.json(
  { error: '商家分析功能正在开发中' },
  { status: 501 }
)

export async function GET() { return UNDER_DEVELOPMENT }
export async function PUT() { return UNDER_DEVELOPMENT }
export async function DELETE() { return UNDER_DEVELOPMENT }