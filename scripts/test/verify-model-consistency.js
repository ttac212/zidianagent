#!/usr/bin/env node
/**
 * 模型选择一致性验证脚本
 * 专门验证前端选择的模型与后端实际使用的模型是否一致
 */

const { selectApiKey } = require('../lib/ai/key-manager');

// 测试配置
const TEST_SCENARIOS = [
  {
    name: '用户选择Claude Opus 4.1',
    selectedModel: 'claude-opus-4-1-20250805',
    expectedProvider: 'Claude',
    expectedKey: 'sk-9mlBbEdFE...'
  },
  {
    name: '用户选择Gemini 2.5 Pro', 
    selectedModel: 'gemini-2.5-pro',
    expectedProvider: 'Google',
    expectedKey: 'sk-MkU5p0ggC...'
  },
  {
    name: '用户选择Gemini 3 Pro Preview',
    selectedModel: 'google/gemini-3-pro-preview',
    expectedProvider: 'Google',
    expectedKey: 'sk-MkU5p0ggC...'
  },
  {
    name: '用户选择Gemini预览版',
    selectedModel: 'gemini-2.5-pro-preview-06-05',
    expectedProvider: 'Google',
    expectedKey: 'sk-MkU5p0ggC...'
  }
];

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
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  }

// 模拟前端环境变量 (Node.js环境模拟)
function loadEnvVariables() {
  require('dotenv').config();
  
  log('🔧 加载环境变量...', 'cyan');
  log(`   LLM_CLAUDE_API_KEY: ${process.env.LLM_CLAUDE_API_KEY ? '✅ 已配置' : '❌ 未配置'}`, 
      process.env.LLM_CLAUDE_API_KEY ? 'green' : 'red');
  log(`   LLM_GEMINI_API_KEY: ${process.env.LLM_GEMINI_API_KEY ? '✅ 已配置' : '❌ 未配置'}`,
      process.env.LLM_GEMINI_API_KEY ? 'green' : 'red');
  log(`   LLM_API_KEY: ${process.env.LLM_API_KEY ? '✅ 已配置' : '❌ 未配置'}`,
      process.env.LLM_API_KEY ? 'green' : 'red');
}

// 测试单个模型选择场景
async function testModelSelection(scenario) {
  log(`\n📋 测试场景: ${scenario.name}`, 'magenta');
  log(`   🎯 用户选择模型: ${scenario.selectedModel}`, 'blue');
  log(`   📊 期望供应商: ${scenario.expectedProvider}`, 'blue');
  
  try {
    // 调用Key选择器 (这模拟了后端的实际逻辑)
    const keySelection = selectApiKey(scenario.selectedModel);
    
    // 验证结果
    const results = {
      模型ID: scenario.selectedModel,
      选中的供应商: keySelection.provider,
      使用的Key: keySelection.apiKey.substring(0, 12) + '...',
      Key来源: keySelection.keySource,
      置信度: keySelection.confidence,
      是否一致: keySelection.provider === scenario.expectedProvider
    };
    
    // 显示结果
    if (results.是否一致) {
      log('   ✅ 模型选择一致性验证通过', 'green');
      log(`      - 供应商匹配: ${results.选中的供应商} ✓`, 'green');
      log(`      - Key选择: ${results.使用的Key} (${results.Key来源})`, 'green');
      log(`      - 置信度: ${results.置信度}`, 'green');
    } else {
      log('   ❌ 模型选择一致性验证失败', 'red');
      log(`      - 期望供应商: ${scenario.expectedProvider}`, 'red');
      log(`      - 实际供应商: ${results.选中的供应商}`, 'red');
      log(`      - 使用Key: ${results.使用的Key}`, 'red');
    }
    
    return results;
    
  } catch (error) {
    log(`   ❌ Key选择失败: ${error.message}`, 'red');
    return {
      模型ID: scenario.selectedModel,
      错误: error.message,
      是否一致: false
    };
  }
}

