/**
 * 商家分析 API - 功能开发中
 */

import { NextRequest } from "next/server"
import {
  error
} from '@/lib/api/http-response'


// 统一的"功能开发中"响应
const UNDER_DEVELOPMENT = error('商家分析功能正在开发中', {
  status: 501,
  details: { message: 'Merchant analysis feature is under development' }
})

// POST /api/merchant-analysis/generate
export async function POST(_request: NextRequest) {
  return UNDER_DEVELOPMENT
}

// GET /api/merchant-analysis/generate
export async function GET(_request: NextRequest) {
  return UNDER_DEVELOPMENT
}