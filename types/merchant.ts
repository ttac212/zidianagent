/**
 * 商家数据相关类型定义
 */

import type { 
  Merchant as PrismaMerchant,
  MerchantCategory as PrismaMerchantCategory,
  MerchantContent as PrismaMerchantContent,
  MerchantContentComment as PrismaMerchantContentComment,
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
export type MerchantContentComment = PrismaMerchantContentComment

export type MerchantContent = PrismaMerchantContent & {
  parsedTags?: string[]
  parsedTextExtra?: string[]
  comments?: MerchantContentComment[]
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
  lastCollectedAt?: Date | string | null  // JSON API返回字符串
  createdAt: Date | string  // JSON API返回字符串
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
  sortBy?: 'publishedAt' | 'diggCount' | 'commentCount' | 'collectCount' | 'shareCount' | 'engagement'
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

// 商家Brief结构
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

// 商家档案完整类型
export interface MerchantProfile {
  id: string
  merchantId: string

  // PART 1: 商家Brief（创作简报）
  briefIntro?: string | null
  briefSellingPoints?: string | null     // JSON字符串
  briefUsageScenarios?: string | null    // JSON字符串
  briefAudienceProfile?: string | null   // JSON字符串
  briefBrandTone?: string | null
  // 人工校对版 Brief（完整结构化JSON，优先展示）
  // 注意：从 Prisma 返回时可能是 JsonValue，需要类型断言
  manualBrief?: ProfileBrief | null | any

  // 元数据
  aiGeneratedAt?: Date | string | null
  aiModelUsed?: string | null
  aiTokenUsed: number

  // 用户编辑部分
  customBackground?: string | null
  customOfflineInfo?: string | null
  customProductDetails?: string | null
  customDosAndDonts?: string | null
  // 人工补充信息（实地沟通高频问题）
  manualNotes?: string | null

  createdAt: Date | string
  updatedAt: Date | string
}

// 解析后的档案类型(前端使用)
export interface ParsedMerchantProfile extends Omit<
  MerchantProfile,
  'briefSellingPoints' | 'briefUsageScenarios' | 'briefAudienceProfile'
> {
  // 解析后的JSON字段
  brief?: ProfileBrief | null
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
  manualNotes?: string
  manualBrief?: ProfileBrief
}

// AI生成档案的原始响应结构
export interface AIProfileResponse {
  brief: ProfileBrief
}

export interface MerchantProfileVersion {
  id: string
  merchantId: string
  profileId?: string | null
  snapshot: any
  source: string
  createdAt: string | Date
}

// ============= 商家对标账号相关类型 =============

// 对标账号关联信息
export interface MerchantBenchmark {
  id: string
  notes: string | null
  createdAt: Date | string
  updatedAt: Date | string
  benchmark: MerchantWithDetails
}

// 对标账号列表响应
export interface MerchantBenchmarksResponse {
  benchmarks: MerchantBenchmark[]
}

// 添加对标账号请求
export interface AddBenchmarkData {
  benchmarkId: string
  notes?: string
}

// 删除对标账号请求
export interface RemoveBenchmarkData {
  benchmarkId: string
}

// ============= 商家客群分析 =============

export interface AudienceAnalysisProgress {
  step: string
  status: string
  percentage: number
  label: string
  detail?: string
}

export interface LocationStat {
  location: string
  count: number
  percentage: number
}

type AudienceAnalysisStructuredFields = {
  audienceProfile: Record<string, any> | null
  demographics: Record<string, any> | null
  behaviors: Record<string, any> | null
  interests: Record<string, any> | null
  painPoints: Record<string, any> | null
  suggestions: Record<string, any> | null
}

export interface AudienceAnalysisResult extends AudienceAnalysisStructuredFields {
  analysisId: string
  markdown: string
  rawMarkdown: string
  manualMarkdown?: string | null
  manualInsights?: Record<string, any> | null
  videosAnalyzed: number
  commentsAnalyzed: number
  locationStats: LocationStat[]
  modelUsed: string
  tokenUsed: number
  analyzedAt: string
}

export interface AudienceAnalysisData extends AudienceAnalysisStructuredFields {
  id: string
  merchantId: string
  videosAnalyzed: number
  commentsAnalyzed: number
  videoIds: string[]
  locationStats: LocationStat[] | null
  rawMarkdown: string | null
  manualMarkdown?: string | null
  manualInsights?: Record<string, any> | null
  analyzedAt: string
  modelUsed: string
  tokenUsed: number
}

export interface MerchantAudienceAnalysisVersion {
  id: string
  merchantId: string
  analysisId?: string | null
  snapshot: any
  source: string
  createdAt: string | Date
}
