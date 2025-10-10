/**
 * TikHub数据映射器
 *
 * 将TikHub API返回的数据转换为Prisma数据模型
 */

import type {
  DouyinUserProfile,
  DouyinVideo,
  DouyinUserVideosResponse,
} from './types'
import type {
  Merchant,
  MerchantContent,
  BusinessType,
  ContentType,
} from '@prisma/client'
import * as dt from '@/lib/utils/date-toolkit'

/**
 * 将抖音用户资料映射为商家数据
 */
export function mapUserProfileToMerchant(
  profile: DouyinUserProfile,
  options?: {
    categoryId?: string
    businessType?: BusinessType
  }
): Omit<Merchant, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    uid: profile.uid,
    name: profile.nickname || '未知商家',
    description: profile.signature || null,
    categoryId: options?.categoryId || null,
    location: profile.ip_location || profile.city || profile.province || null,
    address: [profile.province, profile.city, profile.district].filter(Boolean).join(' ') || null,
    contactInfo: {
      unique_id: profile.unique_id,
      sec_uid: profile.sec_uid,
      gender: profile.gender,
      birthday: profile.birthday,
      school_name: profile.school_name,
      custom_verify: profile.custom_verify,
      enterprise_verify_reason: profile.enterprise_verify_reason,
      is_enterprise_vip: profile.is_enterprise_vip,
      verification_type: profile.verification_type,
    },
    businessType: options?.businessType || 'B2C',
    totalDiggCount: profile.total_favorited || 0,
    totalCommentCount: 0, // 需要从视频数据聚合
    totalCollectCount: profile.favoriting_count || 0,
    totalShareCount: profile.forward_count || 0,
    totalContentCount: profile.aweme_count || 0,
    dataSource: 'douyin',
    lastCollectedAt: dt.now(),
    status: 'ACTIVE',
    isVerified: profile.verification_type > 0,
  }
}

/**
 * 将抖音视频映射为商家内容
 */
export function mapVideoToMerchantContent(
  video: DouyinVideo,
  merchantId: string
): Omit<MerchantContent, 'id' | 'createdAt' | 'updatedAt'> {
  // 提取标签
  const tags = [
    ...(video.text_extra?.map((t) => t.hashtag_name) || []),
    ...(video.video_tag?.map((t) => t.tag_name) || []),
  ].filter(Boolean)

  // 提取text_extra（带完整信息）
  const textExtra = video.text_extra?.map((t) => ({
    hashtag_name: t.hashtag_name,
    hashtag_id: t.hashtag_id,
    type: t.type,
  })) || []

  return {
    merchantId,
    externalId: video.aweme_id,
    title: video.desc || '无标题',
    content: video.desc || null,
    transcript: null, // 需要单独获取
    contentType: determineContentType(video),
    duration: video.video?.duration ? String(video.video.duration) : null,
    shareUrl: video.share_url || null,
    hasTranscript: false, // 需要单独检测
    diggCount: video.statistics?.digg_count || 0,
    commentCount: video.statistics?.comment_count || 0,
    collectCount: video.statistics?.collect_count || 0,
    shareCount: video.statistics?.share_count || 0,
    tags: JSON.stringify(tags),
    textExtra: JSON.stringify(textExtra),
    publishedAt: dt.safeDate(video.create_time * 1000),
    collectedAt: dt.now(),
    externalCreatedAt: dt.safeDate(video.create_time * 1000),
  }
}

/**
 * 批量映射视频数据
 */
export function mapVideosToMerchantContents(
  videosResponse: DouyinUserVideosResponse,
  merchantId: string
): Array<Omit<MerchantContent, 'id' | 'createdAt' | 'updatedAt'>> {
  return videosResponse.aweme_list.map((video) =>
    mapVideoToMerchantContent(video, merchantId)
  )
}

/**
 * 判断内容类型
 */
function determineContentType(video: DouyinVideo): ContentType {
  // 根据视频对象判断类型
  if (video.video && video.video.play_addr) {
    return 'VIDEO'
  }

  // 可以根据其他字段判断图片、文章等
  // 目前抖音主要是视频内容
  return 'VIDEO'
}

/**
 * 计算商家的聚合统计数据
 */
