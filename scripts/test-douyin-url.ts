/**
 * 从抖音视频链接提取音频并转录
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function downloadAndExtractAudio(videoUrl: string, outputAudio: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('📥 下载视频并提取音频...');
    console.log(`   来源: ${videoUrl.substring(0, 80)}...`);
    console.log(`   输出: ${path.basename(outputAudio)}`);

    const ffmpeg = spawn('ffmpeg', [
      '-i', videoUrl,
      '-vn',                // 不处理视频
      '-ar', '16000',       // 16kHz采样率
      '-ac', '1',           // 单声道
      '-b:a', '64k',        // 64kbps比特率
      '-f', 'mp3',
      '-y',
      outputAudio
    ]);

    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
      // 显示进度
      const progressMatch = data.toString().match(/time=(\d+:\d+:\d+\.\d+)/);
      if (progressMatch) {
        process.stdout.write(`\r   处理中: ${progressMatch[1]}`);
      }
    });

    ffmpeg.on('close', (code) => {
      process.stdout.write('\n');
      if (code === 0 && fs.existsSync(outputAudio)) {
        const stats = fs.statSync(outputAudio);
        console.log(`✅ 音频提取完成: ${(stats.size / 1024).toFixed(2)} KB`);
        resolve();
      } else {
        console.error('FFmpeg输出:', errorOutput.substring(errorOutput.length - 500));
        reject(new Error(`FFmpeg失败，退出码: ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg错误: ${error.message}`));
    });
  });
}

async function transcribeAudio(audioFile: string): Promise<string> {
  console.log('\n🚀 调用豆包ASR API转录...');

  // 读取音频
  const audioBuffer = fs.readFileSync(audioFile);
  console.log(`   音频大小: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

  // 转base64
  const base64Audio = audioBuffer.toString('base64');
  console.log(`   Base64长度: ${base64Audio.length} 字符`);

  // 调用API
  const apiKey = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY;
  const apiUrl = process.env.DOUBAO_ASR_API_URL || 'https://api.302.ai/doubao/largemodel/recognize';

  const requestBody = { data: base64Audio };

  console.log('   发送请求到豆包ASR...');
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

  if (result.code === 20000000) {
    return result.result?.text || '';
  } else {
    throw new Error(`API错误码: ${result.code}`);
  }
}

async function main() {
  console.log('🎬 抖音视频转文案\n');

  const videoUrl = 'https://www.douyin.com/aweme/v1/play/?video_id=v0300fg10000d16irrfog65he9vketug&line=0&file_id=c606643946304ad7b71010c418fdb75d&sign=9e33ab22e7f70d1cd8657c9a04d01109&is_play_url=1&source=PackSourceEnum_PUBLISH';

  const tempAudioFile = path.join(process.cwd(), 'temp_douyin_audio.mp3');
  const outputTextFile = path.join(process.cwd(), 'douyin_transcript.txt');

  try {
    // 1. 下载视频并提取音频
    await downloadAndExtractAudio(videoUrl, tempAudioFile);

    // 2. 转录音频
    const text = await transcribeAudio(tempAudioFile);

    // 3. 显示结果
    console.log('\n' + '='.repeat(80));
    console.log('📝 转录文本:');
    console.log('='.repeat(80));
    console.log(text || '(未识别到内容)');
    console.log('='.repeat(80));

    if (text) {
      // 保存到文件
      fs.writeFileSync(outputTextFile, text, 'utf-8');
      console.log(`\n💾 已保存到: ${outputTextFile}`);
      console.log(`📊 字数: ${text.length} 字`);
    }

    console.log('\n✅ 完成!\n');
  } catch (error) {
    console.error('\n❌ 错误:', error instanceof Error ? error.message : error);
  } finally {
    // 清理临时文件
    if (fs.existsSync(tempAudioFile)) {
      fs.unlinkSync(tempAudioFile);
      console.log('🧹 已清理临时文件');
    }
  }
}

main().catch((error) => {
  console.error('💥 未捕获的错误:', error);
  process.exit(1);
});
