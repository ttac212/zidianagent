#!/usr/bin/env node
/**
 * 数据库完整性检查脚本（JavaScript版本）
 * 直接使用Node.js执行，无需TypeScript编译
 */

const https = require('https');
const http = require('http');

// 测试配置
const TEST_CONFIG = {
  apiBase: 'http://localhost:3007/api',
  models: ['claude-opus-4-1-20250805', 'gemini-2.5-pro']
};

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

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// 数据库检查类
class DatabaseChecker {
  constructor() {
    this.results = [];
  }

  async checkDatabaseConnection() {
    log('🔌 检查数据库连接...', 'cyan');
    
    try {
      const response = await makeRequest(`${TEST_CONFIG.apiBase}/test-db`);
      
      if (response.status === 200) {
        const data = JSON.parse(response.body);
        log('✅ 数据库连接正常', 'green');
        log(`   数据库类型: ${data.database}`, 'blue');
        log(`   SQLite版本: ${data.version?.[0]?.version}`, 'blue');
        
        if (data.testUser) {
          log(`   测试用户: ${data.testUser.email}`, 'blue');
          log(`   用户状态: ${data.testUser.status}`, 'blue');
          log(`   月度配额: ${data.testUser.monthlyTokenLimit}`, 'blue');
          log(`   已用量: ${data.testUser.currentMonthUsage}`, 'blue');
        }
        
        return { passed: true, details: '数据库连接和基本查询正常' };
      } else {
        log(`❌ 数据库连接失败: HTTP ${response.status}`, 'red');
        return { passed: false, details: `HTTP ${response.status}` };
      }
    } catch (error) {
      log(`❌ 数据库连接异常: ${error.message}`, 'red');
      return { passed: false, details: error.message };
    }
  }

  async checkChatAPIHealth() {
    log('💬 检查聊天API状态...', 'cyan');
    
    try {
      const response = await makeRequest(`${TEST_CONFIG.apiBase}/chat`, { method: 'GET' });
      
      if (response.status === 200) {
        log('✅ 聊天API健康检查通过', 'green');
        return { passed: true, details: '聊天API响应正常' };
      } else {
        log(`⚠️  聊天API返回: HTTP ${response.status}`, 'yellow');
        return { passed: false, details: `HTTP ${response.status}` };
      }
    } catch (error) {
      log(`❌ 聊天API检查异常: ${error.message}`, 'red');
      return { passed: false, details: error.message };
    }
  }

