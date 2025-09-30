import { NextRequest } from "next/server"
import { selectApiKey, getKeyHealthStatus } from "@/lib/ai/key-manager"
import * as dt from '@/lib/utils/date-toolkit'


// 开发环境调试API - 检查环境变量加载状态
export async function GET(_request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not available in production', { status: 403 })
  }

  try {
    const model = 'claude-opus-4-1-20250805'
    
    // 检查环境变量原始值
    const envCheck = {
      LLM_API_BASE: process.env.LLM_API_BASE || 'NOT_SET',
      LLM_API_KEY: process.env.LLM_API_KEY ? `${process.env.LLM_API_KEY.slice(0, 10)}...` : 'NOT_SET',
      LLM_CLAUDE_API_KEY: process.env.LLM_CLAUDE_API_KEY ? `${process.env.LLM_CLAUDE_API_KEY.slice(0, 10)}...` : 'NOT_SET',
      LLM_GEMINI_API_KEY: process.env.LLM_GEMINI_API_KEY ? `${process.env.LLM_GEMINI_API_KEY.slice(0, 10)}...` : 'NOT_SET',
      MODEL_ALLOWLIST: process.env.MODEL_ALLOWLIST || 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV
    }

    // 检查Key选择逻辑
    let keySelection = null
    let keySelectionError = null
    try {
      keySelection = selectApiKey(model)
    } catch (error) {
      keySelectionError = error instanceof Error ? error.message : String(error)
    }

    // 检查健康状态
    const healthStatus = getKeyHealthStatus()

    const debugInfo = {
      timestamp: dt.toISO(),
      environment: envCheck,
      keySelection,
      keySelectionError,
      healthStatus,
      testModel: model
    }

    return new Response(JSON.stringify(debugInfo, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}