// 模拟实际API请求流程
async function simulateAPIRequest(selectedModel) {
  log(`\n🔄 模拟完整API请求流程...`, 'cyan');
  log(`   前端选择: ${selectedModel}`, 'blue');
  
  try {
    // 步骤1: 前端发送请求 (模拟)
    const requestPayload = {
      model: selectedModel,
      messages: [{ role: 'user', content: '测试消息' }],
      temperature: 0.7
    };
    
    log(`   📤 前端发送请求: model="${requestPayload.model}"`, 'blue');
    
    // 步骤2: 后端Key选择 (实际逻辑)
    const keySelection = selectApiKey(selectedModel);
    
    log(`   🔑 后端选择Key: ${keySelection.provider} (${keySelection.keySource})`, 'blue');
    log(`   📊 Key详情: ${keySelection.apiKey.substring(0, 12)}... (${keySelection.confidence}置信度)`, 'blue');
    
    // 步骤3: 验证一致性
    const isConsistent = selectedModel.toLowerCase().includes(keySelection.provider.toLowerCase()) || 
                        (keySelection.provider === 'Claude' && selectedModel.includes('claude')) ||
                        (keySelection.provider === 'Google' && selectedModel.includes('gemini'));
    
    if (isConsistent) {
      log('   ✅ 端到端一致性验证通过!', 'green');
      log(`      用户选择 ${selectedModel} → 使用 ${keySelection.provider} Key ✓`, 'green');
    } else {
      log('   ⚠️  检测到潜在的不一致', 'yellow');
      log(`      用户选择 ${selectedModel} → 使用 ${keySelection.provider} Key`, 'yellow');
    }
    
    return { success: true, consistent: isConsistent, keySelection };
    
  } catch (error) {
    log(`   ❌ API流程模拟失败: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// 运行所有测试
async function runAllTests() {
  log('🚀 开始模型选择一致性验证...', 'magenta');
  
  // 加载环境变量
  loadEnvVariables();
  
  // 测试所有场景
  const results = [];
  
  for (const scenario of TEST_SCENARIOS) {
    const result = await testModelSelection(scenario);
    results.push(result);
    
    // 模拟API请求流程
    if (result.是否一致) {
      await simulateAPIRequest(scenario.selectedModel);
    }
  }
  
  // 生成测试报告
  generateReport(results);
}

function generateReport(results) {
  log('\n📊 模型选择一致性测试报告', 'magenta');
  log('=' * 50, 'blue');
  
  const passedCount = results.filter(r => r.是否一致).length;
  const totalCount = results.length;
  
  // 结果汇总
  results.forEach((result, index) => {
    const status = result.是否一致 ? '✅ 通过' : '❌ 失败';
    const color = result.是否一致 ? 'green' : 'red';
    const scenario = TEST_SCENARIOS[index];
    
    log(`${status} ${scenario.name}`, color);
    
    if (result.错误) {
      log(`   错误: ${result.错误}`, 'red');
    } else if (!result.是否一致) {
      log(`   期望: ${scenario.expectedProvider}, 实际: ${result.选中的供应商}`, 'yellow');
    }
  });
  
  // 总体评估
  const score = Math.round((passedCount / totalCount) * 100);
  const scoreColor = score === 100 ? 'green' : score >= 80 ? 'yellow' : 'red';
  
  log(`\n🎯 一致性评分: ${score}% (${passedCount}/${totalCount} 通过)`, scoreColor);
  
  // 结论和建议
  if (score === 100) {
    log('🎊 完美！所有模型选择都与实际使用一致！', 'green');
    log('   ✓ 前端用户选择的模型与后端使用的Key完全匹配', 'green');
    log('   ✓ 多KEY架构工作正常', 'green');
    log('   ✓ 不会出现"选择Gemini却得到Claude响应"的问题', 'green');
  } else if (score >= 80) {
    log('⚠️  大部分模型选择一致，但仍有改进空间', 'yellow');
  } else {
    log('🚨 严重问题！模型选择不一致，需要立即修复', 'red');
  }
  
  // 使用建议
  log('\n💡 使用建议:', 'blue');
  log('   • 在.env文件中正确配置所有API Keys', 'blue');
  log('   • 定期运行此脚本验证一致性', 'blue');
  log('   • 监控生产环境中的模型使用情况', 'blue');
  
  return results;
}

// 执行测试
if (require.main === module) {
  runAllTests()
    .then(() => {
      log('\n🏁 模型选择一致性验证完成!', 'magenta');
      process.exit(0);
    })
    .catch(error => {
      log(`💥 验证过程异常: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = { testModelSelection, simulateAPIRequest, runAllTests };
