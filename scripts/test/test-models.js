#!/usr/bin/env node
/**
 * 模型快速验证脚本
 * 直接测试新API keys是否工作正常
 */

const https = require('https');

// 从环境变量读取配置
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

// 测试配置
const MODELS_TO_TEST = [
  {
    name: 'Claude Opus 4.1',
    id: 'claude-opus-4-1-20250805',
    key: process.env.LLM_CLAUDE_API_KEY || process.env.LLM_API_KEY
  },
  {
    name: 'Gemini 2.5 Pro',
    id: 'gemini-2.5-pro',
    key: process.env.LLM_GEMINI_API_KEY || process.env.LLM_API_KEY
  }
];

// 检查API密钥
if (!MODELS_TO_TEST[0].key || !MODELS_TO_TEST[1].key) {
  process.exit(1);
}

const API_BASE = 'https://api.302.ai/v1';
const TEST_MESSAGE = 'Please respond with exactly: TEST_SUCCESS';

// ANSI 颜色代码
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

async function testModel(model) {
  log(`\n🧪 测试模型: ${model.name} (${model.id})`, 'cyan');
  log(`🔑 API Key: ${model.key.substring(0, 12)}...`, 'blue');
  
  const payload = JSON.stringify({
    model: model.id,
    messages: [
      { role: 'user', content: TEST_MESSAGE }
    ],
    max_tokens: 10,
    stream: false
  });
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${model.key}`,
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
        
        log(`✅ 响应成功!`, 'green');
        log(`   实际模型: ${actualModel}`, 'green');
        log(`   响应内容: ${content.substring(0, 100)}`, 'green');
        
        if (data.usage) {
          log(`   Token使用: ${data.usage.total_tokens || 0} (prompt: ${data.usage.prompt_tokens || 0}, completion: ${data.usage.completion_tokens || 0})`, 'green');
        }
        
        return { success: true, model: model.id, response: content };
      } catch (parseError) {
        log(`❌ JSON解析失败: ${parseError.message}`, 'red');
        log(`   原始响应: ${response.data.substring(0, 200)}`, 'yellow');
        return { success: false, model: model.id, error: 'JSON解析失败' };
      }
    } else if (response.statusCode === 401) {
      log(`❌ 认证失败 (401) - API Key可能无效`, 'red');
      try {
        const errorData = JSON.parse(response.data);
        log(`   错误详情: ${errorData.error?.message || '未知错误'}`, 'red');
      } catch {
        log(`   原始错误: ${response.data.substring(0, 200)}`, 'red');
      }
      return { success: false, model: model.id, error: 'API Key无效' };
    } else if (response.statusCode === 404) {
      log(`❌ 模型未找到 (404) - 模型名称可能已更改`, 'red');
      log(`   建议检查模型名称是否正确`, 'yellow');
      return { success: false, model: model.id, error: '模型未找到' };
    } else if (response.statusCode === 429) {
      log(`❌ 请求过于频繁 (429) - 稍后重试`, 'red');
      return { success: false, model: model.id, error: '请求限制' };
    } else {
      log(`❌ 请求失败 (${response.statusCode})`, 'red');
      log(`   错误响应: ${response.data.substring(0, 200)}`, 'red');
      return { success: false, model: model.id, error: `HTTP ${response.statusCode}` };
    }
  } catch (error) {
    log(`❌ 网络错误: ${error.message}`, 'red');
    return { success: false, model: model.id, error: error.message };
  }
}

async function testAllModels() {
  log('🚀 开始验证API模型连接...', 'magenta');
  log(`📡 API端点: ${API_BASE}`, 'blue');
  log(`💬 测试消息: ${TEST_MESSAGE}`, 'blue');
  
  const results = [];
  
  for (let i = 0; i < MODELS_TO_TEST.length; i++) {
    const model = MODELS_TO_TEST[i];
    const result = await testModel(model);
    results.push(result);
    
    // 避免请求过于频繁
    if (i < MODELS_TO_TEST.length - 1) {
      log('⏳ 等待1秒...', 'yellow');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 汇总结果
  log('\n📊 测试结果汇总:', 'magenta');
  log('=' * 50, 'blue');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  log(`✅ 成功: ${successful.length}/${results.length}`, successful.length > 0 ? 'green' : 'red');
  log(`❌ 失败: ${failed.length}/${results.length}`, failed.length > 0 ? 'red' : 'green');
  
  if (successful.length > 0) {
    log('\n🎉 可用模型:', 'green');
    successful.forEach(result => {
      log(`   ✓ ${result.model}`, 'green');
    });
  }
  
  if (failed.length > 0) {
    log('\n⚠️  失败模型:', 'red');
    failed.forEach(result => {
      log(`   ✗ ${result.model}: ${result.error}`, 'red');
    });
    
    log('\n🔧 故障排除建议:', 'yellow');
    if (failed.some(r => r.error === 'API Key无效')) {
      log('   • 检查API Key是否正确且有效', 'yellow');
      log('   • 确认API Key在302.ai控制台中是否激活', 'yellow');
    }
    if (failed.some(r => r.error === '模型未找到')) {
      log('   • 检查模型名称是否正确', 'yellow');
      log('   • 确认302.ai是否支持该模型', 'yellow');
    }
  }
  
  log('\n🏁 测试完成!', 'magenta');
  
  if (successful.length === results.length) {
    log('🎊 所有模型测试通过！可以开始使用了。', 'green');
    process.exit(0);
  } else {
    log('⚠️  部分模型测试失败，请检查配置。', 'yellow');
    process.exit(1);
  }
}

// 检查是否直接运行此脚本
if (require.main === module) {
  testAllModels().catch(error => {
    log(`💥 测试过程出现异常: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { testModel, testAllModels };