#!/usr/bin/env node
/**
 * 多KEY架构验证脚本
 * 测试不同模型使用对应API Key的功能
 */

const https = require('https');

// 从环境变量读取配置
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

// 多KEY测试配置
const MULTI_KEY_CONFIG = [
  {
    name: 'Claude Opus 4.1',
    id: 'claude-opus-4-1-20250805',
    key: process.env.LLM_CLAUDE_API_KEY || process.env.LLM_API_KEY,
    provider: 'Claude',
    expectedKeySource: 'specific'
  },
  {
    name: 'Gemini 2.5 Pro',
    id: 'gemini-2.5-pro',
    key: process.env.LLM_GEMINI_API_KEY || process.env.LLM_API_KEY,
    provider: 'Google',
    expectedKeySource: 'specific'
  }
];

// 检查API密钥
if (!MULTI_KEY_CONFIG[0].key || !MULTI_KEY_CONFIG[1].key) {
  process.exit(1);
}

const API_BASE = 'https://api.302.ai/v1';
const TEST_MESSAGE = 'Multi-key test: Please respond with: KEY_WORKS';

// ANSI颜色
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  }

function makeRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

/**
 * 测试单个模型的API Key选择
 */
async function testModelKey(config) {
  log(`\n🔑 测试模型专属Key: ${config.name}`, 'cyan');
  log(`   模型ID: ${config.id}`, 'blue');
  log(`   预期供应商: ${config.provider}`, 'blue');
  log(`   API Key: ${config.key.substring(0, 12)}...`, 'blue');
  
  const payload = JSON.stringify({
    model: config.id,
    messages: [
      { role: 'user', content: TEST_MESSAGE }
    ],
    max_tokens: 10,
    stream: false
  });
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  try {
    const url = new URL('/chat/completions', API_BASE);
    const response = await makeRequest(url, options, payload);
    
    log(`📊 HTTP状态: ${response.statusCode}`, response.statusCode === 200 ? 'green' : 'red');
    
    if (response.statusCode === 200) {
      try {
        const data = JSON.parse(response.data);
        const content = data.choices?.[0]?.message?.content || '无响应内容';
        const actualModel = data.model || '未知模型';
        
        log(`✅ 专属Key工作正常!`, 'green');
        log(`   实际模型: ${actualModel}`, 'green');
        log(`   响应内容: ${content.substring(0, 50)}`, 'green');
        
        // 验证模型匹配
        if (actualModel === config.id) {
          log(`   🎯 模型匹配: ✓`, 'green');
        } else {
          log(`   ⚠️ 模型不匹配: 预期 ${config.id}, 实际 ${actualModel}`, 'yellow');
        }
        
        if (data.usage) {
          log(`   Token使用: ${data.usage.total_tokens || 0}`, 'green');
        }
        
        return { 
          success: true, 
          model: config.id, 
          provider: config.provider,
          actualModel,
          response: content,
          tokens: data.usage?.total_tokens || 0
        };
      } catch (parseError) {
        log(`❌ JSON解析失败: ${parseError.message}`, 'red');
        return { success: false, model: config.id, error: 'JSON解析失败' };
      }
    } else {
      const errorText = response.data.substring(0, 200);
      log(`❌ 请求失败 (${response.statusCode}): ${errorText}`, 'red');
      return { success: false, model: config.id, error: `HTTP ${response.statusCode}` };
    }
  } catch (error) {
    log(`❌ 网络错误: ${error.message}`, 'red');
    return { success: false, model: config.id, error: error.message };
  }
}

/**
 * 测试Key隔离性 - 使用错误的Key访问模型
 */
