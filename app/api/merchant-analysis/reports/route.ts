/**
 * 商家分析报告 API - 功能开发中
 */

import {
  error
} from '@/lib/api/http-response'


const UNDER_DEVELOPMENT = error('商家分析功能正在开发中', { status: 501 })

export async function GET() { return UNDER_DEVELOPMENT }
export async function POST() { return UNDER_DEVELOPMENT }
export async function PUT() { return UNDER_DEVELOPMENT }
export async function DELETE() { return UNDER_DEVELOPMENT }