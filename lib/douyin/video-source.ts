/**
 * 抖音视频源数据封装
 * 统一管理分享链接解析和视频信息获取
 */

import { getTikHubClient } from '@/lib/tikhub';
import { parseDouyinVideoShare } from '@/lib/douyin/share-link';
import type { DouyinVideo } from '@/lib/tikhub/types';

/**
 * 视频源信息
 */
export interface DouyinVideoSource {
  videoId: string;
  userId?: string;
  secUserId?: string;
  title: string;
  author: string;
  playUrl: string;
  audioUrl: string | null;  // 音频直链（来自 music.play_url），可直接下载跳过 FFmpeg
  duration: number;
  hashtags: string[];
  videoTags: string[];
}

/**
 * 从 TikHub 返回的 aweme_detail 中提取可播放 URL
 */
function extractPlayableUrl(video: DouyinVideo): string | null {
  const videoData: any = video.video || video;
  if (!videoData) return null;

  const candidates: Array<string | undefined> = [];

  // 1. play_addr 是主要播放地址
  if (Array.isArray(videoData.play_addr?.url_list)) {
    candidates.push(...videoData.play_addr.url_list);
  }

  // 2. bit_rate 包含不同码率的播放地址
  if (Array.isArray(videoData.bit_rate)) {
    for (const item of videoData.bit_rate) {
      if (Array.isArray(item?.play_addr?.url_list)) {
        candidates.push(...item.play_addr.url_list);
      }
    }
  }

  // 3. download_addr 作为备选
  if (Array.isArray(videoData.download_addr?.url_list)) {
    candidates.push(...videoData.download_addr.url_list);
  }

  // 去除水印 URL (playwm -> play)
  const sanitized = candidates
    .map((url) => (url?.includes('playwm') ? url.replace('playwm', 'play') : url))
    .filter((url): url is string => Boolean(url));

  // 优先返回包含 aweme 的 URL
  return sanitized.find((url) => url.includes('aweme')) || sanitized[0] || null;
}

/**
 * 从 TikHub 返回的 aweme_detail 中提取音频 URL
 * 音频 URL 来自 music.play_url.url_list，可直接下载 MP3
 * 这样可以跳过 FFmpeg 音频提取步骤，解决 Vercel 部署问题
 */
function extractAudioUrl(video: DouyinVideo): string | null {
  const music = (video as any)?.music;
  if (!music) return null;

  // 优先使用 play_url.url_list
  if (Array.isArray(music.play_url?.url_list) && music.play_url.url_list.length > 0) {
    return music.play_url.url_list[0];
  }

  // 备选：直接使用 play_url.uri（如果是完整 URL）
  if (music.play_url?.uri && music.play_url.uri.startsWith('http')) {
    return music.play_url.uri;
  }

  return null;
}

/**
 * 规范化视频时长（统一为秒）
 */
function normalizeDuration(duration?: number | null): number {
  if (!duration || Number.isNaN(duration)) return 0;
  // 如果是毫秒则转换为秒
  return duration >= 1000 ? duration / 1000 : duration;
}

/**
 * 从分享链接创建视频源
 */
export async function createVideoSourceFromShareLink(
  shareLink: string
): Promise<DouyinVideoSource> {
  // 1. 解析分享链接
  const shareResult = await parseDouyinVideoShare(shareLink);

  if (!shareResult.videoId) {
    throw new Error('无法从链接中提取视频ID');
  }

  // 2. 获取视频详情
  const tikhubClient = getTikHubClient();
  const videoDetail = await tikhubClient.getVideoDetail({
    aweme_id: shareResult.videoId,
  });

  const awemeDetail = videoDetail?.aweme_detail;
  if (!awemeDetail) {
    throw new Error('TikHub未返回视频详情数据');
  }

  // 3. 提取播放 URL
  const playUrl = extractPlayableUrl(awemeDetail);
  if (!playUrl) {
    throw new Error('未能获取可用的视频播放地址');
  }

  // 4. 提取音频 URL（用于跳过 FFmpeg，直接下载音频）
  const audioUrl = extractAudioUrl(awemeDetail);
  if (audioUrl) {
    console.info('[video-source] 发现音频直链，可跳过 FFmpeg 提取');
  }

  // 5. 提取视频元数据
  const hashtags =
    awemeDetail.text_extra
      ?.filter((item: any) => item.hashtag_name)
      .map((item: any) => item.hashtag_name) || [];

  const videoTags =
    awemeDetail.video_tag?.map((tag: any) => tag.tag_name).filter(Boolean) || [];

  // 6. 构建视频源对象
  return {
    videoId: shareResult.videoId,
    userId: shareResult.userId,
    secUserId: shareResult.secUserId,
    title: awemeDetail.desc || '未知标题',
    author: awemeDetail.author?.nickname || '未知作者',
    playUrl,
    audioUrl,
    duration: normalizeDuration(awemeDetail.video?.duration),
    hashtags,
    videoTags,
  };
}
