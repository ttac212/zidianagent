/**
 * ZenMux测试API
 * 专用于测试ZenMux提供商的SSE流式对话
 * 不涉及数据库保存，纯功能测试
 *
 * 推理参数支持（根据 ZenMux 官方文档）:
 * - reasoning_effort: low/medium/high，默认 medium（OpenAI 还支持 minimal）
 * - reasoning: { effort, max_tokens, enabled }
 *   - effort: 等价于 reasoning_effort
 *   - max_tokens: 限制推理 token 长度
 *   - enabled: 默认 true，设为 false 可禁用推理
 *
 * 参数优先级:
 * - 如果都不传，默认等价于 { reasoning_effort: "medium", reasoning: { effort: "medium" } }
 * - 推理强度占比: low (20%), medium (50%), high (80%)
 *
 * Claude 特定限制:
 * - 推理模式下 temperature 必须为 1
 */

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { unauthorized, validationError, error } from '@/lib/api/http-response'

const ZENMUX_API_BASE = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
const ZENMUX_API_KEY = process.env.ZENMUX_API_KEY || ''
const ZENMUX_DEFAULT_MODEL =
  process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5'

export async function POST(request: NextRequest) {
  try {
    // 1. 认证检查
    const token = await getToken({ req: request as any })
    if (!token?.sub) {
      return unauthorized('未认证')
    }

    // 2. 验证ZenMux配置
    if (!ZENMUX_API_KEY) {
      return error('ZenMux API密钥未配置', { status: 500 })
    }

    // 3. 解析请求体
    const body = await request.json()
    const {
      messages,
      model = ZENMUX_DEFAULT_MODEL,
      temperature = 0.7,
      max_tokens = 2000,
      reasoning_effort,
      reasoning,
    } = body

    // 验证 messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return validationError('messages 参数不能为空')
    }

    console.info(
      `[ZenMux Test] 模型: ${model}, 消息数: ${messages.length}, 推理: ${reasoning_effort || reasoning?.effort || '默认(medium)'}`
    )

    // 4. 构建请求体
    const requestBody: any = {
      model,
      messages,
      max_tokens,
      stream: true,
    }

    // 添加推理参数（根据 ZenMux 官方文档）
    // 如果用户明确禁用推理
    if (reasoning?.enabled === false) {
      requestBody.reasoning = { enabled: false }
      requestBody.temperature = temperature // 非推理模式使用正常 temperature
    } else if (reasoning_effort || reasoning) {
      // 启用推理模式
      // reasoning_effort 参数（顶层）
      if (reasoning_effort) {
        requestBody.reasoning_effort = reasoning_effort
      }

      // reasoning 对象参数
      if (reasoning) {
        requestBody.reasoning = {
          ...reasoning,
          // 如果没有 enabled 字段，默认为 true
          enabled: reasoning.enabled !== false,
        }
      }

      // Claude 推理模式要求 temperature 必须为 1（Claude 特定限制）
      if (model.includes('claude')) {
        requestBody.temperature = 1
      } else {
        requestBody.temperature = temperature
      }
    } else {
      // 未指定任何推理参数，使用默认 temperature
      requestBody.temperature = temperature
    }

    // 5. 调用ZenMux API
    const response = await fetch(`${ZENMUX_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ZENMUX_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[ZenMux Test] API错误: ${response.status} - ${errorText}`)
      return error(`ZenMux API错误: ${errorText}`, { status: response.status })
    }

    // 5. 转发流式响应
    // 确保响应头正确设置
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // 禁用Nginx缓冲
      },
    })
  } catch (err) {
    console.error('[ZenMux Test] 错误:', err)
    return error(err instanceof Error ? err.message : '未知错误', { status: 500 })
  }
}
