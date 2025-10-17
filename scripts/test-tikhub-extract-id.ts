/**
 * 测试TikHub extractAwemeId API
 */

import { getTikHubClient } from '@/lib/tikhub';

const TEST_CASES = [
  // 有URL的分享链接
  {
    name: '带URL的分享链接',
    text: '1.05 10/11 ipq:/ W@Z.mq 我是广西被人骂的最惨的钢材厂老板 # 广西 # 广西钢材 # 广西南宁 # 钢材批发 # 南宁钢材市场  https://v.douyin.com/yEqYko1oXj4/ 复制此链接，打开Dou音搜索，直接观看视频！',
  },
  // 纯短代码
  {
    name: '纯短代码分享文本',
    text: '2.84 dan:/ 12/24 j@C.UY 断桥封窗记住这7点！能少踩90%%的坑！# 南宁装修胡豆先生 # 胡豆先生案例号 # 封阳台  断桥封窗记住这7点！能少踩90%的坑！#南宁装修胡豆先生 #胡豆先生案例号 #封阳台 - 抖音 复制此链接，打开Dou音搜索，直接观看视频！',
  },
  // 纯URL
  {
    name: '纯URL',
    text: 'https://v.douyin.com/yEqYko1oXj4/',
  },
];

async function testExtractId(testCase: { name: string; text: string }) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`测试: ${testCase.name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`输入文本: ${testCase.text.substring(0, 100)}...`);

  try {
    const client = getTikHubClient();
    console.log('\n调用 TikHub API...');

    const videoId = await client.extractAwemeId(testCase.text);

    console.log(`✅ 成功提取视频ID: ${videoId}`);
    return { success: true, videoId };
  } catch (error: any) {
    console.error(`❌ 提取失败:`, error);
    if (error.message) {
      console.error(`错误消息: ${error.message}`);
    }
    if (error.details) {
      console.error(`错误详情:`, JSON.stringify(error.details, null, 2));
    }
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🧪 测试 TikHub extractAwemeId API\n');

  for (const testCase of TEST_CASES) {
    await testExtractId(testCase);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n\n🎉 测试完成！');
}

main().catch(console.error);
