/**
 * 详细诊断转录问题
 */

// 加载环境变量
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function diagnose() {
  console.log('🔍 诊断转录问题\n');

  // 1. 检查环境变量
  console.log('1️⃣ 环境变量检查:');
  const doubaoKey = process.env.DOUBAO_ASR_API_KEY;
  const llmKey = process.env.LLM_API_KEY;

  console.log(`  DOUBAO_ASR_API_KEY: ${doubaoKey ? '✅ 已设置 (sk-***' + doubaoKey.slice(-8) + ')' : '❌ 未设置'}`);
  console.log(`  LLM_API_KEY: ${llmKey ? '✅ 已设置 (sk-***' + llmKey.slice(-8) + ')' : '❌ 未设置'}`);

  const apiKey = doubaoKey || llmKey;

  if (!apiKey) {
    console.log('\n❌ 错误: 没有可用的API Key');
    return;
  }

  console.log(`\n  使用的Key: ${doubaoKey ? 'DOUBAO_ASR_API_KEY' : 'LLM_API_KEY'}`);

  // 2. 测试简单的文本API调用
  console.log('\n2️⃣ 测试简单的文本API调用:');

  try {
    const textResponse = await fetch('https://api.302.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: '请回复"测试成功"',
          },
        ],
        max_tokens: 10,
      }),
    });

    console.log(`  HTTP状态: ${textResponse.status}`);

    if (textResponse.ok) {
      const result = await textResponse.json();
      console.log(`  ✅ 文本API调用成功`);
      console.log(`  响应: ${result.choices?.[0]?.message?.content || '(无内容)'}`);
    } else {
      const errorText = await textResponse.text();
      console.log(`  ❌ 文本API调用失败:`);
      console.log(`  ${errorText}`);
    }
  } catch (error) {
    console.log(`  ❌ 异常: ${error}`);
  }

  // 3. 测试 gpt-4o-audio-preview 模型是否可用
  console.log('\n3️⃣ 测试 gpt-4o-audio-preview 模型:');

  // 创建一个极简的测试音频(1秒的静音)
  const silentAudio = 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7////////////////////////////////////////////AAAAAExhdmM1OC4xMzQAAAAAAAAAAAAAAAAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

  try {
    const audioResponse = await fetch('https://api.302.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-audio-preview',
        modalities: ['text'],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请转录这段音频',
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: silentAudio,
                  format: 'mp3',
                },
              },
            ],
          },
        ],
        max_tokens: 100,
      }),
    });

    console.log(`  HTTP状态: ${audioResponse.status}`);

    if (audioResponse.ok) {
      const result = await audioResponse.json();
      const content = result.choices?.[0]?.message?.content || '';

      if (content.toLowerCase().includes("i'm sorry") || content.toLowerCase().includes("i can't")) {
        console.log(`  ⚠️  GPT拒绝转录:`);
        console.log(`  "${content}"`);
      } else {
        console.log(`  ✅ 音频API调用成功`);
        console.log(`  响应: ${content}`);
      }
    } else {
      const errorText = await audioResponse.text();
      console.log(`  ❌ 音频API调用失败:`);
      console.log(`  ${errorText}`);

      // 解析错误信息
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          console.log('\n  错误详情:');
          console.log(`  - 错误码: ${errorJson.error.err_code || errorJson.error.code || '未知'}`);
          console.log(`  - 错误信息: ${errorJson.error.message || errorJson.error.message_cn || '未知'}`);

          if (errorJson.error.err_code === -10003) {
            console.log('\n  💡 可能的原因:');
            console.log('     1. 该API Key不支持 gpt-4o-audio-preview 模型');
            console.log('     2. 音频格式或参数不正确');
            console.log('     3. 账户配额不足或权限限制');
          }
        }
      } catch (e) {
        // 忽略JSON解析错误
      }
    }
  } catch (error) {
    console.log(`  ❌ 异常: ${error}`);
  }

  // 4. 建议
  console.log('\n4️⃣ 诊断建议:');
  console.log('  检查302.AI账户:');
  console.log('  1. 登录 https://302.ai');
  console.log('  2. 检查API Key是否有效');
  console.log('  3. 确认账户是否开通了 gpt-4o-audio-preview 模型权限');
  console.log('  4. 查看配额使用情况');
  console.log('\n  如果该模型不可用,可以考虑:');
  console.log('  - 使用其他语音转录服务(如Whisper API)');
  console.log('  - 联系302.AI客服开通权限');
  console.log('  - 更换支持该模型的API提供商');
}

diagnose().catch(console.error);
