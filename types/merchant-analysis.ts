/**
 * 商家分析模块相关类型定义
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

// ===== AI深度分析相关类型 =====

/**
 * AI深度分析报告结构
 * 基于短视频转录文本生成的详细商家分析
 */
export interface AIDeepAnalysisReport {
  merchantId: string
  merchantName: string
  analysisDate: string

  // 1. 基本信息
  basicInfo: {
    merchantName: string
    mainBusiness: string // 主营业务
    coreProducts: string[] // 核心产品/服务
    businessModel: string // 业务模式描述
  }

  // 2. 内容策略
  contentStrategy: {
    videoContentTypes: string[] // 视频内容类型（如：产品展示、工艺科普、客户案例等）
    publishFrequency: string // 发布频率
    presentationStyle: string[] // 表现形式（如：现场实拍、对比演示、数据展示等）
    keyThemes: string[] // 核心主题
  }

  // 3. 优势与保障
  advantages: {
    costAdvantage?: string // 成本与价格优势
    convenience?: string[] // 便捷性（如：一站式服务、全国配送等）
    customization?: string // 定制化能力
    qualityAssurance?: string[] // 品质保障（如：官方授权、质量承诺等）
  }

  // 4. 营销策略
  marketingStrategy: {
    trustBuilding: string[] // 信任建立方式（如：官方授权展示、客户案例等）
    differentiation: string[] // 差异化竞争点
    conversionPath: string[] // 转化路径（如：评论区留言、私信咨询等）
    promotionTactics: string[] // 促销手段
  }

  // 5. 内容表现手法
  contentTechniques: {
    visualPresentation: string[] // 视觉呈现（如：工厂实景、产品细节等）
    languageStyle: string[] // 语言风格（如：直接喊话、数据说服等）
    interactionDesign: string[] // 互动设计（如：提问引导、评论区答疑等）
    emotionalAppeal: string[] // 情感诉求点
  }

  // 6. 受众特点
  audience: {
    primaryRegions: string[] // 主要地域
    coreNeeds: string[] // 核心需求
    consumerPsychology: string[] // 消费心理（如：规避风险、追求性价比等）
    painPoints: string[] // 痛点
  }

  // 7. 爆款文案结构分析
  viralContentPatterns: Array<{
    patternType: string // 文案类型（如：秀肌肉型、痛点解决型、价值科普型）
    structure: {
      hook: string // 钩子（0-3秒）
      coreContent: string // 核心内容（3-20秒）
      callToAction: string // 行动号召（结尾）
    }
    examples: string[] // 实际案例
    effectiveness: string // 效果评估
  }>

  // 8. 关键洞察
  keyInsights: {
    strengthsAnalysis: string[] // 优势分析
    improvementSuggestions: string[] // 改进建议
    contentRecommendations: string[] // 内容创作建议
    competitiveEdge: string[] // 竞争优势
  }

  // 9. 数据支持
  dataSupport: {
    contentCount: number // 分析的内容数量
    avgEngagement: number // 平均互动量
    topPerformingContents: Array<{
      title: string
      engagement: number
      keyTakeaways: string[] // 关键要点
    }>
  }

  // AI生成元数据
  aiMetadata: {
    model: string // 使用的AI模型
    analysisTokens: number // 分析使用的token数
    confidence: number // 分析置信度（0-1）
    processingTime: number // 处理时间（秒）
  }
}

/**
 * AI分析请求参数
 */
export interface AIAnalysisRequest {
  merchantId: string
  merchantName: string
  transcripts: Array<{
    title: string
    content: string
    engagement: {
      diggCount: number
      commentCount: number
      collectCount: number
      shareCount: number
    }
  }>
  basicStats: {
    category?: string
    location?: string
    businessType: string
    totalContentCount: number
    totalEngagement: number
  }
  analysisDepth?: 'basic' | 'detailed' | 'comprehensive' // 分析深度
}

/**
 * AI分析响应
 */
export interface AIAnalysisResponse {
  success: boolean
  report?: AIDeepAnalysisReport
  error?: string
  warnings?: string[] // 警告信息（如：转录文本不足等）
}