/**
 * 直接使用抖音视频URL进行转录
 * 类似官方示例：传入视频URL，让API直接处理
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  console.log('🎬 抖音视频URL转录测试\n');

  // 抖音视频播放URL
  const douyinVideoUrl = 'https://www.douyin.com/aweme/v1/play/?video_id=v0300fg10000d16irrfog65he9vketug&line=0&file_id=c606643946304ad7b71010c418fdb75d&sign=9e33ab22e7f70d1cd8657c9a04d01109&is_play_url=1&source=PackSourceEnum_PUBLISH';

  const apiKey = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY;
  const apiUrl = process.env.DOUBAO_ASR_API_URL || 'https://api.302.ai/doubao/largemodel/recognize';

  console.log('📋 配置信息:');
  console.log(`   API端点: ${apiUrl}`);
  console.log(`   视频URL: ${douyinVideoUrl.substring(0, 80)}...`);

  // 构建请求体 - 使用URL方式（就像官方示例）
  const requestBody = {
    url: douyinVideoUrl,
  };

  console.log('\n🚀 发送请求到豆包ASR...');
  const startTime = Date.now();

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;
    console.log(`   响应时间: ${(duration / 1000).toFixed(2)}秒`);
    console.log(`   HTTP状态: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log(`   响应大小: ${responseText.length} 字符`);

    // 解析响应
    console.log('\n' + '='.repeat(80));
    console.log('📝 原始响应:');
    console.log('='.repeat(80));
    console.log(responseText);
    console.log('='.repeat(80));

    const result = JSON.parse(responseText);

    console.log('\n📊 解析后的结构:');
    console.log(JSON.stringify(result, null, 2));

    // 检查响应码
    if (result.code === 20000000) {
      const text = result.result?.text || '';
      console.log('\n✅ 转录成功!');
      console.log('\n📝 识别文本:');
      console.log('─'.repeat(80));
      console.log(text || '(无内容)');
      console.log('─'.repeat(80));

      if (text) {
        console.log(`\n📊 统计: ${text.length} 字`);

        // 保存到文件
        const fs = require('fs');
        const outputFile = 'douyin_transcript.txt';
        fs.writeFileSync(outputFile, text, 'utf-8');
        console.log(`💾 已保存到: ${outputFile}`);
      }
    } else {
      console.error(`\n❌ API返回错误码: ${result.code}`);
      if (result.message) {
        console.error(`   错误信息: ${result.message}`);
      }
    }
  } catch (error) {
    console.error('\n❌ 请求失败:', error instanceof Error ? error.message : error);
  }

  console.log('\n✅ 完成!\n');
}

main().catch((error) => {
  console.error('💥 错误:', error);
  process.exit(1);
});