  async checkModelValidation() {
    log('🎯 检查模型验证逻辑...', 'cyan');
    
    const testResults = [];
    
    for (const modelId of TEST_CONFIG.models) {
      try {
        log(`  测试模型: ${modelId}`, 'blue');
        
        const response = await makeRequest(`${TEST_CONFIG.apiBase}/chat`, {
          method: 'POST',
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: '测试' }]
          })
        });

        if (response.status === 401) {
          log(`  ✅ ${modelId}: 正确要求认证`, 'green');
          testResults.push(true);
        } else if (response.status === 400) {
          try {
            const errorData = JSON.parse(response.body);
            if (errorData.error && errorData.error.includes('API Key')) {
              log(`  ✅ ${modelId}: 多KEY架构工作正常`, 'green');
              testResults.push(true);
            } else {
              log(`  ❌ ${modelId}: 意外的400错误`, 'red');
              testResults.push(false);
            }
          } catch {
            log(`  ⚠️  ${modelId}: 无法解析错误响应`, 'yellow');
            testResults.push(false);
          }
        } else {
          log(`  📊 ${modelId}: HTTP ${response.status}`, 'blue');
          testResults.push(response.status < 500); // 5xx是服务器错误，其他可接受
        }
        
        // 避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        log(`  ❌ ${modelId}: 请求异常 - ${error.message}`, 'red');
        testResults.push(false);
      }
    }

    const passedCount = testResults.filter(Boolean).length;
    const success = passedCount === testResults.length;
    
    if (success) {
      log('✅ 模型验证检查通过', 'green');
    } else {
      log(`⚠️  模型验证部分通过: ${passedCount}/${testResults.length}`, 'yellow');
    }
    
    return {
      passed: success,
      details: `${passedCount}/${testResults.length} 模型验证通过`
    };
  }

  async checkMultiKeyArchitecture() {
    log('🔑 检查多KEY架构状态...', 'cyan');
    
    // 检查环境变量配置（通过API响应推断）
    let keyConfigScore = 0;
    
    for (const modelId of TEST_CONFIG.models) {
      try {
        const response = await makeRequest(`${TEST_CONFIG.apiBase}/chat`, {
          method: 'POST',
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: '测试KEY选择' }]
          })
        });

        if (response.status === 400) {
          try {
            const errorData = JSON.parse(response.body);
            
            // 检查错误信息是否包含KEY相关信息
            if (errorData.error && (
              errorData.error.includes('API Key') || 
              errorData.error.includes('Key') ||
              errorData.suggestion
            )) {
              log(`  ✅ ${modelId}: KEY管理器正常工作`, 'green');
              keyConfigScore++;
            } else if (errorData.error && errorData.error.includes('模型验证失败')) {
              log(`  ✅ ${modelId}: 模型验证器正常工作`, 'green'); 
              keyConfigScore++;
            } else {
              log(`  📊 ${modelId}: 其他错误 - ${errorData.error}`, 'blue');
            }
          } catch {
            log(`  ⚠️  ${modelId}: 无法解析错误信息`, 'yellow');
          }
        } else {
          log(`  📊 ${modelId}: HTTP ${response.status}`, 'blue');
        }
      } catch (error) {
        log(`  ❌ ${modelId}: 测试失败 - ${error.message}`, 'red');
      }
    }

    const success = keyConfigScore >= TEST_CONFIG.models.length * 0.5; // 至少一半通过
    
    if (success) {
      log('✅ 多KEY架构状态良好', 'green');
    } else {
      log('⚠️  多KEY架构可能需要检查', 'yellow');
    }
    
    return {
      passed: success,
      details: `KEY管理测试通过: ${keyConfigScore}/${TEST_CONFIG.models.length}`
    };
  }

  async runAllChecks() {
    log('🚀 开始数据库和API完整性检查...', 'magenta');
    log(`📍 目标API: ${TEST_CONFIG.apiBase}`, 'blue');
    
    const checks = [
      { name: '数据库连接', fn: () => this.checkDatabaseConnection() },
      { name: '聊天API健康', fn: () => this.checkChatAPIHealth() },
      { name: '模型验证', fn: () => this.checkModelValidation() },
      { name: '多KEY架构', fn: () => this.checkMultiKeyArchitecture() }
    ];

    this.results = [];
    
    for (const check of checks) {
      try {
        log(`\n📋 检查: ${check.name}`, 'magenta');
        const result = await check.fn();
        this.results.push({ name: check.name, ...result });
      } catch (error) {
        log(`❌ ${check.name} 检查异常: ${error.message}`, 'red');
        this.results.push({
          name: check.name,
          passed: false,
          details: `异常: ${error.message}`
        });
      }
    }

    this.generateReport();
    return this.results;
  }

  generateReport() {
    log('\n📊 系统健康检查报告', 'magenta');
    log('=' * 50, 'blue');

    const passedCount = this.results.filter(r => r.passed).length;
    const totalCount = this.results.length;

    // 显示各项检查结果
    this.results.forEach(result => {
      const status = result.passed ? '✅ 通过' : '❌ 失败';
      const color = result.passed ? 'green' : 'red';
      log(`${status} ${result.name}: ${result.details}`, color);
    });

    // 计算健康度评分
    const healthScore = Math.round((passedCount / totalCount) * 100);
    const scoreColor = healthScore >= 80 ? 'green' : healthScore >= 60 ? 'yellow' : 'red';
    
    log(`\n🎯 系统健康度: ${healthScore}% (${passedCount}/${totalCount} 通过)`, scoreColor);

    // 状态判断
    if (healthScore >= 80) {
      log('🎊 系统状态优秀！数据流转和API都工作正常。', 'green');
    } else if (healthScore >= 60) {
      log('⚠️  系统基本正常，但有一些问题需要关注。', 'yellow');
    } else {
      log('🚨 系统存在重要问题，需要立即检查！', 'red');
    }

    // 问题诊断和建议
    const failedChecks = this.results.filter(r => !r.passed);
    if (failedChecks.length > 0) {
      log('\n🔧 问题诊断和建议:', 'blue');
      
      failedChecks.forEach(check => {
        if (check.name === '数据库连接') {
          log('  • 检查数据库文件路径和权限', 'yellow');
          log('  • 运行 npx prisma db push 同步结构', 'yellow');
        } else if (check.name === '聊天API健康') {
          log('  • 确认开发服务器在3007端口运行', 'yellow');
          log('  • 检查API路由配置', 'yellow');
        } else if (check.name === '模型验证') {
          log('  • 检查模型白名单配置', 'yellow');
          log('  • 验证模型验证器逻辑', 'yellow');
        } else if (check.name === '多KEY架构') {
          log('  • 检查环境变量中的API Keys配置', 'yellow');
          log('  • 运行 node scripts/test-multi-key.js 详细测试', 'yellow');
        }
      });
    }

    // 下一步建议
    log('\n📋 下一步建议:', 'blue');
    log('  • 如果系统健康度低于80%，先修复失败的检查项', 'blue');
    log('  • 运行 node scripts/test-multi-key.js 测试多KEY功能', 'blue');
    log('  • 考虑启动开发服务器进行完整测试', 'blue');
    
    return this.results;
  }
}

// 主执行函数
async function main() {
  const checker = new DatabaseChecker();
  
  try {
    await checker.runAllChecks();
    log('\n🏁 系统检查完成!', 'magenta');
    process.exit(0);
  } catch (error) {
    log(`💥 检查执行失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DatabaseChecker, makeRequest };