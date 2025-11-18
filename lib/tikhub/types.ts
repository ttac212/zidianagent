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
  sec_uid?: string
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
  sort_type?: 0 | 1
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

/**
 * 抖音评论信息
 */
export interface DouyinComment {
  cid: string // 评论ID
  text: string // 评论文本
  create_time: number // 创建时间戳
  digg_count: number // 点赞数
  reply_comment_total: number // 回复数
  user: {
    uid: string
    sec_uid: string
    nickname: string
    avatar_thumb: {
      url_list: string[]
    }
  }
  reply_id?: string // 回复的评论ID
  reply_to_reply_id?: string // 回复的回复ID
  label_text?: string // 标签文本
  stick_position?: number // 置顶位置
  [key: string]: any
}

/**
 * 视频评论列表响应
 */
export interface DouyinVideoCommentsResponse {
  comments: DouyinComment[]
  cursor: number // 下一页游标
  has_more: boolean // 是否有更多数据
  total: number // 评论总数
  status_code: number
}

/**
 * 请求参数 - 获取视频评论
 */
export interface GetVideoCommentsParams {
  aweme_id: string // 视频ID
  cursor?: number // 游标，用于分页，第一页为0
  count?: number // 数量，默认20
}

/**
 * 视频统计数据响应
 */
export interface DouyinVideoStatisticsResponse {
  statistics: Array<{
    aweme_id: string
    comment_count: number // 评论数
    digg_count: number // 点赞数
    download_count: number // 下载数
    play_count: number // 播放数
    share_count: number // 分享数
    collect_count: number // 收藏数
    forward_count: number // 转发数
  }>
  status_code: number
}

/**
 * 请求参数 - 获取视频统计数据
 */
export interface GetVideoStatisticsParams {
  aweme_ids: string // 视频ID，多个用逗号分隔，最多2个
}

/**
 * 词云权重项
 */
export interface CommentWordCloudItem {
  word_seg: string // 关键词（实际API字段）
  value: number // 权重/频率（实际API字段）
  word?: string // 兼容字段
  weight?: number // 兼容字段
  related_comment?: any // 相关评论
  hot_value?: number // 热度值
}

/**
 * 评论词云权重响应
 */
export interface DouyinCommentWordCloudResponse {
  code: number // 响应码
  data: CommentWordCloudItem[] // 词云列表（实际API字段）
  word_list?: CommentWordCloudItem[] // 兼容字段
  status_code?: number
  aweme_id?: string // 作品ID
  total_words?: number // 总词数
}

/**
 * 请求参数 - 获取评论词云权重
 */
export interface GetCommentWordCloudParams {
  aweme_id: string // 视频ID
}

/**
 * 城市信息
 */
export interface CityInfo {
  value: number // 城市代码 (如: 110000 代表北京)
  label: string // 城市名称 (如: "北京")
}

/**
 * 中国城市列表响应
 */
export interface DouyinCityListResponse {
  code: number // 响应码
  data: CityInfo[] // 城市列表数组
  extra?: {
    now: number // 时间戳
  }
  message: string // 响应消息
}

/**
 * 垂类内容标签
 */
export interface ContentTag {
  value: number // 标签ID (如: 628 代表美食)
  label: string // 标签名称 (如: "美食")
  children?: ContentTag[] // 子标签列表
}

/**
 * 垂类内容标签响应
 */
export interface DouyinContentTagResponse {
  code: number // 响应码
  data: ContentTag[] // 垂类标签列表
  extra?: {
    now: number // 时间戳
  }
  message: string // 响应消息
}

/**
 * 热门账号查询标签参数
 */
export interface HotAccountQueryTag {
  value: number // 顶级垂类标签id
  children?: Array<{ value: number }> // 子级垂类标签id列表
}

/**
 * 获取热门账号请求参数
 */
export interface GetHotAccountListParams {
  date_window?: number // 时间窗口（小时），默认24小时
  page_num?: number // 页码，默认1
  page_size?: number // 每页数量，默认10
  query_tag?: HotAccountQueryTag | Record<string, never> // 垂类标签筛选，空对象表示全部
}

/**
 * 热门账号信息
 */
export interface HotAccountInfo {
  user_id: string // 账号安全ID (sec_uid)
  nick_name: string // 昵称
  avatar_url?: string // 头像URL
  fans_cnt: number // 粉丝数
  like_cnt: number // 获赞总数
  publish_cnt: number // 作品数
  new_like_cnt?: number // 新增获赞数
  new_fans_cnt?: number // 新增粉丝数
  second_tag_name?: string // 二级标签名称
  fans_trends?: Array<{
    DateTime: string // 日期
    Value: number // 粉丝增长数
  }> // 粉丝趋势
  fans_incr_rate?: number // 粉丝增长率
  [key: string]: any // 其他字段
}

/**
 * 热门账号列表响应
 */
export interface DouyinHotAccountListResponse {
  code: number // 响应码
  data: {
    user_list: HotAccountInfo[] // 热门账号列表
    has_more?: boolean // 是否有更多数据
  }
  extra?: {
    now: number // 时间戳
  }
  message: string // 响应消息
}

/**
 * 粉丝感兴趣的话题信息
 */
export interface FansInterestTopic {
  topic_id?: string // 话题ID
  topic_name: string // 话题名称
  interest_score?: number // 兴趣度分数
  rank?: number // 排名
  [key: string]: any // 其他字段
}

/**
 * 粉丝感兴趣话题列表响应
 */
export interface DouyinFansInterestTopicListResponse {
  code: number // 响应码
  data: FansInterestTopic[] // 话题列表
  extra?: {
    now: number // 时间戳
  }
  message: string // 响应消息
}

/**
 * 请求参数 - 获取粉丝感兴趣的话题
 */
