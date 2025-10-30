/**
 * 创建API端点来检查环境变量配置
 */
import { NextRequest, NextResponse } from 'next/server'
import { ALLOWED_MODELS, DEFAULT_MODEL } from '@/lib/ai/models'

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      envModelAllowlist: process.env.MODEL_ALLOWLIST || null,
      allowedModels: ALLOWED_MODELS,
      defaultModel: DEFAULT_MODEL,
      hasEnvFile: process.env.LLM_API_KEY ? true : false
    }
  })
}
