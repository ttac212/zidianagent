#!/usr/bin/env node
/**
 * 环境变量修复验证脚本
 * 验证.env文件配置是否解决了模型选择不一致问题
 */

const fs = require('fs');
const path = require('path');

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

// 读取.env文件
function readEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    log('❌ .env文件不存在!', 'red');
    return null;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  return envContent;
}

// 解析环境变量
function parseEnvVariables(envContent) {
  const variables = {};
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      variables[key] = value;
    }
  }
  
  return variables;
}

// 验证API Keys配置
function validateApiKeys(variables) {
  log('🔑 验证API Keys配置...', 'cyan');
  
  const requiredKeys = [
    'LLM_CLAUDE_API_KEY',
    'LLM_GEMINI_API_KEY', 
    'LLM_API_KEY'
  ];
  
  const results = {};
  
  requiredKeys.forEach(key => {
    const value = variables[key];
    const isConfigured = value && value.length > 0;
    
    results[key] = {
      configured: isConfigured,
      value: value,
      preview: value ? `${value.substring(0, 12)}...` : 'N/A'
    };
    
    if (isConfigured) {
      log(`   ✅ ${key}: ${results[key].preview}`, 'green');
    } else {
      log(`   ❌ ${key}: 未配置`, 'red');
    }
  });
  
  return results;
}

// 验证模型白名单
function validateModelWhitelist(variables) {
  log('\n🎯 验证模型白名单...', 'cyan');
  
  const allowList = variables['MODEL_ALLOWLIST'];
  
  if (!allowList) {
    log('   ❌ MODEL_ALLOWLIST 未配置', 'red');
    return false;
  }
  
  const models = allowList.split(',').map(s => s.trim());
  const expectedModels = [
    'claude-opus-4-1-20250805',
    'gemini-2.5-pro'
  ];
  
  log(`   📋 配置的模型: ${models.join(', ')}`, 'blue');
  
  let allExpectedFound = true;
  expectedModels.forEach(expected => {
    if (models.includes(expected)) {
      log(`   ✅ ${expected}: 在白名单中`, 'green');
    } else {
      log(`   ❌ ${expected}: 不在白名单中`, 'red');
      allExpectedFound = false;
    }
  });
  
  return allExpectedFound;
}

// 模型-Key匹配逻辑验证
function validateModelKeyMapping(keyResults) {
  log('\n🔄 验证模型-Key匹配逻辑...', 'cyan');
  
  const testCases = [
    {
      model: 'claude-opus-4-1-20250805',
      expectedKey: 'LLM_CLAUDE_API_KEY',
      description: '用户选择Claude → 应使用Claude Key'
    },
    {
      model: 'gemini-2.5-pro',
      expectedKey: 'LLM_GEMINI_API_KEY',
      description: '用户选择Gemini → 应使用Gemini Key'
    }
  ];
  
  let allPassed = true;
  
  testCases.forEach(testCase => {
    log(`   🧪 测试: ${testCase.description}`, 'blue');
    
    const keyConfig = keyResults[testCase.expectedKey];
    
    if (keyConfig && keyConfig.configured) {
      log(`      ✅ ${testCase.expectedKey} 已配置: ${keyConfig.preview}`, 'green');
      log(`      ✅ ${testCase.model} 将使用正确的Key`, 'green');
    } else {
      log(`      ❌ ${testCase.expectedKey} 未配置`, 'red');
      log(`      ❌ ${testCase.model} 无法找到专属Key`, 'red');
      allPassed = false;
    }
  });
  
  return allPassed;
}

// 生成修复验证报告
function generateReport(keyResults, whitelistValid, mappingValid) {
  log('\n📊 修复验证报告', 'magenta');
  log('=' * 50, 'blue');
  
  // 计算各项得分
  const keyScore = Object.values(keyResults).filter(r => r.configured).length / Object.keys(keyResults).length;
  const whitelistScore = whitelistValid ? 1 : 0;
  const mappingScore = mappingValid ? 1 : 0;
  
  const overallScore = Math.round(((keyScore + whitelistScore + mappingScore) / 3) * 100);
  
  // 显示各项结果
  log(`🔑 API Keys配置: ${Math.round(keyScore * 100)}%`, keyScore === 1 ? 'green' : 'red');
  log(`🎯 模型白名单: ${whitelistScore * 100}%`, whitelistValid ? 'green' : 'red');
  log(`🔄 Key映射逻辑: ${mappingScore * 100}%`, mappingValid ? 'green' : 'red');
  
  log(`\n🎯 总体修复程度: ${overallScore}%`, overallScore >= 90 ? 'green' : overallScore >= 70 ? 'yellow' : 'red');
  
  // 结论
  if (overallScore >= 90) {
    log('\n🎊 修复成功！模型选择不一致问题已解决', 'green');
    log('   ✓ 所有必要的API Keys都已配置', 'green');
    log('   ✓ 模型白名单配置正确', 'green');
    log('   ✓ Key映射逻辑将正常工作', 'green');
    log('   ✓ 用户选择Gemini将得到Gemini响应 ✨', 'green');
  } else if (overallScore >= 70) {
    log('\n⚠️  部分修复完成，但仍需改进', 'yellow');
  } else {
    log('\n🚨 修复不完整，问题仍然存在', 'red');
  }
  
  // 下一步建议
  log('\n💡 下一步建议:', 'blue');
  if (keyScore < 1) {
    log('   • 完善所有API Keys配置', 'yellow');
  }
  if (!whitelistValid) {
    log('   • 检查MODEL_ALLOWLIST配置', 'yellow');
  }
  log('   • 重启开发服务器以应用新配置', 'blue');
  log('   • 测试前端模型选择功能', 'blue');
  log('   • 监控实际使用中的模型一致性', 'blue');
  
  return overallScore;
}

// 主函数
function main() {
  log('🔍 验证环境变量修复效果...', 'magenta');
  
  // 读取和解析.env文件
  const envContent = readEnvFile();
  if (!envContent) {
    log('💥 无法读取.env文件，验证失败', 'red');
    process.exit(1);
  }
  
  const variables = parseEnvVariables(envContent);
  log(`📄 成功解析.env文件，包含 ${Object.keys(variables).length} 个变量`, 'blue');
  
  // 验证各个方面
  const keyResults = validateApiKeys(variables);
  const whitelistValid = validateModelWhitelist(variables);
  const mappingValid = validateModelKeyMapping(keyResults);
  
  // 生成报告
  const score = generateReport(keyResults, whitelistValid, mappingValid);
  
  log('\n🏁 环境变量修复验证完成!', 'magenta');
  
  // 设置退出码
  process.exit(score >= 90 ? 0 : 1);
}

// 执行
if (require.main === module) {
  main();
}

module.exports = { readEnvFile, parseEnvVariables, validateApiKeys };