import * as dt from '@/lib/utils/date-toolkit'

/**
 * 模型统计辅助工具函数
 * 用于提取模型提供商信息和统计相关功能
 */

/**
 * 根据模型ID提取模型提供商
 */
export function getModelProvider(modelId: string): string {
  if (!modelId) return 'Unknown'
  
  const modelLower = modelId.toLowerCase()
  
  // Claude模型
  if (modelLower.includes('claude')) {
    return 'Claude'
  }
  
  // Gemini模型  
  if (modelLower.includes('gemini')) {
    return 'Google'
  }
  
  // OpenAI模型
  if (modelLower.includes('gpt') || modelLower.includes('text-davinci') || modelLower.includes('text-ada')) {
    return 'OpenAI'
  }
  
  return 'Unknown'
}

/**
 * 判断是否为已知的AI模型
 */
export function isKnownModel(modelId: string): boolean {
  return getModelProvider(modelId) !== 'Unknown'
}

/**
 * 获取模型的友好显示名称
 */
export function getModelDisplayName(modelId: string): string {
  const modelNameMap: Record<string, string> = {
    'claude-opus-4-1-20250805': 'Claude Opus 4.1',
    'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
    'claude-3-opus': 'Claude 3 Opus',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-1.5-pro': 'Gemini 1.5 Pro',
    'gpt-4': 'GPT-4',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo'
  }
  
  return modelNameMap[modelId] || modelId
}

/**
 * 创建统一的今日日期对象（UTC归零）
 */
export function getTodayDate(): Date {
  const today = dt.now()
  today.setUTCHours(0, 0, 0, 0)
  return today
}

/**
 * 获取提供商的品牌颜色
 */
export function getProviderColor(provider: string): string {
  const colorMap: Record<string, string> = {
    'Claude': '#FF6B35',     // Anthropic橙色
    'Google': '#4285F4',     // Google蓝色
    'OpenAI': '#74AA9C',     // OpenAI绿色
    'Unknown': '#6B7280'     // 灰色
  }
  
  return colorMap[provider] || colorMap['Unknown']
}

/**
 * 获取提供商的图标名称（用于UI组件）
 */
export function getProviderIcon(provider: string): string {
  const iconMap: Record<string, string> = {
    'Claude': 'brain',       // 或其他合适的图标
    'Google': 'search',      // Google相关图标
    'OpenAI': 'zap',         // AI/Lightning图标
    'Unknown': 'help-circle' // 问号图标
  }
  
  return iconMap[provider] || iconMap['Unknown']
}

/**
 * 格式化统计数字显示
 */
export function formatStatsNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

/**
 * 计算使用量百分比
 */
export function calculateUsagePercentage(
  modelUsage: number,
  totalUsage: number
): number {
  if (totalUsage === 0) return 0
  return Math.round((modelUsage / totalUsage) * 100)
}