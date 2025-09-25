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

const API_BASE = process.env.LLM_API_BASE || "https://api.302.ai/v1"

export async function POST(request: NextRequest) {
  // 1. 认证
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return Response.json({ error: "未认证" }, { status: 401 })
  }

  const userId = String(token.sub)

  // 2. 速率限制检查（修复形同虚设问题）
  const rateLimitResult = await checkRateLimit(request, 'CHAT', userId)
  if (!rateLimitResult.allowed) {
    return Response.json(
      { error: rateLimitResult.error?.message || '请求过于频繁' },
      { status: 429 }
    )
  }

  const body = await request.json()
  const { conversationId, messages, model = "claude-3-5-haiku-20241022", temperature = 0.7 } = body

  // 服务端统一裁剪（防止客户端绕过限制）
  const trimResult = trimForChatAPI(messages)
  const finalMessages = trimResult.messages

  if (trimResult.trimmed) {
    console.log(`[API] Server-side trim: ${trimResult.dropCount} messages dropped, tokens: ${trimResult.estimatedTokens}`)
  }

  // 检查最新用户消息是否被裁剪掉（防止空上下文发送到模型）
  const originalLastMessage = messages[messages.length - 1]
  const trimmedLastMessage = finalMessages[finalMessages.length - 1]

  if (originalLastMessage?.role === 'user' &&
      (!trimmedLastMessage || trimmedLastMessage.id !== originalLastMessage.id)) {
    return Response.json({
      error: '输入内容过长，超出了单次对话的token限制。请尝试缩短消息内容或分段发送。'
    }, { status: 400 })
  }

  // 3. 验证对话归属权（修复越权漏洞）
  if (conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId }
    })

    if (!conversation) {
      return Response.json({ error: "无权访问此对话" }, { status: 403 })
    }
  }

  // 4. 保存用户消息（权限已验证）- 事务原子性修复
  if (conversationId && messages.length > 0) {
    const userMessage = messages[messages.length - 1]
    if (userMessage.role === 'user') {
      try {
        await prisma.$transaction(async (tx) => {
          // 原子操作：消息创建 + 对话统计更新
          await tx.message.create({
            data: {
              conversationId,
              userId,
              role: 'USER',
              content: userMessage.content,
              modelId: model,
              promptTokens: 0,  // 用户消息不计算prompt tokens
              completionTokens: 0
            }
          })

          // 同步更新对话统计字段
          await tx.conversation.update({
            where: { id: conversationId },
            data: {
              lastMessageAt: new Date(),
              messageCount: { increment: 1 }
              // totalTokens 不增加，用户消息不计费
            }
          })
        })
      } catch (dbError) {
        console.error('[Chat] Failed to save user message in transaction:', dbError)
        // 继续执行，不阻断用户体验
      }
    }
  }

  // 5. 根据模型选择API Key
  const { apiKey, provider } = selectApiKey(model)

  if (!apiKey) {
    return Response.json({
      error: `缺少${provider}模型的API Key，请在.env.local中配置对应的Key`
    }, { status: 500 })
  }

  // 6. 调用 AI
  const aiResponse = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages: finalMessages, temperature, stream: true })
  })

  if (!aiResponse.ok) {
    return Response.json({ error: `AI错误: ${aiResponse.status}` }, { status: aiResponse.status })
  }

  // 7. 使用现成SSE解析工具，修复数据丢失问题
  const sseTransform = createSSETransformStream(
    undefined, // onContent - 不需要实时处理
    async (fullContent, usage) => {
      // onComplete - 流结束后保存完整消息 - 事务原子性修复
      if (conversationId && fullContent) {
        try {
          const promptTokens = usage?.prompt_tokens || 0
          const completionTokens = usage?.completion_tokens || 0
          const totalTokensUsed = promptTokens + completionTokens

          await prisma.$transaction(async (tx) => {
            // 原子操作：助手消息创建 + 对话统计更新
            await tx.message.create({
              data: {
                conversationId,
                userId,
                role: 'ASSISTANT',
                content: fullContent,
                modelId: model,
                promptTokens,
                completionTokens
              }
            })

            // 同步更新对话统计字段
            await tx.conversation.update({
              where: { id: conversationId },
              data: {
                lastMessageAt: new Date(),
                messageCount: { increment: 1 },
                totalTokens: { increment: totalTokensUsed }  // 助手回复计入token消耗
              }
            })
          })
        } catch (dbError) {
          console.error('[Chat] Failed to save assistant message in transaction:', dbError)
          // 数据库错误不中断流，但记录错误
        }
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