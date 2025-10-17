/**
 * 测试多个抖音分享链接的解析
 */

import { parseDouyinVideoShare } from '@/lib/douyin/share-link';
import { getTikHubClient } from '@/lib/tikhub';

const SHARE_LINKS = [
  `2.84 dan:/ 12/24 j@C.UY 断桥封窗记住这7点！能少踩90%%的坑！# 南宁装修胡豆先生 # 胡豆先生案例号 # 封阳台  断桥封窗记住这7点！能少踩90%的坑！#南宁装修胡豆先生 #胡豆先生案例号 #封阳台 - 抖音 复制此链接，打开Dou音搜索，直接观看视频！`,

  `1.05 10/11 ipq:/ W@Z.mq 我是广西被人骂的最惨的钢材厂老板 # 广西 # 广西钢材 # 广西南宁 # 钢材批发 # 南宁钢材市场  https://v.douyin.com/yEqYko1oXj4/ 复制此链接，打开Dou音搜索，直接观看视频！`,

  `1.05 10/11 ipq:/ W@Z.mq 我是广西被人骂的最惨的钢材厂老板 # 广西 # 广西钢材 # 广西南宁 # 钢材批发 # 南宁钢材市场  我是广西被人骂的最惨的钢材厂老板 #广西 #广西钢材 #广西南宁 #钢材批发 #南宁钢材市场 - 抖音 复制此链接，打开Dou音搜索，直接观看视频！`,

  `0.02 vfB:/ 07/15 K@J.vs 钢材源头批发商，从咨询到送货，全程为您服务 # 镀锌管 # 钢材 # 钢结构 # 热镀锌  https://v.douyin.com/ol6sxUob4qg/ 复制此链接，打开Dou音搜索，直接观看视频！`,

  `0.02 vfB:/ 07/15 K@J.vs 钢材源头批发商，从咨询到送货，全程为您服务 # 镀锌管 # 钢材 # 钢结构 # 热镀锌  钢材源头批发商，从咨询到送货，全程为您服务 #镀锌管 #钢材 #钢结构 #热镀锌 - 抖音 复制此链接，打开Dou音搜索，直接观看视频！`,

  `0.76 J@I.VY 02/17 ZZz:/ 258/平多层实木板，是我们浩枫给各位同行打破价格战的底气# 板材 # 多层实木板  https://v.douyin.com/A6bVzdLFT5Y/ 复制此链接，打开Dou音搜索，直接观看视频！`,

  `0.76 J@I.VY 02/17 ZZz:/ 258/平多层实木板，是我们浩枫给各位同行打破价格战的底气# 板材 # 多层实木板  258/平多层实木板，是我们浩枫给各位同行打破价格战的底气#板材 #多层实木板 - 抖音 复制此链接，打开Dou音搜索，直接观看视频！`,

  `0.76 J@I.VY 02/17 ZZz:/ 258/平多层实木板，是我们浩枫给各位同行打破价格战的底气# 板材 # 多层实木板  258/平多层实木板，是我们浩枫给各位同行打破价格战的底气#板材 #多层实木板 - 抖音 复制此链接，打开Dou音搜索，直接观看视频！`,

  `9.79 hbn:/ k@C.hO 10/02 258/平多层实木板，可以来工厂看看板材小样# 板材 # 多层实木板  258/平多层实木板，可以来工厂看看板材小样#板材 #多层实木板 - 抖音 复制此链接，打开Dou音搜索，直接观看视频！`,

  `4.30 X@m.QK zgb:/ 03/04 欢迎定制门店、装饰公司老板们合作共赢# 全屋定制工厂 # 全屋定制 # 源头工厂  欢迎定制门店、装饰公司老板们合作共赢#全屋定制工厂 #全屋定制 #源头工厂 - 抖音 复制此链接，打开Dou音搜索，直接观看视频`
];