export interface GetFansInterestTopicListParams {
  sec_uid: string // 用户sec_uid
}

/**
 * 视频热榜标签查询参数
 */
export interface HotVideoListTag {
  value: number // 顶级垂类标签id
  children?: Array<{ value: number }> // 子级垂类标签id列表
}

/**
 * 请求参数 - 获取视频热榜
 */
export interface GetHotVideoListParams {
  page?: number // 页码，默认1
  page_size?: number // 每页数量，默认10
  date_window?: number // 时间窗口，1按小时 2按天，默认24
  tags?: HotVideoListTag[] // 子级垂类标签，空则为全部
}

/**
 * 热榜视频信息
 */
export interface HotVideoInfo {
  item_id: string // 视频ID
  item_title: string // 视频标题
  item_cover_url: string // 封面URL
  item_duration: number // 视频时长(毫秒)
  nick_name: string // 作者昵称
  avatar_url: string // 作者头像URL
  fans_cnt: number // 粉丝数
  play_cnt: number // 播放数
  publish_time: number // 发布时间戳
  score: number // 分数/热度值
  item_url: string // 视频URL
  like_cnt: number // 点赞数
  follow_cnt: number // 关注数
  follow_rate: number // 关注率
  like_rate: number // 点赞率
  media_type: number // 媒体类型
  favorite_id: number // 收藏ID
  is_favorite: boolean // 是否收藏
  image_cnt: number // 图片数量
  rank?: number // 排名
  [key: string]: any // 其他字段
}

/**
 * 视频热榜列表响应
 */
export interface DouyinHotVideoListResponse {
  code: number // 响应码
  data: {
    page: {
      page: number // 当前页码
      page_size: number // 每页数量
      total: number // 总数
    }
    objs: HotVideoInfo[] // 视频列表
  }
  extra?: {
    now: number // 时间戳
  }
  message: string // 响应消息
}

/**
 * 请求参数 - 获取低粉爆款榜
 * 参数结构与视频热榜相同，复用 GetHotVideoListParams
 */
export type GetLowFanListParams = GetHotVideoListParams

/**
 * 低粉爆款视频信息
 * 数据结构与热榜视频相同，复用 HotVideoInfo
 */
export type LowFanVideoInfo = HotVideoInfo

/**
 * 低粉爆款榜列表响应
 */
export interface DouyinLowFanListResponse {
  code: number // 响应码
  data: {
    page: {
      page: number // 当前页码
      page_size: number // 每页数量
      total: number // 总数
    }
    objs: LowFanVideoInfo[] // 低粉爆款视频列表
  }
  extra?: {
    now: number // 时间戳
  }
  message: string // 响应消息
}

/**
 * 请求参数 - 获取热门内容词列表
 */
export interface GetHotWordListParams {
  page_num?: number // 页码，默认1
  page_size?: number // 每页数量，默认10
  date_window?: number // 时间窗口，1按小时 2按天，默认24
  keyword?: string // 搜索关键字
}

/**
 * 热门内容词趋势数据点
 */
export interface HotWordTrend {
  date: string // 日期（格式：YYYYMMDD）
  value: number // 该日期的热度值
}

/**
 * 热门内容词信息
 */
export interface HotWordInfo {
  title: string // 内容词/关键词
  score: number // 热度值
  rising_ratio: number // 上升比例
  rising_speed: string // 上升速度
  id: string // 唯一标识
  query_day: string // 查询日期
  is_favorite: boolean // 是否收藏
  favorite_id: number // 收藏ID
  trends: HotWordTrend[] // 趋势数据
  [key: string]: any // 其他字段
}

/**
 * 热门内容词列表响应
 */
export interface DouyinHotWordListResponse {
  code: number // 响应码
  data: {
    word_list: HotWordInfo[] // 内容词列表
    total_count: number // 总数
  }
  extra?: {
    now: number // 时间戳
  }
  message: string // 响应消息
}

/**
 * 请求参数 - 获取同城热点榜
 */
export interface GetCityHotListParams {
  page?: number // 页码，默认1
  page_size?: number // 每页数量，默认10
  order?: 'rank' | 'rank_diff' // 排序方式：rank-按热度，rank_diff-按排名变化
  city_code?: string // 城市编码，空为全部
  sentence_tag?: string // 热点分类标签，多个用逗号分隔，空为全部
  keyword?: string // 热点搜索词
}

/**
 * 同城热点信息
 */
export interface CityHotInfo {
  rank: number // 排名
  rank_diff: number // 排名变化
  sentence: string // 热点标题
  sentence_id: number // 热点ID
  create_at: number // 创建时间戳
  hot_score: number // 热度值
  video_count: number // 相关视频数
  sentence_tag: number // 分类标签ID
  city_code: number // 城市编码
  city_name?: string // 城市名称
  sentence_tag_name?: string // 分类标签名称
  trends?: Array<{
    datetime: string // 时间（格式：YYYYMMDDHHmmss）
    hot_score: number // 该时间的热度值
  }> // 趋势数据
  index?: number // 索引
  SnapshotSubType?: string // 快照子类型
  SnapshotType?: number // 快照类型
  SnapshotID?: number // 快照ID
  first_item_cover_url?: string // 首个视频封面URL
  is_favorite?: boolean // 是否收藏
  [key: string]: any // 其他字段
}

/**
 * 同城热点榜列表响应
 */
export interface DouyinCityHotListResponse {
  code: number // 响应码
  data: {
    page: {
      page: number // 当前页码
      page_size: number // 每页数量
      total: number // 总数
    }
    objs: CityHotInfo[] // 热点列表（实际API字段为objs）
    last_update_time?: string // 最后更新时间
  }
  extra?: {
    now: number // 时间戳
  }
  message: string // 响应消息
}
