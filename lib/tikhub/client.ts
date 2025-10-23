/**
 * TikHub API Client
 *
 * TypeScript客户端，用于与TikHub API交互
 * 文档: https://docs.tikhub.io
 */

import { TIKHUB_CONFIG, TIKHUB_ERROR_CODES } from './config'
import { CircuitBreaker } from '@/lib/utils/retry'
import type {
  TikHubBaseResponse,
  TikHubRequestConfig,
  TikHubApiError,
  DouyinUserProfile,
  DouyinUserVideosResponse,
  DouyinVideoDetailResponse,
  DouyinUserSearchResult,
  TikHubUserInfo,
  TikHubDailyUsage,
  TikHubPriceCalculation,
  GetUserProfileParams,
  GetUserVideosParams,
  GetVideoDetailParams,
  SearchUserParams,
  DouyinVideoCommentsResponse,
  GetVideoCommentsParams,
  DouyinVideoStatisticsResponse,
  GetVideoStatisticsParams,
  DouyinCommentWordCloudResponse,
  GetCommentWordCloudParams,
} from './types'

/**
 * TikHub API客户端类
 */
export class TikHubClient {
  private apiKey: string
  private baseURL: string
  private timeout: number
  private maxRetries: number
  private retryDelay: number
  private circuitBreaker: CircuitBreaker | null

  constructor(config?: {
    apiKey?: string
    baseURL?: string
    timeout?: number
    maxRetries?: number
    retryDelay?: number
    /** 启用熔断器保护（默认开启） */
    enableCircuitBreaker?: boolean
  }) {
    this.apiKey = config?.apiKey || TIKHUB_CONFIG.apiKey
    this.baseURL = config?.baseURL || TIKHUB_CONFIG.baseURL
    this.timeout = config?.timeout || TIKHUB_CONFIG.timeout
    this.maxRetries = config?.maxRetries || TIKHUB_CONFIG.maxRetries
    this.retryDelay = config?.retryDelay || TIKHUB_CONFIG.retryDelay

    // 默认启用熔断器
    const enableBreaker = config?.enableCircuitBreaker ?? true
    this.circuitBreaker = enableBreaker
      ? new CircuitBreaker({
          failureThreshold: 5,
          resetTimeout: 60000, // 1分钟后尝试恢复
          name: 'TikHub'
        })
      : null

    if (!this.apiKey) {
      throw new Error('TikHub API key is required. Set TIKHUB_API_KEY in environment variables.')
    }
  }

  /**
   * 发起HTTP请求（带熔断器保护）
   */
  private async request<T = any>(
    config: TikHubRequestConfig,
    retryCount = 0
  ): Promise<TikHubBaseResponse<T>> {
    // 如果启用了熔断器，通过熔断器执行请求
    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(() => this._requestInternal<T>(config, retryCount))
    }

