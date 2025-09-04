/**
 * 模型显示名称工具函数
 * 统一管理模型ID到友好名称的映射
 */

import { ALLOWED_MODELS } from '@/lib/ai/models'

/**
 * 获取模型的友好显示名称
 * @param modelId 模型ID
 * @returns 友好显示名称
 */
export function getModelDisplayName(modelId?: string): string {
  if (!modelId) return ''
  
  // 首先从项目配置中查找
  const configModel = ALLOWED_MODELS.find(m => m.id === modelId)
  if (configModel) {
    return configModel.name
  }
  
  // 兜底的常见模型名称映射
  const fallbackMap: { [key: string]: string } = {
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4': 'GPT-4',
    'gpt-3.5-turbo': 'GPT-3.5',
    'claude-3-opus': 'Claude 3 Opus',
    'claude-3-sonnet': 'Claude 3 Sonnet',
    'claude-3-haiku': 'Claude 3 Haiku',
    'claude-opus-4-1-20250805': 'Claude Opus 4.1',
    'gemini-2.5-pro': 'Gemini 2.5 Pro'
  }
  
  return fallbackMap[modelId] || modelId
}

/**
 * 获取模型的供应商信息
 * @param modelId 模型ID
 * @returns 供应商信息
 */
export function getModelProvider(modelId?: string): { name: string; color: string; emoji: string } {
  if (!modelId) return { name: 'Unknown', color: 'gray', emoji: '🤖' }
  
  if (modelId.includes('claude')) {
    return { name: 'Claude', color: 'orange', emoji: '🧠' }
  }
  
  if (modelId.includes('gpt') || modelId.includes('openai')) {
    return { name: 'OpenAI', color: 'green', emoji: '⚡' }
  }
  
  if (modelId.includes('gemini') || modelId.includes('google')) {
    return { name: 'Google', color: 'blue', emoji: '💎' }
  }
  
  return { name: 'Unknown', color: 'gray', emoji: '🤖' }
}