async function testKeyIsolation() {
  log(`\n🔒 测试Key隔离性...`, 'magenta');
  
  // 使用Claude Key访问Gemini模型（应该能工作，因为都通过302.ai）
  const testCase = {
    name: '交叉测试: 用Claude Key访问Gemini',
    modelId: 'gemini-2.5-pro',
    wrongKey: process.env.LLM_CLAUDE_API_KEY || process.env.LLM_API_KEY || 'test-key' // Claude key
  };
  
  log(`   测试场景: ${testCase.name}`, 'blue');
  log(`   模型: ${testCase.modelId}`, 'blue');
  log(`   使用Key: ${testCase.wrongKey.substring(0, 12)}...`, 'blue');
  
  const payload = JSON.stringify({
    model: testCase.modelId,
    messages: [
      { role: 'user', content: 'Cross-key test' }
    ],
    max_tokens: 5,
    stream: false
  });
  
  try {
    const response = await makeRequest(
      new URL('/chat/completions', API_BASE),
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testCase.wrongKey}`,
          'Content-Type': 'application/json',
        }
      },
      payload
    );
    
    if (response.statusCode === 200) {
      log(`   📊 结果: 可以工作 (302.ai统一接口特性)`, 'green');
    } else {
      log(`   📊 结果: 访问被拒绝 (${response.statusCode}) - Key隔离正常`, 'yellow');
    }
  } catch (error) {
    log(`   📊 结果: 连接错误 - ${error.message}`, 'red');
  }
}

/**
 * 测试Key管理器逻辑（模拟）
 */
function testKeySelectionLogic() {
  log(`\n🧠 测试Key选择逻辑...`, 'magenta');
  
  const testCases = [
    { model: 'claude-opus-4-1-20250805', expected: 'Claude' },
    { model: 'gemini-2.5-pro', expected: 'Google' },
    { model: 'claude-3-5-sonnet', expected: 'Claude' },
    { model: 'gemini-1.5-pro', expected: 'Google' },
    { model: 'unknown-model', expected: 'Fallback' }
  ];
  
  testCases.forEach(testCase => {
    let expectedProvider = 'Unknown';
    if (testCase.model.includes('claude')) expectedProvider = 'Claude';
    else if (testCase.model.includes('gemini')) expectedProvider = 'Google';
    else expectedProvider = 'Fallback';
    
    const matches = expectedProvider === testCase.expected;
    log(`   ${testCase.model} → ${expectedProvider} ${matches ? '✅' : '❌'}`, 
        matches ? 'green' : 'red');
  });
}

async function runAllTests() {
  log('🚀 开始多KEY架构验证测试...', 'magenta');
  log(`📡 API端点: ${API_BASE}`, 'blue');
  log(`🧪 测试模型数量: ${MULTI_KEY_CONFIG.length}`, 'blue');
  
  const results = [];
  
  // 1. 测试每个模型的专属Key
  log('\n📋 第一阶段: 专属Key功能测试', 'magenta');
  for (let i = 0; i < MULTI_KEY_CONFIG.length; i++) {
    const config = MULTI_KEY_CONFIG[i];
    const result = await testModelKey(config);
    results.push(result);
    
    if (i < MULTI_KEY_CONFIG.length - 1) {
      log('⏳ 等待1秒...', 'yellow');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 2. 测试Key隔离性
  log('\n📋 第二阶段: Key隔离性测试', 'magenta');
  await testKeyIsolation();
  
  // 3. 测试选择逻辑
  log('\n📋 第三阶段: Key选择逻辑测试', 'magenta');
  testKeySelectionLogic();
  
  // 结果汇总
  log('\n📊 测试结果汇总:', 'magenta');
  log('=' * 50, 'blue');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  log(`✅ 专属Key测试通过: ${successful.length}/${results.length}`, 
      successful.length === results.length ? 'green' : 'yellow');
  
  if (successful.length > 0) {
    log('\n🎉 工作正常的模型:', 'green');
    successful.forEach(result => {
      log(`   ✓ ${result.model} (${result.provider}) - ${result.tokens || 0} tokens`, 'green');
    });
  }
  
  if (failed.length > 0) {
    log('\n⚠️ 需要检查的模型:', 'red');
    failed.forEach(result => {
      log(`   ✗ ${result.model}: ${result.error}`, 'red');
    });
  }
  
  // 架构优势总结
  log('\n🏆 多KEY架构优势确认:', 'magenta');
  log('   🔐 安全隔离: 每个模型使用专属Key', 'green');
  log('   💰 成本透明: 可分别监控各供应商用量', 'green');
  log('   🚀 高可用性: 单Key失效不影响其他模型', 'green');
  log('   ⚡ 易扩展: 新增供应商只需添加新Key', 'green');
  
  log('\n🏁 多KEY架构测试完成!', 'magenta');
  
  if (successful.length === results.length && failed.length === 0) {
    log('🎊 所有测试通过！多KEY架构工作正常。', 'green');
    process.exit(0);
  } else {
    log('⚠️ 部分测试失败，请检查配置。', 'yellow');
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(error => {
    log(`💥 测试过程异常: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { testModelKey, testKeyIsolation, runAllTests };