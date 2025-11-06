/**
 * 商家数据相关类型定义
 */

import type { 
  Merchant as PrismaMerchant,
  MerchantCategory as PrismaMerchantCategory,
  MerchantContent as PrismaMerchantContent,
  BusinessType,
  MerchantStatus,
  ContentType
} from '@prisma/client'

// 商家分类类型
export type MerchantCategory = PrismaMerchantCategory & {
  _count?: {
    merchants: number
  }
}

// 商家内容类型
export type MerchantContent = PrismaMerchantContent & {
  parsedTags?: string[]
  parsedTextExtra?: string[]
}

// 商家详细信息类型
export type MerchantWithDetails = PrismaMerchant & {
  category?: MerchantCategory | null
  contents?: MerchantContent[]
  _count?: {
    contents: number
  }
}

// 商家列表项类型（用于列表显示）
export type MerchantListItem = {
  id: string
  uid: string
  name: string
  description?: string | null
  location?: string | null
  businessType: BusinessType
  status: MerchantStatus
  totalContentCount: number
  totalDiggCount: number
  totalCommentCount: number
  totalCollectCount: number
  totalShareCount: number
  lastCollectedAt?: Date | null
  createdAt: Date
  category?: {
    id: string
    name: string
    color?: string | null
    icon?: string | null
  } | null
}

// 商家统计数据类型
export type MerchantStats = {
  totalMerchants: number
  activeCount: number
  inactiveCount: number
  totalContent: number
  totalEngagement: number
  categories: Array<{
    name: string
    count: number
    color?: string | null
  }>
  locations: Array<{
    name: string
    count: number
  }>
  businessTypes: Array<{
    type: BusinessType
    count: number
  }>
}

// 商家搜索过滤器
export type MerchantFilters = {
  search?: string
  categoryId?: string
  location?: string
  businessType?: BusinessType
  status?: MerchantStatus
  sortBy?: 'name' | 'createdAt' | 'totalContentCount' | 'totalEngagement'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// 内容搜索过滤器
export type ContentFilters = {
  merchantId?: string
  contentType?: ContentType
  search?: string
  dateFrom?: Date
  dateTo?: Date
  hasTranscript?: boolean
  minEngagement?: number
  sortBy?: 'publishedAt' | 'diggCount' | 'commentCount' | 'collectCount'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// API响应类型
export type MerchantListResponse = {
  merchants: MerchantListItem[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export type MerchantDetailResponse = {
  merchant: MerchantWithDetails
}

export type MerchantStatsResponse = {
  stats: MerchantStats
}

export type ContentListResponse = {
  contents: MerchantContent[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// 表单数据类型
export type CreateMerchantData = {
  name: string
  description?: string
  categoryId?: string
  location?: string
  address?: string
  businessType: BusinessType
  contactInfo?: any
}

export type UpdateMerchantData = Partial<CreateMerchantData> & {
  status?: MerchantStatus
  isVerified?: boolean
}

// 导出枚举类型
export { BusinessType, MerchantStatus, ContentType }

// 常量定义
export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  B2B: 'B2B (企业对企业)',
  B2C: 'B2C (企业对消费者)',
  B2B2C: 'B2B2C (混合模式)'
}

export const MERCHANT_STATUS_LABELS: Record<MerchantStatus, string> = {
  ACTIVE: '正常',
  INACTIVE: '停用',
  SUSPENDED: '暂停',
  DELETED: '已删除'
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  VIDEO: '视频',
  ARTICLE: '文章',
  IMAGE: '图片',
  AUDIO: '音频',
  OTHER: '其他'
}

// 工具函数类型
export type ParsedContent = MerchantContent & {
  parsedTags: string[]
  parsedTextExtra: string[]
  engagementScore: number
}

// 颜色主题配置
export const CATEGORY_COLORS = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
] as const

// ============= 商家创作档案相关类型 =============

// 商家Brief结构(PART 1)
export interface ProfileBrief {
  intro: string                    // 3句话介绍(字符串格式)
  sellingPoints: string[]          // 核心卖点
  usageScenarios: string[]         // 使用场景和痛点
  audienceProfile: {               // 目标用户画像
    age: string
    gender: string
    interests: string[]
    behaviors: string
  }
  brandTone: string                // 品牌调性
}

// 爆款分析结构(PART 2)
export interface ProfileViralAnalysis {
  topContents: Array<{
    rank: number
    title: string
    opening: string
    emotionType: string            // 笑点/痛点/爽点/知识点
    format: string                 // 口播/剧情/对比/教程/探店
    engagement: number
  }>
  goldenThreeSeconds: string[]     // 黄金3秒开头模板
  emotionalTriggers: Record<string, number>  // 情绪点百分比
  contentFormats: Record<string, number>     // 内容形式百分比
}

// 创作指南结构(PART 3)
export interface ProfileCreativeGuide {
  trendingTopics: string[]         // 热门话题
  tagStrategy: string | any         // 标签组合策略(完整说明，兼容对象格式)
  publishingTips: {
    bestTime: string
    frequency: string
  }
}

// 商家档案完整类型
export interface MerchantProfile {
  id: string
  merchantId: string

  // PART 1: 商家Brief
  briefIntro?: string | null
  briefSellingPoints?: string | null     // JSON字符串
  briefUsageScenarios?: string | null    // JSON字符串
  briefAudienceProfile?: string | null   // JSON字符串
  briefBrandTone?: string | null

  // PART 2: 爆款分析
  topContentAnalysis?: string | null     // JSON字符串
  goldenThreeSeconds?: string | null     // JSON字符串
  emotionalTriggers?: string | null      // JSON字符串
  contentFormats?: string | null         // JSON字符串

  // PART 3: 创作指南
  trendingTopics?: string | null         // JSON字符串
  tagStrategy?: string | null            // JSON字符串
  publishingTips?: string | null         // JSON字符串

  // 元数据
  aiGeneratedAt?: Date | string | null
  aiModelUsed?: string | null
  aiTokenUsed: number

  // 用户编辑部分
  customBackground?: string | null
  customOfflineInfo?: string | null
  customProductDetails?: string | null
  customDosAndDonts?: string | null

  createdAt: Date | string
  updatedAt: Date | string
}

// 解析后的档案类型(前端使用)
export interface ParsedMerchantProfile extends Omit<
  MerchantProfile,
  'briefSellingPoints' | 'briefUsageScenarios' | 'briefAudienceProfile' |
  'topContentAnalysis' | 'goldenThreeSeconds' | 'emotionalTriggers' |
  'contentFormats' | 'trendingTopics' | 'tagStrategy' | 'publishingTips'
> {
  // 解析后的JSON字段
  brief?: ProfileBrief | null
  viralAnalysis?: ProfileViralAnalysis | null
  creativeGuide?: ProfileCreativeGuide | null
}

// 档案API响应类型
export interface MerchantProfileResponse {
  profile: MerchantProfile | null
  merchant: {
    id: string
    name: string
    totalContentCount: number
  }
}

export interface GenerateProfileResponse {
  profile: MerchantProfile
  tokensUsed: number
  model: string
}

// 档案更新数据类型
export interface UpdateProfileData {
  customBackground?: string
  customOfflineInfo?: string
  customProductDetails?: string
  customDosAndDonts?: string
}

// AI生成档案的原始响应结构
export interface AIProfileResponse {
  brief: ProfileBrief
  viralAnalysis: ProfileViralAnalysis
  creativeGuide: ProfileCreativeGuide
}