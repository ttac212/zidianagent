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