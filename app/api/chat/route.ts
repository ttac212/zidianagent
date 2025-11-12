/**
 * Chat API - Linus 版本
 * 简单、直接、有数据持久化
 */

import { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"
import { selectProvider, buildChatRequest } from "@/lib/ai/provider-manager"
import {
  createSSETransformStream,
  isTransformStreamSupported,
  processSSEStream,
  type SSEMessage
} from "@/lib/utils/sse-parser"
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
import {
  detectDouyinLink,
  extractDouyinLink
} from "@/lib/douyin/link-detector"
import { handleDouyinPipeline } from "@/lib/douyin/sse-handler"
import { selectDouyinStrategy } from "./douyin-strategy"

// 设置最大执行时间为5分钟（抖音视频处理可能需要较长时间）
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
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
    creativeMode = false,  // 创作模式：启用长文本优化
    reasoning_effort,      // ZenMux 推理强度：low/medium/high
    reasoning,             // ZenMux 推理参数对象
  } = body

  // SECURITY: 强制模型白名单验证
  if (!isAllowed(model)) {
    return validationError(
      `Model '${model}' is not allowed. Check MODEL_ALLOWLIST configuration.`
    )
  }

  // 验证 messages 参数
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return validationError('messages 参数不能为空')
  }

  // === 抖音链接处理：策略模式（数据驱动） ===
  const lastUserMessage = messages[messages.length - 1]

  if (lastUserMessage?.role === 'user' && detectDouyinLink(lastUserMessage.content)) {
    console.info('[Douyin] 检测到抖音链接')

    const shareLink = extractDouyinLink(lastUserMessage.content)
    if (!shareLink) {
      return validationError('无法提取抖音链接')
    }

    // 策略选择：根据用户消息内容自动选择合适的处理策略
    const strategy = selectDouyinStrategy(lastUserMessage.content)

    if (strategy) {
      console.info(`[Douyin] 使用策略: ${strategy.name}`)

      return handleDouyinPipeline({
        shareLink,
        userId,
        conversationId,
        model,
        estimatedTokens: strategy.getEstimatedTokens(),
        request,
        userMessage: lastUserMessage.content,
        pipeline: strategy.pipeline,
        eventPrefix: strategy.eventPrefix,
        featureName: strategy.name
      })
    }

    console.info('[Douyin] 检测到抖音链接但无匹配策略，进入普通聊天')
  }

  // 服务端统一裁剪（防止客户端绕过限制）- 基于实际模型上限
  const trimResult = trimForChatAPI(messages, model, creativeMode)
  let finalMessages = trimResult.messages

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

  // 移除被历史逻辑遗留的空内容消息（占位符、进度消息等）
  const nonEmptyMessages = finalMessages.filter((message) => {
    if (typeof message.content !== 'string') {
      return false
    }

    return message.content.trim().length > 0
  })

  if (nonEmptyMessages.length === 0) {
    await QuotaManager.releaseTokens(userId, estimatedTokens)
    return error('无法生成回复：提交的消息内容为空。', { status: 400 })
  }

  if (nonEmptyMessages.length !== finalMessages.length) {
    console.info('[Chat] Removed empty messages from request payload', {
      removed: finalMessages.length - nonEmptyMessages.length
    })
  }

  finalMessages = nonEmptyMessages

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

  // 4. 保存用户消息（权限已验证）- 使用真正的QuotaManager
  if (conversationId && messages.length > 0) {
    const userMessage = messages[messages.length - 1]
    if (userMessage.role === 'user') {
      try {
        // 使用QuotaManager保存用户消息（不计费）
        const success = await QuotaManager.commitTokens(
          userId,
          { promptTokens: 0, completionTokens: 0 }, // 用户消息不计费
          0, // 用户消息无预留消耗
          {
            conversationId,
            role: 'USER',
            content: userMessage.content,
            modelId: model
          }
        )

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

  // 5. 使用 Provider Manager 选择提供商
  const provider = selectProvider(model)

  if (!provider) {
    // 释放预留的配额
    await QuotaManager.releaseTokens(userId, estimatedTokens)
    return error('没有可用的 AI 提供商，请检查环境配置', { status: 500 })
  }

  console.info(`[Chat] Using provider: ${provider.name}`)

  // 6. 调用 AI - 添加max_tokens参数支持Extended Thinking模式和创作模式
  const modelConfig = getModelContextConfig(model, creativeMode)
  const maxTokens = modelConfig.outputMaxTokens || 8000

  // 构建请求体（基础参数）
  const requestOptions: Record<string, any> = {
    temperature,
    max_tokens: maxTokens,
    stream: true
  }

  // ZenMux 推理参数支持（根据ZenMux官方文档）
  // 正确格式: { reasoning: { effort: "low" | "medium" | "high" } }
  if (reasoning?.enabled === false) {
    // 明确禁用推理 - 不传reasoning参数
    // ZenMux默认不启用推理，所以不需要显式禁用
  } else if (reasoning_effort) {
    // 启用推理模式 - 使用ZenMux规范格式
    requestOptions.reasoning = {
      effort: reasoning_effort  // low/medium/high
    }

    // Claude 模型推理模式要求 temperature 必须为 1
    if (model.includes('claude')) {
      requestOptions.temperature = 1
    }

    console.info('[Chat] ZenMux reasoning enabled with effort:', reasoning_effort)
  } else if (reasoning && reasoning.enabled !== false) {
    // 兜底：如果只传了reasoning但没有effort，使用medium作为默认值
    requestOptions.reasoning = {
      effort: 'medium'
    }

    if (model.includes('claude')) {
      requestOptions.temperature = 1
    }

    console.info('[Chat] ZenMux reasoning enabled with default effort: medium')
  }

  // Prompt Caching支持（仅Claude模型）
  const isClaudeModel = model.includes('claude')
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  // 启用Prompt Caching（Claude模型且上下文较长时）
  if (isClaudeModel && finalMessages.length > 5) {
    headers["anthropic-beta"] = "prompt-caching-2024-07-31"
  }

  // Prompt Caching：标记可缓存的消息
  if (isClaudeModel && finalMessages.length > 10) {
    // 对于长对话，缓存前面的消息历史
    finalMessages.forEach((msg, index) => {
      // 缓存前N-5条消息（保留最近5条为动态内容）
      const shouldCache = index < finalMessages.length - 5
      if (shouldCache) {
        (msg as any).cache_control = { type: "ephemeral" }
      }
    })
  }

  // 使用 buildChatRequest 构建完整请求
  const chatRequest = buildChatRequest(
    provider,
    model,
    finalMessages,
    requestOptions
  )

  // 调试日志：打印请求信息
  console.info('[Chat] Request URL:', chatRequest.url)
  console.info('[Chat] Model:', chatRequest.body.model)
  console.info('[Chat] Request options:', JSON.stringify({
    temperature: chatRequest.body.temperature,
    max_tokens: chatRequest.body.max_tokens,
    stream: chatRequest.body.stream,
    reasoning: chatRequest.body.reasoning,
  }, null, 2))

  // 额外调试：如果启用了推理模式，打印完整请求体（不含消息内容）
  if (chatRequest.body.reasoning) {
    console.info('[Chat] ✅ ZenMux Reasoning mode enabled. Full request body (excluding messages):', JSON.stringify({
      model: chatRequest.body.model,
      temperature: chatRequest.body.temperature,
      max_tokens: chatRequest.body.max_tokens,
      stream: chatRequest.body.stream,
      reasoning: chatRequest.body.reasoning,
      messageCount: finalMessages.length
    }, null, 2))
  }

  // Reasoning模式需要更长的超时时间
  const timeout = requestOptions.reasoning ? 120000 : 60000 // 推理模式120秒，普通60秒
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  // 在 try 块外部声明 aiResponse，避免作用域问题
  let aiResponse: Response

  try {
    aiResponse = await fetch(chatRequest.url, {
      method: "POST",
      headers: { ...chatRequest.headers, ...headers },
      body: JSON.stringify(chatRequest.body),
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (!aiResponse.ok) {
      // 释放预留的配额
      await QuotaManager.releaseTokens(userId, estimatedTokens)
      const errorText = await aiResponse.text()
      console.error('[Chat] AI API error:', aiResponse.status, errorText)
      return Response.json({ error: `AI错误: ${aiResponse.status} - ${errorText}` }, { status: aiResponse.status })
    }
  } catch (fetchError) {
    clearTimeout(timeoutId)

    // 释放预留的配额
    await QuotaManager.releaseTokens(userId, estimatedTokens)

    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      console.error('[Chat] Request timeout after', timeout, 'ms')
      return error(
        requestOptions.reasoning
          ? 'AI推理超时（120秒），请尝试使用较低的推理强度或普通模式'
          : 'AI请求超时（60秒），请稍后重试',
        { status: 504 }
      )
    }

    console.error('[Chat] Fetch error:', fetchError)
    return error('AI服务连接失败，请检查网络或稍后重试', { status: 502 })
  }

  // 7. 使用现成SSE解析工具，修复数据丢失问题
  const handleStreamCompletion = async (
    fullContent: string,
    usage?: SSEMessage["usage"],
    reasoning?: string  // ✅ 新增：推理内容
  ) => {
    if (conversationId && fullContent) {
      try {
        const promptTokens = usage?.prompt_tokens || 0
        const completionTokens = usage?.completion_tokens || 0

        const success = await QuotaManager.commitTokens(
          userId,
          { promptTokens, completionTokens },
          estimatedTokens,
          {
            conversationId,
            role: 'ASSISTANT',
            content: fullContent,
            modelId: model,
            // ✅ 新增：传递推理内容和推理强度
            reasoning: reasoning || undefined,
            reasoningEffort: requestOptions.reasoning?.effort || undefined
          }
        )

        if (!success) {
          console.error('[Chat] Failed to save assistant message')
          await QuotaManager.releaseTokens(userId, estimatedTokens)
        }
      } catch (dbError) {
        console.error('[Chat] Failed to save assistant message:', dbError)

        if (dbError instanceof QuotaExceededError) {
          console.error(`[Chat] Quota exceeded during commit: ${dbError.message}`)
        }
        await QuotaManager.releaseTokens(userId, estimatedTokens)
      }
    } else {
      await QuotaManager.releaseTokens(userId, estimatedTokens)
    }
  }

  const responseBody = aiResponse.body

  if (!responseBody) {
    await QuotaManager.releaseTokens(userId, estimatedTokens)
    return error('AI响应无内容', { status: 502 })
  }

  const responseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  } as const

  if (isTransformStreamSupported()) {
    const sseTransform = createSSETransformStream(
      undefined,
      handleStreamCompletion
    )

    return new Response(responseBody.pipeThrough(sseTransform), {
      headers: responseHeaders
    })
  }

  if (typeof responseBody.tee === 'function') {
    const [clientStream, processingStream] = responseBody.tee()
    let fallbackUsage: SSEMessage["usage"] | undefined

    processSSEStream(processingStream.getReader(), {
      onUsage(usage) {
        fallbackUsage = usage
      },
      onError(message) {
        console.error('[Chat] SSE fallback error:', message)
      }
    }).then(
      (fullContent) => handleStreamCompletion(fullContent, fallbackUsage),
      async (streamError) => {
        if (streamError instanceof Error && streamError.name === 'AbortError') {
          return
        }

        console.error('[Chat] SSE fallback processing failed:', streamError)
        await QuotaManager.releaseTokens(userId, estimatedTokens)
      }
    )

    return new Response(clientStream, {
      headers: responseHeaders
    })
  }

  console.warn('[Chat] Falling back to raw stream without TransformStream/tee support')
  await QuotaManager.releaseTokens(userId, estimatedTokens)

  return new Response(responseBody, {
    headers: responseHeaders
  })
  } catch (err) {
    console.error('[Chat] Unexpected error:', err)

    // 尝试获取 userId 和 estimatedTokens（如果已定义）
    const errorContext = {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    }

    console.error('[Chat] Error context:', errorContext)

    return error(
      '服务器内部错误，请稍后重试',
      { status: 500, details: errorContext }
    )
  }
}
