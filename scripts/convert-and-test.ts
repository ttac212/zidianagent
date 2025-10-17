/**
 * 转换音频格式并测试
 * 将MP3转为ASR友好格式（16kHz单声道）
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function convertAudio(inputFile: string, outputFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('🔄 转换音频格式...');
    console.log(`   输入: ${path.basename(inputFile)}`);
    console.log(`   输出: ${path.basename(outputFile)}`);
    console.log(`   格式: 16kHz, 单声道, 64kbps MP3`);

    const ffmpeg = spawn('ffmpeg', [
      '-i', inputFile,
      '-ar', '16000',       // 16kHz采样率
      '-ac', '1',           // 单声道
      '-b:a', '64k',        // 64kbps比特率
      '-f', 'mp3',
      '-y',                 // 覆盖输出文件
      outputFile
    ]);

    ffmpeg.stderr.on('data', (data) => {
      // FFmpeg输出到stderr
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        const stats = fs.statSync(outputFile);
        console.log(`✅ 转换完成: ${(stats.size / 1024).toFixed(2)} KB`);
        resolve();
      } else {
        reject(new Error(`FFmpeg退出码: ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}

async function main() {
  console.log('🎵 音频转换并测试\n');

  const inputFile = 'D:\\zdqidongxiangmu\\2022-09-05 18.57.21-视频-百合玛帛窗帘工厂-7139848114730536200.mp3';
  const outputFile = inputFile.replace('.mp3', '_converted.mp3');

  // 1. 转换音频格式
  await convertAudio(inputFile, outputFile);

  // 2. 读取转换后的文件
  console.log('\n📖 读取转换后的音频...');
  const audioBuffer = fs.readFileSync(outputFile);
  console.log(`   大小: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

  // 3. 转base64
  console.log('\n🔄 转换为Base64...');
  const base64Audio = audioBuffer.toString('base64');
  console.log(`   Base64长度: ${base64Audio.length} 字符`);

  // 4. 调用API
  console.log('\n🚀 调用豆包ASR API...');
  const apiKey = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY;
  const apiUrl = process.env.DOUBAO_ASR_API_URL || 'https://api.302.ai/doubao/largemodel/recognize';

  const requestBody = { data: base64Audio };

  const startTime = Date.now();
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
  console.log(`   HTTP状态: ${response.status}`);

  const result = await response.json();

  console.log('\n' + '='.repeat(80));
  console.log('📝 API响应:');
  console.log('='.repeat(80));
  console.log(JSON.stringify(result, null, 2));
  console.log('='.repeat(80));

  if (result.code === 20000000) {
    const text = result.result?.text || '';
    console.log('\n✅ 识别成功!');
    console.log('📝 文本内容:');
    console.log('─'.repeat(80));
    console.log(text || '(无内容)');
    console.log('─'.repeat(80));

    if (text) {
      // 保存结果
      const txtFile = inputFile.replace('.mp3', '_转录文本.txt');
      fs.writeFileSync(txtFile, text, 'utf-8');
      console.log(`\n💾 已保存到: ${txtFile}`);
    }
  } else {
    console.error('\n❌ 识别失败，错误码:', result.code);
  }

  // 清理临时文件
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
    console.log('\n🧹 已清理临时文件');
  }

  console.log('\n✅ 完成!\n');
}

main().catch((error) => {
  console.error('\n❌ 错误:', error);
  process.exit(1);
});
