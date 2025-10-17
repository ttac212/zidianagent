/**
 * 使用在线音频URL测试豆包ASR
 * 避免base64编码问题
 */

// 加载环境变量
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  console.log('🎵 使用URL方式测试豆包ASR\n');

  const apiKey = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY;
  const apiUrl = process.env.DOUBAO_ASR_API_URL || 'https://api.302.ai/doubao/largemodel/recognize';

  // 使用302.ai文档中的示例音频URL
  const testAudioUrl = 'https://file.302.ai/gpt/imgs/20250701/a2057cbb50b14e779b11af54c38e6265.mp3';

  console.log('1️⃣ 测试URL:', testAudioUrl);
  console.log('2️⃣ API端点:', apiUrl);
  console.log('3️⃣ 发送请求...\n');

  const requestBody = {
    url: testAudioUrl,
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📡 响应状态:', response.status, response.statusText);

    const responseText = await response.text();
    console.log('📝 响应内容:\n');
    console.log('='.repeat(80));
    console.log(responseText);
    console.log('='.repeat(80));

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('\n✅ 解析成功！');
      console.log('📊 JSON结构:');
      console.log(JSON.stringify(result, null, 2));

      // 查找文本内容
      const possibleTextFields = ['text', 'result', 'transcript', 'data', 'content', 'output', 'response'];
      console.log('\n🔍 查找文本字段:');
      for (const field of possibleTextFields) {
        if (result[field]) {
          console.log(`   ✅ 找到 .${field}:`, result[field]);
        }
      }

      // 显示所有字段
      console.log('\n📋 所有字段:', Object.keys(result).join(', '));
    }
  } catch (error) {
    console.error('\n❌ 错误:', error);
  }

  console.log('\n✅ 测试完成\n');
}

main().catch(console.error);