    return this._requestInternal<T>(config, retryCount)
  }

  /**
   * 实际的HTTP请求实现
   */
  private async _requestInternal<T = any>(
    config: TikHubRequestConfig,
    retryCount = 0
  ): Promise<TikHubBaseResponse<T>> {
    const {
      endpoint,
      method = 'GET',
      params,
      body,
      headers = {},
      timeout = this.timeout,
    } = config

    // 构建URL
    const url = new URL(endpoint, this.baseURL)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    // 构建请求头
    const requestHeaders: HeadersInit = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...headers,
    }

    // 创建AbortController用于超时控制
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // 解析响应
      const data: TikHubBaseResponse<T> = await response.json()

      // 检查响应状态
      if (response.status === TIKHUB_ERROR_CODES.SUCCESS) {
        return data
      }

      // 处理错误响应
      const error: TikHubApiError = {
        code: response.status,
        message: data.message || response.statusText,
        endpoint,
        timestamp: Date.now(),
        details: data,
      }

      // 可重试的错误
      const retryableErrors = [
        TIKHUB_ERROR_CODES.RATE_LIMIT,
        TIKHUB_ERROR_CODES.SERVER_ERROR,
        TIKHUB_ERROR_CODES.SERVICE_UNAVAILABLE,
      ]

      const isRetryable = retryableErrors.includes(
        response.status as (typeof retryableErrors)[number]
      )

      if (isRetryable && retryCount < this.maxRetries) {
        // 计算退避延迟
        const delay = this.retryDelay * Math.pow(2, retryCount)
        await this.sleep(delay)
        return this._requestInternal<T>(config, retryCount + 1)
      }

      throw error
    } catch (err: any) {
      clearTimeout(timeoutId)

      // 超时或网络错误，尝试重试
      if (err.name === 'AbortError' || err.name === 'TypeError') {
        if (retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount)
          await this.sleep(delay)
          return this._requestInternal<T>(config, retryCount + 1)
        }
      }

      // 如果是TikHubApiError，直接抛出
      if ('code' in err && 'endpoint' in err) {
        throw err
      }

      // 包装其他错误
      const error: TikHubApiError = {
        code: 0,
        message: err.message || 'Unknown error',
        endpoint,
        timestamp: Date.now(),
        details: err,
      }
      throw error
    }
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 获取抖音用户资料
   */
  async getUserProfile(params: GetUserProfileParams): Promise<DouyinUserProfile> {
    if (!params.sec_uid) {
      throw new Error('sec_uid is required to fetch user profile.')
    }

    const { sec_uid, ...restParams } = params
    const response = await this.request<DouyinUserProfile>({
      endpoint: '/api/v1/douyin/app/v3/fetch_user_profile',
      params: {
        ...restParams,
        sec_user_id: sec_uid,
      },
    })
    return response.data
  }

  /**
   * 获取用户视频列表
   */
  async getUserVideos(params: GetUserVideosParams): Promise<DouyinUserVideosResponse> {
    if (!params.sec_uid) {
      throw new Error('sec_uid is required to fetch user videos.')
    }

    const { sec_uid, count, ...restParams } = params
    const response = await this.request<DouyinUserVideosResponse>({
      endpoint: '/api/v1/douyin/app/v3/fetch_user_post_videos',
      params: {
        ...restParams,
        sec_user_id: sec_uid,
        count: count ?? 20,
      },
    })
    return response.data
  }

  /**
   * 获取所有用户视频（自动分页）
   */
  async *getAllUserVideos(
    params: Omit<GetUserVideosParams, 'max_cursor'>
  ): AsyncGenerator<DouyinUserVideosResponse, void, unknown> {
    let maxCursor = 0
    let hasMore = true

    while (hasMore) {
      const result = await this.getUserVideos({
        ...params,
        max_cursor: maxCursor,
      })

      yield result

      hasMore = result.has_more
      maxCursor = result.max_cursor

      // 避免请求过快
      if (hasMore) {
        await this.sleep(500)
      }
    }
  }

  /**
   * 获取单个视频详情
   */
  async getVideoDetail(params: GetVideoDetailParams): Promise<DouyinVideoDetailResponse> {
    const response = await this.request<DouyinVideoDetailResponse>({
      endpoint: '/api/v1/douyin/app/v3/fetch_one_video',
      params,
    })
    return response.data
  }

  /**
   * 从任意抖音链接中提取视频ID
   * 支持各种格式的分享链接,包括短代码
   */
  async extractAwemeId(url: string): Promise<string> {
    const response = await this.request<string>({
      endpoint: '/api/v1/douyin/web/get_aweme_id',
      params: { url },
    })
    return response.data
  }

  /**
   * 搜索用户
   */
  async searchUser(params: SearchUserParams): Promise<DouyinUserSearchResult> {
    const response = await this.request<DouyinUserSearchResult>({
      endpoint: '/api/v1/douyin/web/fetch_user_search_result',
      params: {
        ...params,
        offset: params.offset || 0,
        count: params.count || 20,
      },
    })
    return response.data
  }

  /**
   * 获取TikHub用户信息
   */
  async getUserInfo(): Promise<TikHubUserInfo> {
    const response = await this.request<TikHubUserInfo>({
      endpoint: '/api/v1/tikhub/user/get_user_info',
    })
    return response.data
  }

  /**
   * 获取每日使用情况
   */
  async getDailyUsage(date?: string): Promise<TikHubDailyUsage> {
    const response = await this.request<TikHubDailyUsage>({
      endpoint: '/api/v1/tikhub/user/get_user_daily_usage',
      params: date ? { date } : undefined,
    })
    return response.data
  }

  /**
   * 计算价格
   */
  async calculatePrice(requestCount: number): Promise<TikHubPriceCalculation> {
    const response = await this.request<TikHubPriceCalculation>({
      endpoint: '/api/v1/tikhub/user/calculate_price',
      params: { request_count: requestCount },
    })
    return response.data
  }

  /**
   * 批量获取用户视频（带限流）
   */
  async batchGetUserVideos(
    secUids: string[],
    options: {
      maxConcurrent?: number
      onProgress?: (completed: number, total: number) => void
    } = {}
  ): Promise<Map<string, DouyinUserVideosResponse>> {
    const { maxConcurrent = TIKHUB_CONFIG.maxConcurrent, onProgress } = options
    const results = new Map<string, DouyinUserVideosResponse>()
    const errors: Array<{ secUid: string; error: any }> = []

    let completed = 0
    const total = secUids.length

    // 分批处理
    for (let i = 0; i < secUids.length; i += maxConcurrent) {
      const batch = secUids.slice(i, i + maxConcurrent)
      const promises = batch.map(async (sec_uid) => {
        try {
          const videos = await this.getUserVideos({ sec_uid, count: 20 })
          results.set(sec_uid, videos)
        } catch (error) {
          errors.push({ secUid: sec_uid, error })
        } finally {
          completed++
          if (onProgress) {
            onProgress(completed, total)
          }
        }
      })

      await Promise.all(promises)

      // 批次间延迟
      if (i + maxConcurrent < secUids.length) {
        await this.sleep(1000)
      }
    }

    if (errors.length > 0) {
      console.warn(`批量获取视频完成，但有 ${errors.length} 个错误:`, errors)
    }

    return results
  }

  /**
   * 获取视频评论
   */
  async getVideoComments(params: GetVideoCommentsParams): Promise<DouyinVideoCommentsResponse> {
    const response = await this.request<DouyinVideoCommentsResponse>({
      endpoint: '/api/v1/douyin/app/v3/fetch_video_comments',
      params: {
        ...params,
        cursor: params.cursor || 0,
        count: params.count || 20,
      },
    })
    return response.data
  }

  /**
   * 获取视频统计数据（点赞、下载、播放、分享数）
   */
  async getVideoStatistics(params: GetVideoStatisticsParams): Promise<DouyinVideoStatisticsResponse> {
    const response = await this.request<DouyinVideoStatisticsResponse>({
      endpoint: '/api/v1/douyin/app/v3/fetch_video_statistics',
      params,
    })
    return response.data
  }

  /**
   * 获取评论词云权重分析
   */
  async getCommentWordCloud(params: GetCommentWordCloudParams): Promise<DouyinCommentWordCloudResponse> {
    const response = await this.request<DouyinCommentWordCloudResponse>({
      endpoint: '/api/v1/douyin/billboard/fetch_hot_comment_word_list',
      params,
    })
    return response.data
  }

  /**
   * 测试API连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getUserInfo()
      return true
    } catch (error) {
      console.error('TikHub API连接失败:', error)
      return false
    }
  }
}

/**
 * 创建TikHub客户端单例
 */
let clientInstance: TikHubClient | null = null

export function getTikHubClient(config?: ConstructorParameters<typeof TikHubClient>[0]): TikHubClient {
  if (!clientInstance) {
    clientInstance = new TikHubClient(config)
  }
  return clientInstance
}

/**
 * 重置客户端单例（用于测试）
 */
export function resetTikHubClient(): void {
  clientInstance = null
}