interface TestResult {
  index: number;
  success: boolean;
  videoId?: string;
  title?: string;
  author?: string;
  duration?: number;
  error?: string;
  shareLink: string;
}

async function testSingleLink(shareLink: string, index: number): Promise<TestResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`测试 #${index + 1}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`分享链接: ${shareLink.substring(0, 100)}...`);

  try {
    // 1. 解析分享链接
    console.log('\n步骤1: 解析分享链接...');
    const parseResult = await parseDouyinVideoShare(shareLink);

    if (!parseResult.videoId) {
      return {
        index,
        success: false,
        error: '无法提取视频ID',
        shareLink: shareLink.substring(0, 100)
      };
    }

    console.log(`✅ 视频ID: ${parseResult.videoId}`);

    // 2. 获取视频详情
    console.log('\n步骤2: 获取视频详情...');
    const tikhubClient = getTikHubClient();
    const videoDetail = await tikhubClient.getVideoDetail({
      aweme_id: parseResult.videoId,
    });

    const awemeDetail = videoDetail?.aweme_detail;
    if (!awemeDetail) {
      return {
        index,
        success: false,
        videoId: parseResult.videoId,
        error: 'TikHub未返回视频详情',
        shareLink: shareLink.substring(0, 100)
      };
    }

    const title = awemeDetail.desc || '未知标题';
    const author = awemeDetail.author?.nickname || '未知作者';
    const duration = awemeDetail.video?.duration
      ? (awemeDetail.video.duration >= 1000
          ? awemeDetail.video.duration / 1000
          : awemeDetail.video.duration)
      : 0;

    console.log(`✅ 标题: ${title}`);
    console.log(`✅ 作者: ${author}`);
    console.log(`✅ 时长: ${duration.toFixed(1)}秒`);

    return {
      index,
      success: true,
      videoId: parseResult.videoId,
      title,
      author,
      duration,
      shareLink: shareLink.substring(0, 100)
    };

  } catch (error) {
    console.error(`❌ 测试失败:`, error);
    return {
      index,
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      shareLink: shareLink.substring(0, 100)
    };
  }
}

async function main() {
  console.log('🧪 开始测试多个抖音分享链接\n');
  console.log(`总共 ${SHARE_LINKS.length} 个链接需要测试\n`);

  const results: TestResult[] = [];

  // 逐个测试
  for (let i = 0; i < SHARE_LINKS.length; i++) {
    const result = await testSingleLink(SHARE_LINKS[i], i);
    results.push(result);

    // 等待1秒避免API限流
    if (i < SHARE_LINKS.length - 1) {
      console.log('\n⏳ 等待1秒...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 输出总结
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('测试总结');
  console.log('='.repeat(80));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`\n✅ 成功: ${successCount}/${SHARE_LINKS.length}`);
  console.log(`❌ 失败: ${failCount}/${SHARE_LINKS.length}`);

  // 成功的链接
  if (successCount > 0) {
    console.log('\n\n✅ 成功解析的链接:');
    console.log('-'.repeat(80));
    results.filter(r => r.success).forEach(r => {
      console.log(`\n#${r.index + 1}:`);
      console.log(`  视频ID: ${r.videoId}`);
      console.log(`  标题: ${r.title}`);
      console.log(`  作者: ${r.author}`);
      console.log(`  时长: ${r.duration?.toFixed(1)}秒`);
    });
  }

  // 失败的链接
  if (failCount > 0) {
    console.log('\n\n❌ 解析失败的链接:');
    console.log('-'.repeat(80));
    results.filter(r => !r.success).forEach(r => {
      console.log(`\n#${r.index + 1}:`);
      console.log(`  分享链接: ${r.shareLink}...`);
      console.log(`  错误: ${r.error}`);
      if (r.videoId) {
        console.log(`  视频ID: ${r.videoId}`);
      }
    });
  }

  console.log('\n\n🎉 测试完成！\n');
}

main().catch(console.error);
