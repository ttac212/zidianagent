/**
 * TikHub API 类型定义
 */

/**
 * API基础响应
 */
export interface TikHubBaseResponse<T = any> {
  code: number
  message: string
  data: T
}

/**
 * 抖音用户资料响应
 */
export interface DouyinUserProfile {
  uid: string
  sec_uid: string
  unique_id: string
  nickname: string
  signature: string
  avatar_thumb: {
    url_list: string[]
  }
  avatar_larger: {
    url_list: string[]
  }
  follower_count: number
  following_count: number
  total_favorited: number
  aweme_count: number
  favoriting_count: number
  location: string
  province: string
  city: string
  district: string
  gender: number // 0: 未知, 1: 男, 2: 女
  birthday: string
  ip_location: string
  custom_verify: string
  enterprise_verify_reason: string
  is_enterprise_vip: boolean
  verification_type: number
  verification_badge_url: string[]
  school_name: string
  live_agreement: number
  live_commerce: boolean
  forward_count: number
  [key: string]: any
}

/**
 * 抖音视频信息
 */
export interface DouyinVideo {
  aweme_id: string
  desc: string
  create_time: number
  author: {
    uid: string
    sec_uid: string
    nickname: string
    unique_id: string
  }
  music: {
    id: string
    title: string
    author: string
    duration: number
  }
  statistics: {
    aweme_id: string
    comment_count: number
    digg_count: number
    download_count: number
    play_count: number
    share_count: number
    collect_count: number
    forward_count: number
  }
  video: {
    play_addr: {
      url_list: string[]
    }
    cover: {
      url_list: string[]
    }
    dynamic_cover: {
      url_list: string[]
    }
    duration: number
    width: number
    height: number
    ratio: string
  }
  share_url: string
  text_extra: Array<{
    hashtag_name: string
    hashtag_id: string
    type: number
  }>
  video_tag: Array<{
    tag_id: string
    tag_name: string
  }>
  rate: number
  [key: string]: any
}

/**
 * 用户视频列表响应
 */
export interface DouyinUserVideosResponse {
  aweme_list: DouyinVideo[]
  max_cursor: number
  min_cursor: number
  has_more: boolean
  status_code: number
}

/**
 * 单个视频详情响应
 */
export interface DouyinVideoDetailResponse {
  aweme_detail: DouyinVideo
  status_code: number
}

/**
 * 用户搜索结果
 */
export interface DouyinUserSearchResult {
  user_list: Array<{
    user_info: DouyinUserProfile
  }>
  has_more: boolean
  cursor: number
}

/**
 * TikHub用户信息
 */
export interface TikHubUserInfo {
  user_id: string
  username: string
  email: string
  balance: number
  total_requests: number
  daily_requests: number
  plan: 'free' | 'basic' | 'pro' | 'enterprise'
  created_at: string
  expired_at: string
}

/**
 * TikHub每日使用情况
 */
export interface TikHubDailyUsage {
  date: string
  total_requests: number
  successful_requests: number
  failed_requests: number
  total_cost: number
  endpoints: Record<string, number>
}

/**
 * TikHub价格计算响应
 */
export interface TikHubPriceCalculation {
  base_price: number
  discount: number
  final_price: number
  currency: string
}

/**
 * API请求配置
 */
export interface TikHubRequestConfig {
  endpoint: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Record<string, any>
  body?: any
  headers?: Record<string, string>
  timeout?: number
  retries?: number
}

/**
 * API错误类型
 */
export interface TikHubApiError {
  code: number
  message: string
  endpoint: string
  timestamp: number
  details?: any
}

/**
 * 请求参数 - 获取用户资料
 */
export interface GetUserProfileParams {
  sec_uid: string
}

/**
 * 请求参数 - 获取用户视频列表
 */
export interface GetUserVideosParams {
  sec_uid: string
  max_cursor?: number
  count?: number // 每页数量，默认20
}

/**
 * 请求参数 - 获取单个视频
 */
export interface GetVideoDetailParams {
  aweme_id: string
}

/**
 * 请求参数 - 搜索用户
 */
export interface SearchUserParams {
  keyword: string
  offset?: number
  count?: number
}

/**
 * 商家数据同步任务
 */
export interface MerchantSyncTask {
  taskId: string
  merchantUid: string
  merchantName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  totalVideos: number
  processedVideos: number
  errors: string[]
  result?: {
    newVideos: number
    updatedVideos: number
    totalCost: number
  }
}

/**
 * 批量同步配置
 */
export interface BatchSyncConfig {
  merchantUids: string[]
  maxConcurrent: number
  includeTranscript?: boolean
  dateFrom?: Date
  dateTo?: Date
  onProgress?: (task: MerchantSyncTask) => void
  onComplete?: (results: MerchantSyncTask[]) => void
}
