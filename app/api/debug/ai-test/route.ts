import { NextRequest } from "next/server"
import { selectApiKey } from "@/lib/ai/key-manager"

// 直接测试AI服务连接
export async function GET(_request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not available in production', { status: 403 })
  }

  const model = 'claude-opus-4-1-20250805'
  const testMessage = [{ role: 'user', content: '简单测试：1+1等于多少？' }]

  try {
    // 获取API配置
    const base = (process.env.LLM_API_BASE || "https://api.302.ai/v1").replace(/\/$/, "")
    const keySelection = selectApiKey(model)
    const apiKey = keySelection.apiKey
    const endpoint = `${base}/chat/completions`

    // Test endpoint configuration (debug info available in logs)

    const payload = {
      model: model,
      messages: testMessage,
      stream: false, // 简单模式，不使用流
      max_tokens: 100
    }

    const startTime = Date.now()
    
    // Windows环境下的Node.js fetch问题修复
    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ZhidianAI/1.0)",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000), // 15秒超时
      keepalive: false,
      redirect: 'follow',
      // @ts-ignore - Node.js特定选项
      agent: false
    }
    
    const response = await fetch(endpoint, fetchOptions)

    const duration = Date.now() - startTime
    // Response status and duration included in API response

    if (!response.ok) {
      let errorBody: any = null
      try {
        errorBody = await response.json()
      } catch {
        errorBody = await response.text()
      }
      
      return new Response(JSON.stringify({
        success: false,
        status: response.status,
        statusText: response.statusText,
        duration,
        error: errorBody,
        endpoint,
        model,
        keyProvider: keySelection.provider
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const responseData = await response.json()
    
    return new Response(JSON.stringify({
      success: true,
      status: response.status,
      duration,
      response: responseData,
      endpoint,
      model,
      keyProvider: keySelection.provider
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    // Error details included in API response

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    }, null, 2), {
      status: 200, // 返回200以便前端能看到错误信息
      headers: { 'Content-Type': 'application/json' }
    })
  }
}