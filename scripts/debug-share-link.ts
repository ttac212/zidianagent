/**
 * 测试抖音分享链接解析 - 调试版本
 *
 * 用于调试特定的分享链接为什么无法获取转录数据
 */

import { parseDouyinVideoShare } from '@/lib/douyin/share-link';
import { getTikHubClient } from '@/lib/tikhub';

const testLink = `6.64 ygo:/ 08/06 U@L.JV 成都一站式装修建材超市 正在筹备中 敬请期待# 装修材料 # 工程材料 # 批发 # 一站式采购 # 集采  https://v.douyin.com/dn2WTcNpnRA/ 复制此链接，打开Dou音搜索，直接观看视频！  文案`;

async function debugShareLink() {
  console.log('🔍 开始测试分享链接解析...\n');
  console.log('分享文本:', testLink);
  console.log('\n' + '='.repeat(80) + '\n');

  try {
    // 步骤1: 解析分享链接
    console.log('📋 步骤1: 解析分享链接');
    const shareResult = await parseDouyinVideoShare(testLink);
    console.log('✅ 解析成功:');
    console.log('  - 原始链接:', shareResult.originalUrl);
    console.log('  - 重定向后:', shareResult.resolvedUrl);
    console.log('  - 视频ID:', shareResult.videoId || '❌ 未提取到');
    console.log('  - 用户ID:', shareResult.userId || '(无)');
    console.log('  - SecUserId:', shareResult.secUserId || '(无)');

    if (!shareResult.videoId) {
      console.log('\n❌ 错误: 无法从链接中提取视频ID');
      console.log('   这可能是因为:');
      console.log('   1. 链接不是视频链接(可能是用户主页、直播等)');
      console.log('   2. 链接已过期或无效');
      console.log('   3. 抖音修改了URL格式');
      return;
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // 步骤2: 调用TikHub API获取视频详情
    console.log('📋 步骤2: 调用TikHub API获取视频详情');
    const tikhubClient = getTikHubClient();

    console.log(`正在请求视频详情 (aweme_id: ${shareResult.videoId})...`);
    const videoDetail = await tikhubClient.getVideoDetail({
      aweme_id: shareResult.videoId,
    });

    console.log('✅ TikHub API响应成功');

    // 检查响应结构
    console.log('\n响应结构检查:');
    console.log('  - videoDetail存在:', !!videoDetail);
    console.log('  - aweme_detail存在:', !!videoDetail?.aweme_detail);

    const awemeDetail = videoDetail?.aweme_detail;

    if (!awemeDetail) {
      console.log('\n❌ 错误: TikHub未返回视频详情数据');
      console.log('   完整响应:', JSON.stringify(videoDetail, null, 2));
      return;
    }

    // 显示视频基本信息
    console.log('\n视频基本信息:');
    console.log('  - 标题:', awemeDetail.desc || '(无标题)');
    console.log('  - 作者:', awemeDetail.author?.nickname || '(未知)');
    console.log('  - 视频ID:', awemeDetail.aweme_id);
    console.log('  - 创建时间:', awemeDetail.create_time ? new Date(awemeDetail.create_time * 1000).toLocaleString('zh-CN') : '(未知)');

    // 检查视频数据结构
    console.log('\n视频数据结构:');
    console.log('  - video对象存在:', !!awemeDetail.video);
    console.log('  - video.duration:', awemeDetail.video?.duration || '(无)');
    console.log('  - video.play_addr存在:', !!awemeDetail.video?.play_addr);
    console.log('  - video.play_addr.url_list长度:', awemeDetail.video?.play_addr?.url_list?.length || 0);
    console.log('  - video.bit_rate长度:', awemeDetail.video?.bit_rate?.length || 0);
    console.log('  - video.download_addr存在:', !!awemeDetail.video?.download_addr);

    // 尝试解析视频URL
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📋 步骤3: 解析视频播放地址');

    const videoUrl = resolvePlayableVideoUrl(awemeDetail);

    if (!videoUrl) {
      console.log('❌ 错误: 未能获取可用的视频播放地址');
      console.log('\n可能的原因:');
      console.log('  1. 视频已被删除或设为私密');
      console.log('  2. 视频数据结构异常');
      console.log('  3. TikHub API返回的数据不完整');

      // 显示详细的video对象结构
      console.log('\nvideo对象详情:');
      if (awemeDetail.video) {
        console.log(JSON.stringify({
          duration: awemeDetail.video.duration,
          has_play_addr: !!awemeDetail.video.play_addr,
          play_addr_urls: awemeDetail.video.play_addr?.url_list?.length || 0,
          has_bit_rate: !!awemeDetail.video.bit_rate,
          bit_rate_count: awemeDetail.video.bit_rate?.length || 0,
          has_download_addr: !!awemeDetail.video.download_addr,
          download_addr_urls: awemeDetail.video.download_addr?.url_list?.length || 0,
        }, null, 2));
      } else {
        console.log('  video对象不存在');
      }
      return;
    }

    console.log('✅ 成功获取视频播放地址');
    console.log('  URL:', videoUrl.substring(0, 100) + '...');

    // 步骤4: 检查视频是否可访问
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📋 步骤4: 检查视频是否可访问');

    try {
      const headResponse = await fetch(videoUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          'Referer': 'https://www.douyin.com/',
        },
      });

      if (headResponse.ok) {
        const contentLength = headResponse.headers.get('content-length');
        const contentType = headResponse.headers.get('content-type');

        console.log('✅ 视频可访问');
        console.log('  - HTTP状态:', headResponse.status);
        console.log('  - Content-Type:', contentType);
        console.log('  - Content-Length:', contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB` : '(未知)');

        console.log('\n✅ 结论: 该链接可以正常获取转录数据');
        console.log('   如果实际使用中仍然失败，可能是:');
        console.log('   1. 环境变量配置问题(API Key)');
        console.log('   2. 网络连接问题');
        console.log('   3. GPT-4o Audio Preview API配额或限制');
      } else {
        console.log('❌ 视频无法访问');
        console.log('  - HTTP状态:', headResponse.status);
        console.log('  - 可能原因: 需要特殊的headers或cookies');
      }
    } catch (error) {
      console.log('❌ 检查视频访问失败:', error instanceof Error ? error.message : error);
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error('错误信息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  }
}

// 从API代码复制的函数
function resolvePlayableVideoUrl(video: any): string | null {
  const videoData: any = video.video || video;
  if (!videoData) return null;

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

  const sanitized = candidates
    .map((url) => (url?.includes('playwm') ? url.replace('playwm', 'play') : url))
    .filter((url): url is string => Boolean(url));

  return sanitized.find((url) => url.includes('aweme')) || sanitized[0] || null;
}

// 运行测试
debugShareLink().catch(console.error);
