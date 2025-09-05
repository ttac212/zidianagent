import type { NextRequest } from "next/server"
import { ALLOWED_MODEL_IDS } from "@/lib/ai/models"
import { validateModelId } from "@/lib/model-validator"
import { selectApiKey } from "@/lib/ai/key-manager"
import { prisma } from "@/lib/prisma"
import { getToken } from "next-auth/jwt"
import { getModelProvider, getTodayDate } from "@/lib/ai/model-stats-helper"
import { createSafeContextMessage, validateMessageContent } from "@/lib/security/content-filter"
import { checkMultipleRateLimits } from "@/lib/security/rate-limiter"
import { createErrorResponse } from "@/lib/api/error-handler"

// 支持 GET 方法用于健康检查
export async function GET() {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  })
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let conversationId: string | null = null
  let userId: string | null = null
  let userMessage: any = null
  let assistantMessage: any = null
  let tokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  let model: string = 'unknown'
  
  try {
    // 认证检查
    const token = await getToken({ req: request as any })
    if (!token?.sub) {
      return new Response(JSON.stringify({ error: "未认证" }), { status: 401, headers: { "Content-Type": "application/json" } })
    }

    userId = String(token.sub)
    
    // 速率限制检查 - 检查聊天和全局IP限制
    const rateLimitCheck = checkMultipleRateLimits(request, ['CHAT', 'GLOBAL_IP'], userId)
    if (!rateLimitCheck.allowed && rateLimitCheck.error) {
      return createErrorResponse(rateLimitCheck.error)
    }

    const requestBody = await request.json()
    
    const {
      messages = [],
      model: requestModel,
      temperature,
      editorExcerpt,
      conversationId: reqConversationId
    } = requestBody

    conversationId = reqConversationId
    model = requestModel || 'unknown'
    // 使用新的模型验证器
    const modelValidation = validateModelId(model)
    if (!modelValidation.isValid) {
      return new Response(
        JSON.stringify({
          error: `模型验证失败: ${modelValidation.errors.join(', ')}`,
          allowedModels: ALLOWED_MODEL_IDS,
          suggestions: modelValidation.warnings
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const useModel: string = requestModel

    // 若未提供 conversationId，自动为当前用户创建对话（容错，保证后续持久化）
    if (userId && !conversationId) {
      try {
        const created = await prisma.conversation.create({
          data: {
            userId,
            modelId: model, // 使用已通过白名单校验后的模型名
            temperature: typeof temperature === 'number' ? temperature : 0.7,
            lastMessageAt: new Date(),
          },
          select: { id: true },
        })
        conversationId = created.id
      } catch (e) {
        // 自动创建失败不应阻断后续用量统计
      }
    }

    // 如果提供了 userId 和 conversationId，验证对话权限
    if (userId && conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { user: true }
      })

      if (!conversation || conversation.userId !== userId) {
        return new Response(
          JSON.stringify({ error: "对话不存在或无权访问" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      }

      // 检查用户状态和配额
      if (conversation.user.status !== 'ACTIVE') {
        return new Response(
          JSON.stringify({ error: "用户账户异常" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      }

      if (conversation.user.currentMonthUsage >= conversation.user.monthlyTokenLimit) {
        return new Response(
          JSON.stringify({ error: "月度配额已用完" }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        )
      }
    }

    // 验证和处理用户消息
    let validatedMessages = messages
    if (messages.length > 0) {
      validatedMessages = messages.map((msg: any) => {
        if (msg.role === 'user') {
          const validation = validateMessageContent(msg.content)
          if (!validation.isValid) {
            console.warn('[Chat API] Invalid user message filtered:', validation.warnings)
            return { ...msg, content: '消息内容不符合安全规范，已被过滤' }
          }
          return { ...msg, content: validation.filteredContent }
        }
        return msg
      })
    }

    // 如果提供了对话信息，保存用户消息到数据库
    if (userId && conversationId && validatedMessages.length > 0) {
      const latestMessage = validatedMessages[validatedMessages.length - 1]
      if (latestMessage.role === 'user') {
        userMessage = await prisma.message.create({
          data: {
            conversationId,
            role: 'USER',
            content: latestMessage.content,
            modelId: useModel,
            temperature: temperature || null,
          }
        })
      }
    }

    // 安全处理编辑器上下文（使用内容过滤防止注入）
    const safeContextMessage = editorExcerpt ? createSafeContextMessage(editorExcerpt) : null
    const sysMessages = safeContextMessage ? [safeContextMessage] : []

    const finalMessages = [...sysMessages, ...validatedMessages]

    // 多KEY模式：根据模型自动选择最合适的API Key
    const base = (process.env.LLM_API_BASE || "https://api.302.ai/v1").replace(/\/$/, "")
    const keySelection = selectApiKey(useModel)
    
    if (!keySelection.apiKey) {
      const errorMsg = keySelection.keySource === 'none' 
        ? `未配置模型 ${useModel} 对应的API Key` 
        : "后端API Key配置错误"
      return new Response(JSON.stringify({ 
        error: errorMsg,
        modelId: useModel,
        suggestion: `请配置 ${useModel} 对应供应商的API Key`
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const apiKey = keySelection.apiKey

    // 默认使用 /chat/completions（Gemini 已验证可用；多数聚合模型也兼容）
    let endpoint = `${base}/chat/completions`

    // 若后续确认某些 Claude 需要走 /messages，可在此处根据前缀切换：
    // if (useModel.startsWith("claude-")) endpoint = `${base}/messages`

    const payload: Record<string, any> = {
      model: useModel,
      messages: finalMessages,
      stream: true,
    }
    if (typeof temperature === "number") payload.temperature = temperature
    


    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // 接受 SSE
        "Accept": "text/event-stream",
      },
      body: JSON.stringify(payload),
    })

    // 非 2xx：尝试解析错误并向前端统一返回
    if (!upstream.ok) {
      let errBody: any = null
      try {
        errBody = await upstream.json()
      } catch {
        errBody = { error: `Upstream error ${upstream.status}` }
      }
      const status = upstream.status === 429 ? 429 : upstream.status || 500
      return new Response(JSON.stringify(errBody), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 处理 SSE 流并收集响应内容
    if (!upstream.body) {
      return new Response(JSON.stringify({ error: "上游无响应体" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 提前记录一次 API 调用（当用户已认证且上游可用时）
    try {
      const today = getTodayDate()
      const modelProvider = getModelProvider(useModel)
      
      // 预记录总量统计
      await prisma.usageStats.upsert({
        where: { userId_date_modelId: { userId: userId!, date: today, modelId: "_total" } },
        update: { apiCalls: { increment: 1 }, updatedAt: new Date() },
        create: { userId: userId!, date: today, modelId: "_total", apiCalls: 1 },
      })
      
      // 预记录按模型统计
      await prisma.usageStats.upsert({
        where: { 
          userId_date_modelId: { 
            userId: userId!, 
            date: today, 
            modelId: useModel 
          } 
        },
        update: { apiCalls: { increment: 1 }, updatedAt: new Date() },
        create: { 
          userId: userId!, 
          date: today, 
          modelId: useModel,
          modelProvider: modelProvider,
          apiCalls: 1 
        },
      })
    } catch (preErr) {
      }

    const headers = new Headers()
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "text/event-stream")
    headers.set("Cache-Control", "no-cache")
    headers.set("Connection", "keep-alive")

    // 创建转换流来拦截并保存响应
    let assistantContent = ""
    let isComplete = false

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk)
        const lines = text.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                isComplete = true
              } else {
                const parsed = JSON.parse(data)
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                  const delta = parsed.choices[0].delta
                  if (delta.content) {
                    assistantContent += delta.content
                  }
                  if (parsed.choices[0].finish_reason) {
                    isComplete = true
                  }
                }
                // 保存 token 使用信息
                if (parsed.usage) {
                  tokenUsage = parsed.usage
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
        
        controller.enqueue(chunk)
      },
      flush() {
        // 流结束后保存 AI 响应到数据库
        if (userId && assistantContent && isComplete) {
          // 异步保存，不阻塞响应
          saveAssistantMessage()
        }
      }
    })

    // 异步保存助手消息的函数
    async function saveAssistantMessage() {
      try {
        if (!userId) return

        // 保存 AI 响应（需要存在对话ID）
        if (conversationId) {
          assistantMessage = await prisma.message.create({
            data: {
              conversationId,
              role: 'ASSISTANT',
              content: assistantContent,
              modelId: useModel,
              temperature: temperature || null,
              promptTokens: tokenUsage.prompt_tokens || 0,
              completionTokens: tokenUsage.completion_tokens || 0,
              totalTokens: tokenUsage.total_tokens || 0,
              finishReason: 'stop',
            }
          })
        }

        // 更新用户用量统计
        await prisma.user.update({
          where: { id: userId },
          data: {
            currentMonthUsage: {
              increment: tokenUsage.total_tokens || 0
            },
            totalTokenUsed: {
              increment: tokenUsage.total_tokens || 0
            },
            lastActiveAt: new Date(),
          }
        })

        // 若存在对话，则更新对话统计
        if (conversationId) {
          await prisma.conversation.update({
            where: { id: conversationId },
            data: {
              messageCount: { increment: assistantMessage ? 2 : 1 }, // 用户消息 + AI 消息
              totalTokens: { increment: tokenUsage.total_tokens || 0 },
              lastMessageAt: new Date(),
              updatedAt: new Date(),
            }
          })
        }

        // 更新当日用量统计（不依赖 conversationId）
        const today = getTodayDate() // 使用统一的日期函数

        // 1. 更新总量统计（使用modelId = null）
        await prisma.usageStats.upsert({
          where: {
            userId_date_modelId: {
              userId: userId,
              date: today,
              modelId: "_total"
            }
          },
          update: {
            apiCalls: { increment: 1 },
            successfulCalls: { increment: 1 },
            totalTokens: { increment: tokenUsage.total_tokens || 0 },
            promptTokens: { increment: tokenUsage.prompt_tokens || 0 },
            completionTokens: { increment: tokenUsage.completion_tokens || 0 },
            messagesCreated: { increment: conversationId ? 2 : 0 },
            updatedAt: new Date(),
          },
          create: {
            userId: userId,
            date: today,
            modelId: "_total",
            modelProvider: null,
            apiCalls: 1,
            successfulCalls: 1,
            totalTokens: tokenUsage.total_tokens || 0,
            promptTokens: tokenUsage.prompt_tokens || 0,
            completionTokens: tokenUsage.completion_tokens || 0,
            messagesCreated: conversationId ? 2 : 0,
          }
        })

        // 2. 新增按模型分组统计
        const modelProvider = getModelProvider(useModel)
        
        await prisma.usageStats.upsert({
          where: {
            userId_date_modelId: {
              userId: userId,
              date: today,
              modelId: useModel
            }
          },
          update: {
            apiCalls: { increment: 1 },
            successfulCalls: { increment: 1 },
            totalTokens: { increment: tokenUsage.total_tokens || 0 },
            promptTokens: { increment: tokenUsage.prompt_tokens || 0 },
            completionTokens: { increment: tokenUsage.completion_tokens || 0 },
            messagesCreated: { increment: conversationId ? 2 : 0 },
            updatedAt: new Date(),
          },
          create: {
            userId: userId,
            date: today,
            modelId: useModel,
            modelProvider: modelProvider,
            apiCalls: 1,
            successfulCalls: 1,
            totalTokens: tokenUsage.total_tokens || 0,
            promptTokens: tokenUsage.prompt_tokens || 0,
            completionTokens: tokenUsage.completion_tokens || 0,
            messagesCreated: conversationId ? 2 : 0,
          }
        })

      } catch (error) {
        // 不抛出错误，避免影响用户体验
      }
    }

    return new Response(upstream.body.pipeThrough(transformStream), { 
      status: 200, 
      headers 
    })
    
    
  } catch (error: any) {
    // 无论是否有对话ID，只要识别到用户，就记录失败统计
    if (userId) {
      try {
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)

        await prisma.usageStats.upsert({
          where: {
            userId_date_modelId: {
              userId: userId,
              date: today,
              modelId: "_total"
            }
          },
          update: {
            apiCalls: { increment: 1 },
            failedCalls: { increment: 1 },
            updatedAt: new Date(),
          },
          create: {
            userId: userId,
            date: today,
            modelId: "_total",
            apiCalls: 1,
            failedCalls: 1,
          }
        })
      } catch (dbError) {
        console.error('Failed to record failed call stats:', dbError)
      }
    }
    
    const payload = { error: error?.message || "请求处理失败" }
    return new Response(JSON.stringify(payload), { status: 500, headers: { "Content-Type": "application/json" } })
  } finally {
    const cost = Date.now() - startedAt
    console.debug('Request completed in', cost, 'ms')
  }
}
