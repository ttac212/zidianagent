/**
 * 对比不同API Key的转录行为
 * 用于诊断为什么测试成功但项目失败
 */

// 从.env.local读取的API Keys
const DOUBAO_KEY = 'sk-TejZ4OK9mTGkXlhxvBLuIq8XBysElG1E9EDwirvDHBc8Akon';
const LLM_KEY = 'sk-kXpGPba9ZUHQmmYgSzJvZIFrPXC1tTyuB3uhPzHRWgb711nf';

// 测试音频 - 使用一个简短的测试音频(base64编码的"你好"音频)
const TEST_AUDIO_BASE64 = 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7////////////////////////////////////////////AAAAAExhdmM1OC4xMzQAAAAAAAAAAAAAAAAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZDQP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';

async function testAPIKey(apiKey: string, keyName: string, promptText: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`测试: ${keyName}`);
  console.log(`Prompt: ${promptText.substring(0, 50)}...`);
  console.log('='.repeat(80));

  try {
    const response = await fetch('https://api.302.ai/v1/chat/completions', {
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
                text: promptText,
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: TEST_AUDIO_BASE64,
                  format: 'mp3',
                },
              },
            ],
          },
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
    });

    console.log(`HTTP状态: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ 请求失败: ${errorText.substring(0, 200)}`);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';

    if (text.toLowerCase().includes("i'm sorry") || text.toLowerCase().includes("i can't")) {
      console.log(`❌ GPT拒绝转录:`);
      console.log(`   ${text}`);
      return { success: false, refused: true, text };
    }

    console.log(`✅ 转录成功:`);
    console.log(`   ${text}`);
    return { success: true, text };

  } catch (error) {
    console.log(`❌ 异常: ${error instanceof Error ? error.message : error}`);
    return { success: false, error };
  }
}

async function runTests() {
  console.log('🔍 开始对比测试不同API Key和Prompt的组合\n');

  const prompts = [
    {
      name: '旧版Prompt(提到抖音)',
      text: '这是一段抖音视频的音频转录任务。请仔细转录音频内容，只返回转录的文字。',
    },
    {
      name: '新版Prompt(通用)',
      text: '请转录这段音频的内容。请准确识别每个字词，只返回转录的文字。',
    },
  ];

  const apiKeys = [
    { name: 'DOUBAO_ASR_API_KEY', key: DOUBAO_KEY },
    { name: 'LLM_API_KEY (通用Key)', key: LLM_KEY },
  ];

  console.log('测试配置:');
  console.log(`  - API Keys: ${apiKeys.length}个`);
  console.log(`  - Prompts: ${prompts.length}个`);
  console.log(`  - 总测试数: ${apiKeys.length * prompts.length}个\n`);

  const results: any[] = [];

  for (const apiKeyConfig of apiKeys) {
    for (const prompt of prompts) {
      const result = await testAPIKey(apiKeyConfig.key, apiKeyConfig.name, prompt.text);
      results.push({
        apiKey: apiKeyConfig.name,
        prompt: prompt.name,
        ...result,
      });

      // 添加延迟避免速率限制
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 汇总结果
  console.log('\n' + '='.repeat(80));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(80));

  const table = results.map(r => ({
    'API Key': r.apiKey,
    'Prompt': r.prompt,
    '结果': r.success ? '✅ 成功' : (r.refused ? '❌ 拒绝' : '❌ 失败'),
  }));

  console.table(table);

  // 分析结论
  console.log('\n📋 分析结论:');

  const successCount = results.filter(r => r.success).length;
  const refusedCount = results.filter(r => r.refused).length;
  const errorCount = results.filter(r => !r.success && !r.refused).length;

  console.log(`  - 成功: ${successCount}/${results.length}`);
  console.log(`  - 拒绝: ${refusedCount}/${results.length}`);
  console.log(`  - 错误: ${errorCount}/${results.length}`);

  // 找出哪个组合有效
  const successfulCombos = results.filter(r => r.success);
  if (successfulCombos.length > 0) {
    console.log('\n✅ 有效的组合:');
    successfulCombos.forEach(combo => {
      console.log(`   ${combo.apiKey} + ${combo.prompt}`);
    });
  }

  // 找出被拒绝的组合
  const refusedCombos = results.filter(r => r.refused);
  if (refusedCombos.length > 0) {
    console.log('\n❌ 被GPT拒绝的组合:');
    refusedCombos.forEach(combo => {
      console.log(`   ${combo.apiKey} + ${combo.prompt}`);
    });
  }
}

runTests().catch(console.error);
