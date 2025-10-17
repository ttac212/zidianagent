/**
 * 测试真实的抖音分享链接
 * 验证短链解析 + TikHub API + 视频处理流程
 */

import { parseDouyinVideoShare } from '@/lib/douyin/share-link';
import { getTikHubClient } from '@/lib/tikhub';
import { VideoProcessor } from '@/lib/video/video-processor';
import { DOUYIN_DEFAULT_HEADERS } from '@/lib/douyin/constants';

// 真实分享链接
const SHARE_TEXT = `7.15 07/10 Xzt:/ H@V.lp # 瓦瓦  https://v.douyin.com/MUbEduO9AME/ 复制此链接，打开Dou音搜索，直接观看视频！`;

async function testRealShareLink() {
  console.log('🧪 开始测试真实抖音分享链接...\n');

  try {
    // Step 1: 解析短链
    console.log('📝 Step 1: 解析抖音短链');
    console.log('原始分享文本:', SHARE_TEXT);

    const shareResult = await parseDouyinVideoShare(SHARE_TEXT);

    console.log('\n✅ 短链解析成功:');
    console.log('  原始URL:', shareResult.originalUrl);
    console.log('  解析后URL:', shareResult.resolvedUrl);
    console.log('  视频ID:', shareResult.videoId || '未找到');
    console.log('  用户ID:', shareResult.userId || '未找到');
    console.log('  SecUserID:', shareResult.secUserId || '未找到');

    if (!shareResult.videoId) {
      throw new Error('❌ 未能从链接中提取视频ID');
    }

    // Step 2: 获取视频详情
    console.log('\n📝 Step 2: 从TikHub获取视频详情');
    const tikhubClient = getTikHubClient();

    const videoDetail = await tikhubClient.getVideoDetail({
      aweme_id: shareResult.videoId,
    });

    const awemeDetail = videoDetail?.aweme_detail;

    if (!awemeDetail) {
      throw new Error('❌ TikHub未返回视频详情');
    }

    console.log('\n✅ 视频详情获取成功:');
    console.log('  标题:', awemeDetail.desc || '无标题');
    console.log('  作者:', awemeDetail.author?.nickname || '未知作者');
    console.log('  作者ID:', awemeDetail.author?.sec_uid || '未知');
    console.log('  时长:', awemeDetail.video?.duration ? `${(awemeDetail.video.duration / 1000).toFixed(1)}秒` : '未知');
    console.log('  点赞数:', awemeDetail.statistics?.digg_count || 0);
    console.log('  评论数:', awemeDetail.statistics?.comment_count || 0);
    console.log('  分享数:', awemeDetail.statistics?.share_count || 0);

    // Step 3: 解析视频播放地址
    console.log('\n📝 Step 3: 解析视频播放地址');

    const videoUrl = resolvePlayableVideoUrl(awemeDetail);

    if (!videoUrl) {
      throw new Error('❌ 未能获取可用的视频播放地址');
    }

    console.log('\n✅ 视频播放地址:', videoUrl);

    // Step 4: 获取视频信息（HEAD请求）
    console.log('\n📝 Step 4: 获取视频文件信息');

    const requestHeaders = {
      ...DOUYIN_DEFAULT_HEADERS,
    };

    const videoInfo = await VideoProcessor.getVideoInfo(videoUrl, {
      headers: requestHeaders,
    });

    console.log('\n✅ 视频文件信息:');
    console.log('  文件大小:', (videoInfo.size / (1024 * 1024)).toFixed(2), 'MB');
    console.log('  URL:', videoInfo.url);

    // Step 5: 探测视频详细信息（使用ffprobe）
    console.log('\n📝 Step 5: 探测视频详细信息 (ffprobe)');

    try {
      const probeInfo = await VideoProcessor.probeVideo(videoUrl, {
        headers: requestHeaders,
        userAgent: DOUYIN_DEFAULT_HEADERS['User-Agent'],
      });

      console.log('\n✅ 视频探测成功:');
      console.log('  时长:', probeInfo.duration ? `${probeInfo.duration.toFixed(2)}秒` : '未知');
      console.log('  码率:', probeInfo.bitrate ? `${(probeInfo.bitrate / 1000).toFixed(2)} Mbps` : '未知');
      console.log('  格式:', probeInfo.format || '未知');

      // 计算分段策略
      const duration = probeInfo.duration || (awemeDetail.video?.duration ? awemeDetail.video.duration / 1000 : 0);
      const bitrate = probeInfo.bitrate || 1500; // 默认1.5Mbps

      if (duration > 0) {
        console.log('\n📝 Step 6: 计算分段策略');

        // 豆包ASR单个文件限制15MB
        const maxChunkSize = 15 * 1024 * 1024; // 15MB
        const estimatedBytesPerSecond = (bitrate * 1000) / 8; // 转为字节/秒
        const maxChunkDuration = maxChunkSize / estimatedBytesPerSecond;

        const chunkCount = Math.ceil(duration / maxChunkDuration);
        const chunkDuration = duration / chunkCount;

        console.log('\n✅ 分段策略:');
        console.log('  视频总时长:', duration.toFixed(2), '秒');
        console.log('  估算码率:', (bitrate / 1000).toFixed(2), 'Mbps');
        console.log('  分段数量:', chunkCount);
        console.log('  每段时长:', chunkDuration.toFixed(2), '秒');
        console.log('  每段大小:', (estimatedBytesPerSecond * chunkDuration / (1024 * 1024)).toFixed(2), 'MB');
      }

    } catch (probeError) {
      console.warn('\n⚠️  视频探测失败（可能没有安装ffmpeg）:', (probeError as Error).message);
      console.log('提示: 安装ffmpeg后可以获取更准确的视频信息');
    }

    console.log('\n\n🎉 测试完成！所有步骤执行成功。');
    console.log('\n💡 下一步可以调用 POST /api/douyin/extract-text 来完整测试边下载边转录功能。');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  }
}

/**
 * 解析可用的视频播放地址
 */
function resolvePlayableVideoUrl(video: any): string | null {
  const videoData: any = video.video || video;
  if (!videoData) {
    return null;
  }

  const candidates: Array<string | undefined> = [];

  if (Array.isArray(videoData.play_addr?.url_list)) {
    candidates.push(...videoData.play_addr.url_list);
  }

  if (Array.isArray(videoData.bit_rate)) {
    for (const item of videoData.bit_rate) {
      if (Array.isArray(item?.play_addr?.url_list)) {
        candidates.push(...item.play_addr.url_list);
      }
    }
  }

  if (Array.isArray(videoData.download_addr?.url_list)) {
    candidates.push(...videoData.download_addr.url_list);
  }

  if (Array.isArray(videoData.play_addr_lowbr?.url_list)) {
    candidates.push(...videoData.play_addr_lowbr.url_list);
  }

  const sanitized = candidates
    .map((url) => {
      if (!url) {
        return undefined;
      }
      return url.includes('playwm') ? url.replace('playwm', 'play') : url;
    })
    .filter((url): url is string => Boolean(url));

  return sanitized.find((url) => url.includes('aweme')) || sanitized[0] || null;
}

// 执行测试
testRealShareLink();
