/**
 * Chat API - Linus 版本
 * 简单、直接、有数据持久化
 */

import { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"
import { selectApiKey } from "@/lib/ai/key-manager"
import { createSSETransformStream } from "@/lib/utils/sse-parser"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { trimForChatAPI } from "@/lib/chat/context-trimmer"
import { DEFAULT_MODEL, isAllowed } from "@/lib/ai/models"
import { QuotaManager, QuotaExceededError } from "@/lib/security/quota-manager"
import { getModelContextConfig } from "@/lib/constants/message-limits"
import {
  error,
  validationError,
  forbidden,
  unauthorized
} from '@/lib/api/http-response'
import { saveMessage } from "@/lib/repositories/message-repository"


const API_BASE = process.env.LLM_API_BASE || "https://api.302.ai/v1"

export async function POST(request: NextRequest) {
  // 1. 认证
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证')
  }

  const userId = String(token.sub)

  // 2. 速率限制检查（修复形同虚设问题）
  const rateLimitResult = await checkRateLimit(request, 'CHAT', userId)
  if (!rateLimitResult.allowed) {
    return error(
      rateLimitResult.error?.message || '请求过于频繁',
      { status: 429 }
    )
  }

  // 3. 原子性配额检查和预留（修复R2：真正的原子操作）
  const body = await request.json()
  const {
    conversationId,
    messages,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    creativeMode = false  // 创作模式：启用长文本优化
  } = body

  // SECURITY: 强制模型白名单验证
  if (!isAllowed(model)) {
    return validationError(
      `Model '${model}' is not allowed. Check MODEL_ALLOWLIST configuration.`
    )
  }

  // 服务端统一裁剪（防止客户端绕过限制）- 基于实际模型上限
  const trimResult = trimForChatAPI(messages, model, creativeMode)
  const finalMessages = trimResult.messages

  // 估算本次请求需要的token数量（保守估计）
  const estimatedTokens = Math.max(trimResult.estimatedTokens * 1.5, 1000) // 预留50%缓冲

  // 原子性预留配额 - 真正的数据库事务
  const quotaResult = await QuotaManager.reserveTokens(userId, estimatedTokens)
  if (!quotaResult.success) {
    return error(
      quotaResult.message || '配额不足',
      {
        status: 429,
        details: {
          currentUsage: quotaResult.currentUsage,
          limit: quotaResult.limit
        }
      }
    )
  }

  if (trimResult.trimmed) {
    console.info(`[API] Server-side trim: ${trimResult.dropCount} messages dropped, tokens: ${trimResult.estimatedTokens}`)

    // SECURITY: 如果裁剪太多，返回友好错误而不是继续处理
    if (trimResult.dropCount > messages.length * 0.5) {
      // 释放预留的配额
      await QuotaManager.releaseTokens(userId, estimatedTokens)
      return error(
        `对话过长，已超出模型${model}的上下文限制。请考虑分段对话或总结之前的内容。`,
        {
          status: 400,
          details: {
            modelLimit: true,
            droppedMessages: trimResult.dropCount,
            totalMessages: messages.length
          }
        }
      )
    }
  }

  // 检查最新用户消息是否被裁剪掉（防止空上下文发送到模型）
  const originalLastMessage = messages[messages.length - 1]
  const trimmedLastMessage = finalMessages[finalMessages.length - 1]

  if (originalLastMessage?.role === 'user' &&
      (!trimmedLastMessage || trimmedLastMessage.id !== originalLastMessage.id)) {
    // 释放预留的配额
    await QuotaManager.releaseTokens(userId, estimatedTokens)
    return error(
      '输入内容过长，超出了单次对话的token限制。请尝试缩短消息内容或分段发送。',
      { status: 400 }
    )
  }

  // 3. 验证对话归属权（修复越权漏洞）
  if (conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId }
    })

    if (!conversation) {
      // 释放预留的配额
      await QuotaManager.releaseTokens(userId, estimatedTokens)
      return forbidden('无权访问此对话')
    }
  }

  // 4. 保存用户消息（权限已验证）
  if (conversationId && messages.length > 0) {
    const userMessage = messages[messages.length - 1]
    if (userMessage.role === 'user') {
      try {
        // 显式调用消息保存函数
        const success = await saveMessage({
          conversationId,
          userId,
          role: 'USER',
          content: userMessage.content,
          modelId: model,
          promptTokens: 0,  // 用户消息只算输入
          completionTokens: 0
        })

        if (!success) {
          console.error('[Chat] Failed to save user message')
          // 继续执行，不阻断用户体验
        }
      } catch (dbError) {
        console.error('[Chat] Failed to save user message:', dbError)
        // 继续执行，不阻断用户体验
      }
    }
  }

  // 5. 根据模型选择API Key
  const { apiKey, provider } = selectApiKey(model)

  if (!apiKey) {
    // 释放预留的配额
    await QuotaManager.releaseTokens(userId, estimatedTokens)
    return Response.json({
      error: `缺少${provider}模型的API Key，请在.env.local中配置对应的Key`
    }, { status: 500 })
  }

  // 6. 调用 AI - 添加max_tokens参数支持Extended Thinking模式和创作模式
  const modelConfig = getModelContextConfig(model, creativeMode)
  const maxTokens = modelConfig.outputMaxTokens || 8000

  // Prompt Caching支持（仅Claude模型）
  const isClaudeModel = model.includes('claude')
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }

  // 启用Prompt Caching（Claude模型且上下文较长时）
  if (isClaudeModel && finalMessages.length > 5) {
    headers["anthropic-beta"] = "prompt-caching-2024-07-31"
  }

  // 构建请求体
  const requestBody: Record<string, any> = {
    model,
    messages: finalMessages,
    temperature,
    max_tokens: maxTokens,
    stream: true
  }

  // Prompt Caching：标记可缓存的消息
  if (isClaudeModel && finalMessages.length > 10) {
    // 对于长对话，缓存前面的消息历史
    requestBody.messages = finalMessages.map((msg, index) => {
      // 缓存前N-5条消息（保留最近5条为动态内容）
      const shouldCache = index < finalMessages.length - 5
      if (shouldCache) {
        return {
          ...msg,
          cache_control: { type: "ephemeral" }
        }
      }
      return msg
    })
  }

  const aiResponse = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody)
  })

  if (!aiResponse.ok) {
    // 释放预留的配额
    await QuotaManager.releaseTokens(userId, estimatedTokens)
    return Response.json({ error: `AI错误: ${aiResponse.status}` }, { status: aiResponse.status })
  }

  // 7. 使用现成SSE解析工具，修复数据丢失问题
  const sseTransform = createSSETransformStream(
    undefined, // onContent - 不需要实时处理
    async (fullContent, usage) => {
      // onComplete - 流结束后保存完整消息并调整配额
      if (conversationId && fullContent) {
        try {
          const promptTokens = usage?.prompt_tokens || 0
          const completionTokens = usage?.completion_tokens || 0
          const totalTokens = promptTokens + completionTokens

          // 1. 保存助手消息
          const messageSaved = await saveMessage({
            conversationId,
            userId,
            role: 'ASSISTANT',
            content: fullContent,
            modelId: model,
            promptTokens,
            completionTokens
          })

          if (!messageSaved) {
            console.error('[Chat] Failed to save assistant message')
            // 保存失败，释放预留配额
            await QuotaManager.releaseTokens(userId, estimatedTokens)
            return
          }

          // 2. 调整配额（实际使用 vs 预估）
          try {
            await QuotaManager.commitTokens(
              userId,
              totalTokens,
              estimatedTokens
            )
          } catch (quotaError) {
            if (quotaError instanceof QuotaExceededError) {
              console.error(`[Chat] Quota exceeded during commit: ${quotaError.message}`)
              // QuotaManager已经确保不会扣减超限配额
            } else {
              console.error('[Chat] Quota commit failed:', quotaError)
              // 其他错误，尝试释放预留配额
              await QuotaManager.releaseTokens(userId, estimatedTokens)
            }
          }
        } catch (error) {
          console.error('[Chat] Failed to process completion:', error)
          await QuotaManager.releaseTokens(userId, estimatedTokens)
        }
      } else {
        // 如果没有内容或对话ID，释放预留配额
        await QuotaManager.releaseTokens(userId, estimatedTokens)
      }
    }
  )

  return new Response(aiResponse.body?.pipeThrough(sseTransform), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  })
}
