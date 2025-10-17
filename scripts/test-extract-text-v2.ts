/**
 * 完整测试抖音视频文案提取 (Elevenlabs STT版本)
 */

const SHARE_TEXT = `7.15 07/10 Xzt:/ H@V.lp # 瓦瓦  https://v.douyin.com/MUbEduO9AME/ 复制此链接，打开Dou音搜索，直接观看视频！`;

async function testExtractTextV2() {
  console.log('🧪 测试抖音视频文案提取API (Elevenlabs STT版本)\n');
  console.log('分享链接:', SHARE_TEXT);
  console.log('开始调用 API...\n');

  try {
    const response = await fetch('http://localhost:3007/api/douyin/extract-text-v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shareLink: SHARE_TEXT,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API调用失败: ${response.status} ${response.statusText}\n${errorText}`);
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    // 读取SSE流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('\n✅ 流结束');
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // 处理完整的SSE事件
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6);
          try {
            const event = JSON.parse(dataStr);
            handleEvent(event);
          } catch (e) {
            console.error('解析事件失败:', dataStr);
          }
        }
      }
    }

    console.log('\n🎉 测试完成！');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
    }
    process.exit(1);
  }
}

function handleEvent(event: any) {
  const { type, ...data } = event;

  switch (type) {
    case 'progress':
      console.log(`⏳ [${data.stage}] ${data.message}`);
      if (data.percent !== undefined) {
        console.log(`   进度: ${data.percent}%`);
      }
      break;

    case 'info':
      console.log(`ℹ️  [${data.stage}] ${data.message}`);
      if (data.videoInfo) {
        console.log('   视频信息:', JSON.stringify(data.videoInfo, null, 2));
      }
      if (data.taskId) {
        console.log('   任务ID:', data.taskId);
      }
      break;

    case 'done':
      console.log('\n✅ 处理完成！\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('最终结果:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      if (data.videoInfo) {
        console.log('📹 视频信息:');
        console.log(`   标题: ${data.videoInfo.title}`);
        console.log(`   作者: ${data.videoInfo.author}`);
        console.log(`   时长: ${data.videoInfo.duration?.toFixed(1)}秒`);
        console.log(`   视频ID: ${data.videoInfo.videoId}\n`);
      }

      if (data.stats) {
        console.log('📊 统计信息:');
        console.log(`   总字符数: ${data.stats.totalCharacters}\n`);
      }

      console.log('📝 优化后的文案:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(data.text);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      if (data.originalText && data.originalText !== data.text) {
        console.log('📝 原始转录文本:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(data.originalText);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
      break;

    case 'warning':
      console.warn(`⚠️  警告: ${data.message}`);
      break;

    case 'error':
      console.error(`❌ 错误: ${data.message}`);
      if (data.details) {
        console.error('详情:', data.details);
      }
      break;

    default:
      console.log(`[${type}]`, data);
  }
}

// 检查开发服务器是否运行
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3007/api/health', { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log('检查开发服务器状态...');
  const isServerRunning = await checkServer();

  if (!isServerRunning) {
    console.error('\n❌ 开发服务器未运行！');
    console.log('请先运行: pnpm dev');
    console.log('等待服务器启动后再执行此脚本\n');
    process.exit(1);
  }

  console.log('✅ 服务器运行中\n');
  await testExtractTextV2();
}

main();
