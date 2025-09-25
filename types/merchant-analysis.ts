/**
 * 商家分析模块相关类型定义
 * 注意：商家分析功能正在开发中，相关数据模型尚未完成
 */

// 临时类型定义，待数据模型完成后替换
export type ReportStatus = 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type ContentGenType = 'MARKETING' | 'SOCIAL_MEDIA' | 'EMAIL' | 'OTHER'
export type GenerationStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'

export interface MerchantAnalysisReport {
  id: string
  merchantId: string
  title: string
  status: ReportStatus
  createdAt: Date
  updatedAt: Date
}

export interface AIGeneratedContent {
  id: string
  reportId: string
  type: ContentGenType
  content: string
  status: GenerationStatus
  createdAt: Date
}

// 请求/响应类型
export interface GenerateContentRequest {
  merchantId: string
  reportId?: string
  type: ContentGenType
  title: string
  customPrompt?: string
  style?: string
  length?: string
  targetAudience?: string
  includeCallToAction?: boolean
  keywords?: string[]
}

export interface GenerateContentResponse {
  success: boolean
  content?: AIGeneratedContent
  error?: string
}