/**
 * 聊天相关API的Zod校验模式
 * Linus原则：一处定义，处处复用
 */

import { z } from 'zod'

// 基础消息格式校验
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, '消息内容不能为空').max(50000, '单条消息不能超过50000字符'),
  id: z.string().optional(),
  timestamp: z.number().optional(),
  metadata: z.record(z.any()).optional()
})

// 聊天请求校验
export const chatRequestSchema = z.object({
  conversationId: z.string().uuid('对话ID格式错误').optional(),
  messages: z.array(chatMessageSchema)
    .min(1, '至少需要一条消息')
    .max(200, '单次请求不能超过200条消息'),
  model: z.string().min(1, '模型ID不能为空').optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(8192).optional()
})

// 对话创建请求校验
export const createConversationSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过200字符').optional(),
  modelId: z.string().min(1, '模型ID不能为空').optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(8192).optional(),
  contextAware: z.boolean().optional()
})

// 对话查询参数校验
export const conversationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, '页码必须是数字').transform(Number).refine(n => n >= 1, '页码必须大于0').optional(),
  limit: z.string().regex(/^\d+$/, '限制数必须是数字').transform(Number).refine(n => n >= 1 && n <= 100, '限制数必须在1-100之间').optional(),
  includeMessages: z.string().transform(s => s === 'true').optional()
})

// 通用UUID校验
export const uuidSchema = z.string().uuid('ID格式错误')

// 用户ID校验（NextAuth的sub字段可能不是标准UUID）
export const userIdSchema = z.string().min(1, '用户ID不能为空')

// 导出类型
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type ChatRequest = z.infer<typeof chatRequestSchema>
export type CreateConversationRequest = z.infer<typeof createConversationSchema>
export type ConversationQuery = z.infer<typeof conversationQuerySchema>