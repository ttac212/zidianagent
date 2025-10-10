/**
 * TikHub API 配置
 *
 * 文档: https://docs.tikhub.io
 * Swagger UI: https://api.tikhub.io
 */

export const TIKHUB_CONFIG = {
  // API基础URL
  baseURL: process.env.TIKHUB_API_BASE_URL || 'https://api.tikhub.io',

  // API密钥（从环境变量获取）
  apiKey: process.env.TIKHUB_API_KEY || '',

  // 请求超时时间（毫秒）
  timeout: 60000,

  // 最大重试次数
  maxRetries: 3,

  // 重试延迟（毫秒）
  retryDelay: 1000,

  // 并发请求限制
  maxConcurrent: 5,

  // 定价配置（每次请求费用，单位：美元）
  pricing: {
    basePrice: 0.001, // 基础价格
    successOnly: true, // 仅在状态码200时收费
  },
} as const

/**
 * TikHub API端点
 */
export const TIKHUB_ENDPOINTS = {
  // 抖音用户相关
  douyin: {
    // 获取用户资料
    getUserProfile: '/api/v1/douyin/app/v3/fetch_user_profile',

    // 获取用户视频列表
    getUserVideos: '/api/v1/douyin/app/v3/fetch_user_post_videos',

    // 获取单个视频详情
    getVideoDetail: '/api/v1/douyin/app/v1/fetch_one_video',

    // 搜索用户
    searchUser: '/api/v1/douyin/web/fetch_user_search_result',

    // 获取用户粉丝数据
    getUserFollowers: '/api/v1/douyin/app/v3/fetch_user_follower_list',

    // 获取用户关注列表
    getUserFollowing: '/api/v1/douyin/app/v3/fetch_user_following_list',
  },

  // TikHub用户API
  user: {
    // 获取用户信息
    getUserInfo: '/api/v1/tikhub/user/get_user_info',

    // 获取每日使用情况
    getDailyUsage: '/api/v1/tikhub/user/get_user_daily_usage',

    // 计算价格
    calculatePrice: '/api/v1/tikhub/user/calculate_price',
  },
} as const

/**
 * 错误码映射
 */
export const TIKHUB_ERROR_CODES = {
  // 认证错误
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,

  // 限流错误
  RATE_LIMIT: 429,

  // 资源不存在
  NOT_FOUND: 404,

  // 服务器错误
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,

  // 请求错误
  BAD_REQUEST: 400,

  // 成功
  SUCCESS: 200,
} as const

/**
 * 请求限制配置
 */
export const RATE_LIMITS = {
  // 每秒最大请求数
  requestsPerSecond: 10,

  // 每分钟最大请求数
  requestsPerMinute: 300,

  // 每天最大请求数（根据定价层级）
  requestsPerDay: {
    free: 100,
    basic: 1000,
    pro: 10000,
    enterprise: 100000,
  },
} as const

/**
 * 定价折扣层级
 * 根据TikHub文档的分级折扣系统
 */
export const PRICING_TIERS = [
  { minRequests: 0, maxRequests: 999, discount: 0 },
  { minRequests: 1000, maxRequests: 4999, discount: 0.1 },
  { minRequests: 5000, maxRequests: 9999, discount: 0.2 },
  { minRequests: 10000, maxRequests: 49999, discount: 0.3 },
  { minRequests: 50000, maxRequests: 99999, discount: 0.4 },
  { minRequests: 100000, maxRequests: Infinity, discount: 0.5 },
] as const
