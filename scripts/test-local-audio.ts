/**
 * 快速测试脚本 - 直接转录本地MP3文件
 * 运行: npx tsx scripts/test-local-audio.ts
 */

// 加载环境变量
import { config } from 'dotenv';
config({ path: '.env.local' });

import { DoubaoASRClient } from '../lib/ai/doubao-asr';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🎵 开始转录本地音频文件...\n');

  // 文件路径
  const audioFile = 'D:\\zdqidongxiangmu\\2022-09-05 18.57.21-视频-百合玛帛窗帘工厂-7139848114730536200.mp3';

  // 1. 检查文件
  console.log('1️⃣ 检查文件...');
  if (!fs.existsSync(audioFile)) {
    console.error('❌ 文件不存在:', audioFile);
    process.exit(1);
  }

  const stats = fs.statSync(audioFile);
  const fileSizeMB = stats.size / (1024 * 1024);
  console.log(`✅ 文件找到: ${path.basename(audioFile)}`);
  console.log(`   大小: ${fileSizeMB.toFixed(2)} MB`);

  if (fileSizeMB > 20) {
    console.error('❌ 文件超过20MB限制，请先压缩或分段处理');
    process.exit(1);
  }

  // 2. 读取文件
  console.log('\n2️⃣ 读取音频文件...');
  const audioBuffer = fs.readFileSync(audioFile);
  console.log(`✅ 读取完成: ${audioBuffer.length} 字节`);

  // 3. 转为base64
  console.log('\n3️⃣ 转换为Base64...');
  const base64Audio = audioBuffer.toString('base64');
  console.log(`✅ Base64长度: ${base64Audio.length} 字符`);

  // 4. 调用豆包ASR API
  console.log('\n4️⃣ 调用豆包ASR API...');
  const apiKey = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY;
  const apiUrl = process.env.DOUBAO_ASR_API_URL || 'https://api.302.ai/doubao/largemodel/recognize';

  if (!apiKey) {
    console.error('❌ 未配置API Key');
    process.exit(1);
  }

  const client = new DoubaoASRClient({
    apiKey,
    baseUrl: apiUrl,
  });

  console.log('   发送请求...');
  const startTime = Date.now();

  const result = await client.recognize({
    audio: base64Audio,
    format: 'mp3',
    isUrl: false,
  });

  const duration = Date.now() - startTime;

  // 5. 显示结果
  console.log('\n' + '='.repeat(60));

  // 调试：显示完整响应
  console.log('🔍 调试信息 - API完整响应:');
  console.log(JSON.stringify(result, null, 2));
  console.log('='.repeat(60) + '\n');

  if (result.success) {
    console.log('✅ 转录成功!');
    console.log(`⏱️  耗时: ${(duration / 1000).toFixed(2)}秒`);
    console.log('\n📝 转录文本:');
    console.log('─'.repeat(60));
    console.log(result.text || '(无内容)');
    console.log('─'.repeat(60));

    if (result.text) {
      console.log(`\n📊 字数统计: ${result.text.length} 字`);
    }

    // 保存到文件
    const outputFile = audioFile.replace('.mp3', '_转录文本.txt');
    fs.writeFileSync(outputFile, result.text || '', 'utf-8');
    console.log(`\n💾 已保存到: ${outputFile}`);
  } else {
    console.error('❌ 转录失败:', result.error);
    process.exit(1);
  }

  console.log('\n✅ 完成！\n');
}

main().catch((error) => {
  console.error('\n💥 发生错误:', error);
  process.exit(1);
});
