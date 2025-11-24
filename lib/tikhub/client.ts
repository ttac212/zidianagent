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
  DouyinCityListResponse,
  DouyinContentTagResponse,
  DouyinHotAccountListResponse,
  GetHotAccountListParams,
  DouyinFansInterestTopicListResponse,
  GetFansInterestTopicListParams,
  DouyinHotVideoListResponse,
  GetHotVideoListParams,
  DouyinLowFanListResponse,
  GetLowFanListParams,
  DouyinHotWordListResponse,
  GetHotWordListParams,
  DouyinCityHotListResponse,
  GetCityHotListParams,
  GeneralSearchV5Params,
  DouyinGeneralSearchV5Response,
  GeneralSearchV4Params,
  DouyinGeneralSearchV4Response,
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
      let data: TikHubBaseResponse<T> | null = null
      try {
        // TikHub所有返回都使用JSON包裹code/message/data
        data = (await response.json()) as TikHubBaseResponse<T>
      } catch (_parseError) {
        data = null
      }

      // 优先判断TikHub业务状态码，TikHub常以HTTP 200返回业务错误
      const dataCode = data?.code
      const isHttpSuccess = response.status === TIKHUB_ERROR_CODES.SUCCESS
      const isBusinessSuccess = dataCode === TIKHUB_ERROR_CODES.SUCCESS

      if (isHttpSuccess && isBusinessSuccess && data) {
        return data
      }

      // 处理错误响应（支持HTTP错误或业务错误）
      const error: TikHubApiError = {
        code: dataCode ?? response.status,
        message: data?.message || response.statusText || 'TikHub API error',
        endpoint,
        timestamp: Date.now(),
        details: data ?? undefined,
      }

      // 可重试的错误
      const retryableErrors = [
        TIKHUB_ERROR_CODES.RATE_LIMIT,
        TIKHUB_ERROR_CODES.SERVER_ERROR,
        TIKHUB_ERROR_CODES.SERVICE_UNAVAILABLE,
      ]

      const isRetryable = retryableErrors.includes(
        (dataCode ?? response.status) as (typeof retryableErrors)[number]
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
   * 获取中国城市列表
   */
  async getCityList(): Promise<DouyinCityListResponse> {
    const response = await this.request<DouyinCityListResponse>({
      endpoint: '/api/v1/douyin/billboard/fetch_city_list',
    })
    return response.data
  }

  /**
   * 获取垂类内容标签
   * 用于构建 query_tag 参数
   *
   * @example
   * // 顶级垂类：美食 (628)
   * // 子垂类：品酒教学 (62802)
   * // 查询参数：{"value": 628, "children": [{"value": 62802}]}
   */
  async getContentTags(): Promise<DouyinContentTagResponse> {
    const response = await this.request<DouyinContentTagResponse>({
      endpoint: '/api/v1/douyin/billboard/fetch_content_tag',
    })
    return response.data
  }

  /**
   * 获取热门账号列表
   *
   * @param params 查询参数
   * @param params.date_window 时间窗口（小时），默认24小时
   * @param params.page_num 页码，默认1
   * @param params.page_size 每页数量，默认10
   * @param params.query_tag 垂类标签筛选，空对象表示全部
   *
   * @example
   * // 获取所有垂类的热门账号
   * await client.getHotAccountList({ page_num: 1, page_size: 20 })
   *
   * // 获取美食垂类的热门账号
   * await client.getHotAccountList({
   *   query_tag: { value: 628 }
   * })
   *
   * // 获取美食垂类中美食教程和美食测评的热门账号
   * await client.getHotAccountList({
   *   query_tag: {
   *     value: 628,
   *     children: [{ value: 62804 }, { value: 62803 }]
   *   }
   * })
   */
  async getHotAccountList(params?: GetHotAccountListParams): Promise<DouyinHotAccountListResponse> {
    const response = await this.request<DouyinHotAccountListResponse>({
      endpoint: '/api/v1/douyin/billboard/fetch_hot_account_list',
      method: 'POST',
      body: {
        date_window: params?.date_window ?? 24,
        page_num: params?.page_num ?? 1,
        page_size: params?.page_size ?? 10,
        query_tag: params?.query_tag ?? {},
      },
    })
    return response.data
  }

  /**
   * 获取粉丝画像（省份/城市等）
   * option: 1-价格 2-性别 3-年龄 4-省份 5-城市 6-城市级别 7-手机品牌 8-兴趣标签
   */
  async getHotAccountFansPortrait(params: { sec_uid: string; option?: number }): Promise<any> {
    const response = await this.request<any>({
      endpoint: '/api/v1/douyin/billboard/fetch_hot_account_fans_portrait_list',
      method: 'GET',
      params: {
        sec_uid: params.sec_uid,
        option: params.option ?? 4,
      },
    })
    return response.data
  }

  /**
   * 获取粉丝近3天感兴趣的话题（10个话题）
   *
   * @param params 查询参数
   * @param params.sec_uid 用户sec_uid
   *
   * @example
   * // 获取人民日报粉丝感兴趣的话题
   * const topics = await client.getFansInterestTopicList({
   *   sec_uid: 'MS4wLjABAAAA8U_l6rBzmy7bcy6xOJel4v0RzoR_wfAubGPeJimN__4'
   * })
   */
  async getFansInterestTopicList(params: GetFansInterestTopicListParams): Promise<DouyinFansInterestTopicListResponse> {
    if (!params.sec_uid) {
      throw new Error('sec_uid is required to fetch fans interest topic list.')
    }

    const response = await this.request<DouyinFansInterestTopicListResponse>({
      endpoint: '/api/v1/douyin/billboard/fetch_hot_account_fans_interest_topic_list',
      params: {
        sec_uid: params.sec_uid,
      },
    })
    return response.data
  }

  /**
   * 获取视频热榜
   *
   * @param params 查询参数
   * @param params.page 页码，默认1
   * @param params.page_size 每页数量，默认10
   * @param params.date_window 时间窗口，1按小时 2按天，默认24
   * @param params.tags 子级垂类标签，空则为全部
   *
   * @example
   * // 获取全部垂类的视频热榜
   * const videos = await client.getHotVideoList({ page: 1, page_size: 20 })
   *
   * // 获取美食垂类的视频热榜
   * const foodVideos = await client.getHotVideoList({
   *   tags: [{ value: 628 }]
   * })
   *
   * // 获取美食垂类中美食教程和美食测评的视频热榜
   * const specificVideos = await client.getHotVideoList({
   *   tags: [{
   *     value: 628,
   *     children: [{ value: 62804 }, { value: 62803 }]
   *   }]
   * })
   */
  async getHotVideoList(params?: GetHotVideoListParams): Promise<DouyinHotVideoListResponse> {
    const response = await this.request<DouyinHotVideoListResponse>({
      endpoint: '/api/v1/douyin/billboard/fetch_hot_total_video_list',
      method: 'POST',
      body: {
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 10,
        date_window: params?.date_window ?? 24,
        tags: params?.tags ?? [],
      },
    })
    return response.data
  }

  /**
   * 获取低粉爆款榜
   *
   * @param params 查询参数
   * @param params.page 页码，默认1
   * @param params.page_size 每页数量，默认10
   * @param params.date_window 时间窗口，1按小时 2按天，默认24
   * @param params.tags 子级垂类标签，空则为全部
   *
   * @example
   * // 获取全部垂类的低粉爆款榜
   * const videos = await client.getLowFanList({ page: 1, page_size: 20 })
   *
   * // 获取美食垂类的低粉爆款榜
   * const foodVideos = await client.getLowFanList({
   *   tags: [{ value: 628 }]
   * })
   *
   * // 获取美食垂类中美食教程的低粉爆款榜
   * const specificVideos = await client.getLowFanList({
   *   tags: [{
   *     value: 628,
   *     children: [{ value: 62804 }]
   *   }]
   * })
   */
  async getLowFanList(params?: GetLowFanListParams): Promise<DouyinLowFanListResponse> {
    const response = await this.request<DouyinLowFanListResponse>({
      endpoint: '/api/v1/douyin/billboard/fetch_hot_total_low_fan_list',
      method: 'POST',
      body: {
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 10,
        date_window: params?.date_window ?? 24,
        tags: params?.tags ?? [],
      },
    })
    return response.data
  }

  /**
   * 获取热门内容词列表
   *
   * @param params 查询参数
   * @param params.page_num 页码，默认1
   * @param params.page_size 每页数量，默认10
   * @param params.date_window 时间窗口，1按小时 2按天，默认24
   * @param params.keyword 搜索关键字
   *
   * @example
   * // 获取全部热门内容词
   * const words = await client.getHotWordList({ page_num: 1, page_size: 20 })
   *
   * // 搜索包含"美食"的热门内容词
   * const foodWords = await client.getHotWordList({
   *   keyword: '美食',
   *   page_num: 1,
   *   page_size: 10
   * })
   *
   * // 获取按小时统计的热门内容词
   * const hourlyWords = await client.getHotWordList({
   *   date_window: 1,
   *   page_size: 50
   * })
   */
  async getHotWordList(params?: GetHotWordListParams): Promise<DouyinHotWordListResponse> {
    const response = await this.request<DouyinHotWordListResponse>({
      endpoint: '/api/v1/douyin/billboard/fetch_hot_total_hot_word_list',
      method: 'POST',
      body: {
        page_num: params?.page_num ?? 1,
        page_size: params?.page_size ?? 10,
        date_window: params?.date_window ?? 24,
        keyword: params?.keyword ?? '',
      },
    })
    return response.data
  }

  /**
   * 获取同城热点榜
   *
   * @param params 查询参数
   * @param params.page 页码，默认1
   * @param params.page_size 每页数量，默认10
   * @param params.order 排序方式，rank-按热度，rank_diff-按排名变化，默认rank
   * @param params.city_code 城市编码，空为全部
   * @param params.sentence_tag 热点分类标签，多个用逗号分隔，空为全部
   * @param params.keyword 热点搜索词
   *
   * @example
   * // 获取全部城市的热点榜
   * const allCityHots = await client.getCityHotList({ page: 1, page_size: 20 })
   *
   * // 获取北京市（城市编码110000）的热点榜
   * const beijingHots = await client.getCityHotList({
   *   city_code: '110000',
   *   order: 'rank'
   * })
   *
   * // 搜索包含"美食"的热点
   * const foodHots = await client.getCityHotList({
   *   keyword: '美食',
   *   page_size: 10
   * })
   *
   * // 获取特定分类的热点（分类标签从热点榜分类接口获取）
   * const categoryHots = await client.getCityHotList({
   *   sentence_tag: '美食,旅游',
   *   city_code: '110000'
   * })
   */
  async getCityHotList(params?: GetCityHotListParams): Promise<DouyinCityHotListResponse> {
    const response = await this.request<DouyinCityHotListResponse>({
      endpoint: '/api/v1/douyin/billboard/fetch_hot_city_list',
      method: 'GET',
      params: {
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 10,
        order: params?.order ?? 'rank',
        city_code: params?.city_code ?? '',
        sentence_tag: params?.sentence_tag ?? '',
        keyword: params?.keyword ?? '',
      },
    })
    return response.data
  }

  /**
   * 综合搜索V5（最新版本）
   *
   * @param params 搜索参数
   * @param params.keyword 搜索关键词
   * @param params.offset 偏移游标，用于翻页，首次请求传0
   * @param params.page 页码，首次请求传0，之后每次加1
   * @param params.backtrace 回溯参数，首次请求传空字符串
   * @param params.search_id 搜索ID，首次请求传空字符串
   *
   * @returns 综合搜索结果，包含视频、用户、话题等多种类型
   *
   * @example
   * // 首次搜索
   * const result = await client.generalSearchV5({
   *   keyword: '全屋定制',
   *   offset: 0,
   *   page: 0,
   *   backtrace: '',
   *   search_id: ''
   * })
   *
   * // 翻页搜索
   * const nextPage = await client.generalSearchV5({
   *   keyword: '全屋定制',
   *   offset: result.config.offset,
   *   page: 1,
   *   backtrace: result.config.backtrace,
   *   search_id: result.config.search_id
   * })
   */
  async generalSearchV5(params: GeneralSearchV5Params): Promise<DouyinGeneralSearchV5Response> {
    if (!params.keyword) {
      throw new Error('keyword is required for general search.')
    }

    const response = await this.request<DouyinGeneralSearchV5Response>({
      endpoint: '/api/v1/douyin/search/fetch_general_search_v5',
      method: 'POST',
      body: {
        keyword: params.keyword,
        offset: params.offset ?? 0,
        page: params.page ?? 0,
        backtrace: params.backtrace ?? '',
        search_id: params.search_id ?? '',
      },
    })
    return response.data
  }

  /**
   * 综合搜索V5自动分页（获取所有结果）
   *
   * @param keyword 搜索关键词
   * @param options 配置选项
   * @param options.maxPages 最大翻页数，默认5
   * @param options.onProgress 进度回调
   *
   * @example
   * // 获取最多5页的搜索结果
   * for await (const page of client.getAllGeneralSearchV5Results('全屋定制')) {
   *   console.log('获取到', page.data.length, '条结果')
   * }
   */
  async *getAllGeneralSearchV5Results(
    keyword: string,
    options: {
      maxPages?: number
      onProgress?: (page: number, total: number) => void
    } = {}
  ): AsyncGenerator<DouyinGeneralSearchV5Response, void, unknown> {
    const { maxPages = 5, onProgress } = options

    let offset = 0
    let page = 0
    let backtrace = ''
    let searchId = ''
    let hasMore = true

    while (hasMore && page < maxPages) {
      const result = await this.generalSearchV5({
        keyword,
        offset,
        page,
        backtrace,
        search_id: searchId,
      })

      yield result

      if (onProgress) {
        onProgress(page + 1, maxPages)
      }

      // 更新分页参数
      hasMore = result.config.has_more === 1
      offset = result.config.offset
      backtrace = result.config.backtrace
      searchId = result.config.search_id
      page++

      // 避免请求过快
      if (hasMore && page < maxPages) {
        await this.sleep(500)
      }
    }
  }

  /**
   * 综合搜索V4
   *
   * @param params 搜索参数
   * @param params.keyword 搜索关键词
   * @param params.offset 翻页偏移量，默认0
   * @param params.sort_type 排序方式：0-综合排序 1-最多点赞 2-最新发布
   * @param params.publish_time 发布时间：0-不限 1-最近一天 7-最近一周 180-最近半年
   * @param params.filter_duration 视频时长：0-不限 0-1-1分钟内 1-5-1-5分钟 5-10000-5分钟以上
   * @param params.content_type 内容类型：0-不限 1-视频 2-图集
   * @param params.search_id 搜索ID，翻页时需要提供
   *
   * @returns 综合搜索结果
   *
   * @example
   * // 首次搜索
   * const result = await client.generalSearchV4({
   *   keyword: '全屋定制',
   *   sort_type: '1', // 按点赞数排序
   * })
   *
   * // 翻页搜索
   * const nextPage = await client.generalSearchV4({
   *   keyword: '全屋定制',
   *   offset: 20,
   *   search_id: result.extra.logid
   * })
   */
  async generalSearchV4(params: GeneralSearchV4Params): Promise<DouyinGeneralSearchV4Response> {
    if (!params.keyword) {
      throw new Error('keyword is required for general search.')
    }

    const response = await this.request<DouyinGeneralSearchV4Response>({
      endpoint: '/api/v1/douyin/search/fetch_general_search_v4',
      method: 'POST',
      body: {
        keyword: params.keyword,
        offset: params.offset ?? 0,
        sort_type: params.sort_type ?? '0',
        publish_time: params.publish_time ?? '0',
        filter_duration: params.filter_duration ?? '0',
        content_type: params.content_type ?? '0',
        search_id: params.search_id ?? '',
      },
    })
    return response.data
  }

  /**
   * 综合搜索V4自动分页（获取所有结果）
   *
   * @param keyword 搜索关键词
   * @param options 配置选项
   * @param options.maxPages 最大翻页数，默认5
   * @param options.pageSize 每页数量，默认20
   * @param options.sort_type 排序方式
   * @param options.publish_time 发布时间筛选
   * @param options.filter_duration 视频时长筛选
   * @param options.content_type 内容类型筛选
   * @param options.onProgress 进度回调
   *
   * @example
   * // 获取最多5页的搜索结果
   * for await (const page of client.getAllGeneralSearchV4Results('全屋定制')) {
   *   console.log('获取到', page.data.length, '条结果')
   * }
   *
   * // 获取按点赞数排序的结果
   * for await (const page of client.getAllGeneralSearchV4Results('全屋定制', {
   *   sort_type: '1',
   *   maxPages: 3
   * })) {
   *   console.log('获取到', page.data.length, '条结果')
   * }
   */
  async *getAllGeneralSearchV4Results(
    keyword: string,
    options: {
      maxPages?: number
      pageSize?: number
      sort_type?: '0' | '1' | '2'
      publish_time?: '0' | '1' | '7' | '180'
      filter_duration?: '0' | '0-1' | '1-5' | '5-10000'
      content_type?: '0' | '1' | '2'
      onProgress?: (page: number, total: number) => void
    } = {}
  ): AsyncGenerator<DouyinGeneralSearchV4Response, void, unknown> {
    const {
      maxPages = 5,
      pageSize = 20,
      sort_type = '0',
      publish_time = '0',
      filter_duration = '0',
      content_type = '0',
      onProgress,
    } = options

    let offset = 0
    let page = 0
    let searchId = ''
    let hasMore = true

    while (hasMore && page < maxPages) {
      const result = await this.generalSearchV4({
        keyword,
        offset,
        sort_type,
        publish_time,
        filter_duration,
        content_type,
        search_id: searchId,
      })

      yield result

      if (onProgress) {
        onProgress(page + 1, maxPages)
      }

      // 更新分页参数
      hasMore = result.has_more === 1
      offset += pageSize
      searchId = result.extra?.logid || ''
      page++

      // 避免请求过快
      if (hasMore && page < maxPages) {
        await this.sleep(500)
      }
    }
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
