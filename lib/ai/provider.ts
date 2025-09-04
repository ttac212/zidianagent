import { createOpenAI } from '@ai-sdk/openai'

// 302.AI OpenAI 兼容 Provider
// 注意：API Key 仅在服务端使用，不要在客户端引用本文件
export const openai = createOpenAI({
  baseURL: process.env.LLM_API_BASE,
  apiKey: process.env.LLM_API_KEY,
})