export function aggregateMerchantStats(
  contents: Array<Pick<MerchantContent, 'diggCount' | 'commentCount' | 'collectCount' | 'shareCount'>>
): {
  totalDiggCount: number
  totalCommentCount: number
  totalCollectCount: number
  totalShareCount: number
} {
  return contents.reduce(
    (acc, content) => ({
      totalDiggCount: acc.totalDiggCount + content.diggCount,
      totalCommentCount: acc.totalCommentCount + content.commentCount,
      totalCollectCount: acc.totalCollectCount + content.collectCount,
      totalShareCount: acc.totalShareCount + content.shareCount,
    }),
    {
      totalDiggCount: 0,
      totalCommentCount: 0,
      totalCollectCount: 0,
      totalShareCount: 0,
    }
  )
}

/**
 * 提取用户UID的辅助函数
 */
export function extractUidFromShareUrl(shareUrl: string): string | null {
  // 抖音分享链接格式: https://www.douyin.com/user/MS4wLjABAAAA...
  const match = shareUrl.match(/\/user\/([^/?]+)/)
  return match ? match[1] : null
}

/**
 * 格式化商家位置信息
 */
export function formatMerchantLocation(profile: DouyinUserProfile): string | null {
  const parts = [profile.province, profile.city, profile.district].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : profile.ip_location || null
}

/**
 * 判断商家是否已认证
 */
export function isMerchantVerified(profile: DouyinUserProfile): boolean {
  return (
    profile.is_enterprise_vip ||
    profile.verification_type > 0 ||
    Boolean(profile.enterprise_verify_reason)
  )
}

/**
 * 计算内容互动评分
 */
export function calculateEngagementScore(content: {
  diggCount: number
  commentCount: number
  collectCount: number
  shareCount: number
}): number {
  // 加权计算：点赞x1, 评论x2, 收藏x3, 分享x4
  return (
    content.diggCount * 1 +
    content.commentCount * 2 +
    content.collectCount * 3 +
    content.shareCount * 4
  )
}

/**
 * 提取视频封面URL
 */
export function extractVideoCoverUrl(video: DouyinVideo): string | null {
  return (
    video.video?.cover?.url_list?.[0] ||
    video.video?.dynamic_cover?.url_list?.[0] ||
    null
  )
}

/**
 * 提取视频播放URL
 */
export function extractVideoPlayUrl(video: DouyinVideo): string | null {
  return video.video?.play_addr?.url_list?.[0] || null
}

/**
 * 格式化视频时长（秒 -> 分:秒）
 */
export function formatVideoDuration(durationInSeconds: number): string {
  const minutes = Math.floor(durationInSeconds / 60)
  const seconds = durationInSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * 解析视频分辨率
 */
export function parseVideoResolution(video: DouyinVideo): {
  width: number
  height: number
  ratio: string
} | null {
  if (!video.video) return null

  return {
    width: video.video.width || 0,
    height: video.video.height || 0,
    ratio: video.video.ratio || 'unknown',
  }
}

/**
 * 数据验证：检查必需字段
 */
export function validateMerchantData(
  data: Partial<Omit<Merchant, 'id' | 'createdAt' | 'updatedAt'>>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.uid || data.uid.trim() === '') {
    errors.push('uid是必需字段')
  }

  if (!data.name || data.name.trim() === '') {
    errors.push('name是必需字段')
  }

  if (data.totalDiggCount !== undefined && data.totalDiggCount < 0) {
    errors.push('totalDiggCount不能为负数')
  }

  if (data.totalCommentCount !== undefined && data.totalCommentCount < 0) {
    errors.push('totalCommentCount不能为负数')
  }

  if (data.totalCollectCount !== undefined && data.totalCollectCount < 0) {
    errors.push('totalCollectCount不能为负数')
  }

  if (data.totalShareCount !== undefined && data.totalShareCount < 0) {
    errors.push('totalShareCount不能为负数')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * 数据验证：检查内容数据
 */
export function validateContentData(
  data: Partial<Omit<MerchantContent, 'id' | 'createdAt' | 'updatedAt'>>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.externalId || data.externalId.trim() === '') {
    errors.push('externalId是必需字段')
  }

  if (!data.merchantId || data.merchantId.trim() === '') {
    errors.push('merchantId是必需字段')
  }

  if (!data.title || data.title.trim() === '') {
    errors.push('title是必需字段')
  }

  if (data.diggCount !== undefined && data.diggCount < 0) {
    errors.push('diggCount不能为负数')
  }

  if (data.commentCount !== undefined && data.commentCount < 0) {
    errors.push('commentCount不能为负数')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
