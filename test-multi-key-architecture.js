/**
 * 多KEY架构测试脚本
 * 测试API Key选择器和模型切换功能
 */

// 从环境变量文件加载配置
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

// 确保必要的环境变量存在
if (!process.env.LLM_API_BASE) {
  process.env.LLM_API_BASE = 'https://api.302.ai/v1';
}
if (!process.env.MODEL_ALLOWLIST) {
  process.env.MODEL_ALLOWLIST = 'claude-opus-4-1-20250805,gemini-2.5-pro';
}

// 检查API密钥是否存在
if (!process.env.LLM_CLAUDE_API_KEY && !process.env.LLM_GEMINI_API_KEY && !process.env.LLM_API_KEY) {
  process.exit(1);
}

const { selectApiKey, getKeyHealthStatus } = require('./lib/ai/key-manager');
const { ALLOWED_MODEL_IDS } = require('./lib/ai/models');

// 测试环境变量状态
}...)` : '❌ 未配置');
}...)` : '❌ 未配置');
}...)` : '❌ 未配置');
// 测试模型白名单
// 健康状态检查
try {
  const health = getKeyHealthStatus();
  Object.entries(health.keyStatus).forEach(([provider, status]) => {
    });
} catch (e) {
  }

// KEY选择逻辑测试
const testModels = [
  'claude-opus-4-1-20250805',
  'gemini-2.5-pro', 
  'claude-3-5-sonnet',
  'gemini-1.5-pro',
  'unknown-model'
];

testModels.forEach(model => {
  try {
    const result = selectApiKey(model);
    }...`);
  } catch (e) {
    }
});

// 模型切换一致性测试
ALLOWED_MODEL_IDS.forEach(model => {
  // 连续选择3次，检查一致性
  const results = [];
  for (let i = 0; i < 3; i++) {
    try {
      const result = selectApiKey(model);
      results.push({
        provider: result.provider,
        keySource: result.keySource,
        confidence: result.confidence,
        keyPrefix: result.apiKey.substring(0, 12)
      });
    } catch (e) {
      results.push({ error: e.message });
    }
  }
  
  // 检查一致性
  const firstResult = results[0];
  const consistent = results.every(r => 
    r.error || (
      r.provider === firstResult.provider &&
      r.keySource === firstResult.keySource &&
      r.keyPrefix === firstResult.keyPrefix
    )
  );
  
  if (!consistent) {
    } else if (firstResult.provider) {
    `);
  }
});

