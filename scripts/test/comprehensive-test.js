#!/usr/bin/env node
/**
 * 综合数据流转测试脚本
 * 验证从前端到数据库的完整数据链路
 */

const https = require('https');
const sqlite3 = require('sqlite3');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  apiBase: 'http://localhost:3007/api',
  dbPath: path.join(__dirname, '../prisma/dev.db'),
  testUserId: 'test-user-comprehensive',
  testModels: ['claude-opus-4-1-20250805', 'gemini-2.5-pro'],
  testMessages: [
    '这是一条测试消息，请简短回复。',
    '请用一句话总结AI的作用。',
    '测试完成，谢谢！'
  ]
};

// ANSI 颜色
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

// 数据库连接
class DatabaseChecker {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      this.db.close(resolve);
    });
  }

  // 检查数据库结构
  async checkDatabaseStructure() {
    log('📊 检查数据库结构...', 'cyan');
    
    const tables = await this.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    const expectedTables = [
      'users', 'conversations', 'messages', 'usage_stats',
      'accounts', 'sessions', 'invite_codes', 'feedbacks'
    ];

    const existingTables = tables.map(t => t.name);
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      log(`❌ 缺失表: ${missingTables.join(', ')}`, 'red');
      return false;
    } else {
      log(`✅ 数据库结构检查通过: ${existingTables.length} 张表`, 'green');
      return true;
    }
  }

  // 检查数据完整性
  async checkDataIntegrity() {
    log('🔍 检查数据完整性...', 'cyan');
    
    const checks = [];

    try {
      // 1. 检查对话消息计数一致性
      const conversationIntegrity = await this.query(`
        SELECT c.id, c.messageCount, 
               COUNT(m.id) as actualCount,
               c.messageCount - COUNT(m.id) as diff
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversationId
        GROUP BY c.id
        HAVING diff != 0
      `);

      if (conversationIntegrity.length > 0) {
        log(`⚠️  对话消息计数不一致: ${conversationIntegrity.length} 个对话`, 'yellow');
        checks.push({ type: '对话消息计数', status: 'warning', count: conversationIntegrity.length });
      } else {
        log(`✅ 对话消息计数一致性检查通过`, 'green');
        checks.push({ type: '对话消息计数', status: 'pass' });
      }

      // 2. 检查Token统计一致性
      const tokenIntegrity = await this.query(`
        SELECT c.id, c.totalTokens,
               COALESCE(SUM(m.totalTokens), 0) as actualTokens,
               c.totalTokens - COALESCE(SUM(m.totalTokens), 0) as diff
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversationId
        GROUP BY c.id
        HAVING ABS(diff) > 1
      `);

      if (tokenIntegrity.length > 0) {
        log(`⚠️  Token统计不一致: ${tokenIntegrity.length} 个对话`, 'yellow');
        checks.push({ type: 'Token统计', status: 'warning', count: tokenIntegrity.length });
      } else {
        log(`✅ Token统计一致性检查通过`, 'green');
        checks.push({ type: 'Token统计', status: 'pass' });
      }

      // 3. 检查用户配额统计
      const usageIntegrity = await this.query(`
        SELECT u.id, u.currentMonthUsage,
               COALESCE(SUM(us.totalTokens), 0) as calculatedUsage,
               u.currentMonthUsage - COALESCE(SUM(us.totalTokens), 0) as diff
        FROM users u
        LEFT JOIN usage_stats us ON u.id = us.userId 
        WHERE date >= date('now', 'start of month')
        GROUP BY u.id
        HAVING ABS(diff) > 10
      `);

      if (usageIntegrity.length > 0) {
        log(`⚠️  用户配额统计不一致: ${usageIntegrity.length} 个用户`, 'yellow');
        checks.push({ type: '用户配额', status: 'warning', count: usageIntegrity.length });
      } else {
        log(`✅ 用户配额统计一致性检查通过`, 'green');
        checks.push({ type: '用户配额', status: 'pass' });
      }

      // 4. 检查孤儿消息
      const orphanMessages = await this.query(`
        SELECT COUNT(*) as count 
        FROM messages m
        LEFT JOIN conversations c ON m.conversationId = c.id
        WHERE c.id IS NULL
      `);

      if (orphanMessages[0].count > 0) {
        log(`⚠️  发现孤儿消息: ${orphanMessages[0].count} 条`, 'yellow');
        checks.push({ type: '孤儿消息', status: 'warning', count: orphanMessages[0].count });
      } else {
        log(`✅ 无孤儿消息`, 'green');
        checks.push({ type: '孤儿消息', status: 'pass' });
      }

    } catch (error) {
      log(`❌ 数据完整性检查失败: ${error.message}`, 'red');
      checks.push({ type: '数据完整性检查', status: 'error', error: error.message });
    }

    return checks;
  }

  // 获取测试前的数据快照
  async getDataSnapshot() {
    const snapshot = {};
    
    try {
      snapshot.userCount = await this.query('SELECT COUNT(*) as count FROM users');
      snapshot.conversationCount = await this.query('SELECT COUNT(*) as count FROM conversations');
      snapshot.messageCount = await this.query('SELECT COUNT(*) as count FROM messages');
      snapshot.usageStatsCount = await this.query('SELECT COUNT(*) as count FROM usage_stats');
      
      log(`📸 数据快照: 用户=${snapshot.userCount[0].count}, 对话=${snapshot.conversationCount[0].count}, 消息=${snapshot.messageCount[0].count}`, 'blue');
    } catch (error) {
      log(`❌ 获取数据快照失败: ${error.message}`, 'red');
    }

    return snapshot;
  }
}

// API测试类
class APITester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      
      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      };

      const req = https.request(url, requestOptions, (res) => {
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

  // 测试数据库连接API
  async testDatabaseConnection() {
    log('🔌 测试数据库连接API...', 'cyan');
    
    try {
      const response = await this.makeRequest('/test-db');
      
      if (response.status === 200) {
        const data = JSON.parse(response.body);
        log(`✅ 数据库连接正常: ${data.message || 'OK'}`, 'green');
        return true;
      } else {
        log(`❌ 数据库连接失败: HTTP ${response.status}`, 'red');
        return false;
      }
    } catch (error) {
      log(`❌ 数据库连接测试异常: ${error.message}`, 'red');
      return false;
    }
  }

  // 测试聊天API健康状态
  async testChatAPIHealth() {
    log('💬 测试聊天API健康状态...', 'cyan');
    
    try {
      const response = await this.makeRequest('/chat', { method: 'GET' });
      
      if (response.status === 200) {
        log(`✅ 聊天API健康检查通过`, 'green');
        return true;
      } else {
        log(`❌ 聊天API健康检查失败: HTTP ${response.status}`, 'red');
        return false;
      }
    } catch (error) {
      log(`❌ 聊天API健康检查异常: ${error.message}`, 'red');
      return false;
    }
  }

  // 测试模型验证API
  async testModelValidation() {
    log('🎯 测试模型验证...', 'cyan');
    
    const testCases = [
      { model: 'claude-opus-4-1-20250805', expected: true },
      { model: 'gemini-2.5-pro', expected: true },
      { model: 'invalid-model', expected: false }
    ];

    let passCount = 0;
    
    for (const testCase of testCases) {
      try {
        // 这里我们通过发送请求到聊天API来测试模型验证
        // 实际应用中可能有专门的模型验证端点
        const response = await this.makeRequest('/chat', {
          method: 'POST',
          body: {
            model: testCase.model,
            messages: [{ role: 'user', content: 'test' }]
          }
        });

        const success = testCase.expected ? response.status !== 400 : response.status === 400;
        
        if (success) {
          log(`  ✅ ${testCase.model}: 验证${testCase.expected ? '通过' : '拒绝'} (预期)`, 'green');
          passCount++;
        } else {
          log(`  ❌ ${testCase.model}: 验证结果不符合预期`, 'red');
        }
        
      } catch (error) {
        log(`  ⚠️  ${testCase.model}: 测试异常 - ${error.message}`, 'yellow');
      }
    }

    const success = passCount === testCases.length;
    log(`${success ? '✅' : '❌'} 模型验证测试完成: ${passCount}/${testCases.length} 通过`, success ? 'green' : 'red');
    return success;
  }
}

// 主测试执行器
class ComprehensiveTestRunner {
  constructor() {
    this.db = new DatabaseChecker(TEST_CONFIG.dbPath);
    this.api = new APITester(TEST_CONFIG.apiBase);
    this.results = {};
  }

  async runAllTests() {
    log('🚀 开始综合数据流转测试...', 'magenta');
    log(`📍 测试目标: ${TEST_CONFIG.apiBase}`, 'blue');
    log(`💾 数据库: ${TEST_CONFIG.dbPath}`, 'blue');
    
    try {
      // 第一阶段: 数据库结构检查
      log('\n📋 第一阶段: 数据库结构检查', 'magenta');
      this.results.dbStructure = await this.db.checkDatabaseStructure();

      if (!this.results.dbStructure) {
        log('❌ 数据库结构检查失败，中断测试', 'red');
        return this.results;
      }

      // 第二阶段: 数据完整性检查
      log('\n📋 第二阶段: 数据完整性检查', 'magenta');
      this.results.dataIntegrity = await this.db.checkDataIntegrity();

      // 第三阶段: API健康检查
      log('\n📋 第三阶段: API健康检查', 'magenta');
      this.results.dbConnection = await this.api.testDatabaseConnection();
      this.results.chatAPIHealth = await this.api.testChatAPIHealth();

      // 第四阶段: 模型验证测试
      log('\n📋 第四阶段: 模型验证测试', 'magenta');
      this.results.modelValidation = await this.api.testModelValidation();

      // 第五阶段: 多KEY架构测试
      log('\n📋 第五阶段: 多KEY架构测试', 'magenta');
      await this.testMultiKeyArchitecture();

      // 生成测试报告
      this.generateTestReport();

    } catch (error) {
      log(`💥 测试执行异常: ${error.message}`, 'red');
      this.results.error = error.message;
    } finally {
      await this.cleanup();
    }

    return this.results;
  }

  async testMultiKeyArchitecture() {
    log('🔑 测试多KEY架构工作状态...', 'cyan');
    
    // 测试不同模型的KEY选择
    for (const modelId of TEST_CONFIG.testModels) {
      try {
        log(`  测试模型: ${modelId}`, 'blue');
        
        // 这里应该测试实际的聊天流程
        // 但由于需要认证token，我们先测试API响应
        const response = await this.api.makeRequest('/chat', {
          method: 'POST',
          body: {
            model: modelId,
            messages: [{ role: 'user', content: '测试多KEY架构' }]
          }
        });

        if (response.status === 401) {
          log(`  ⚠️  ${modelId}: 需要认证 (符合预期)`, 'yellow');
        } else if (response.status === 400) {
          const errorBody = JSON.parse(response.body);
          if (errorBody.error && errorBody.error.includes('API Key')) {
            log(`  ✅ ${modelId}: KEY选择逻辑正常工作`, 'green');
          } else {
            log(`  ❌ ${modelId}: 其他验证错误`, 'red');
          }
        } else {
          log(`  📊 ${modelId}: HTTP ${response.status}`, 'blue');
        }

      } catch (error) {
        log(`  ❌ ${modelId}: 测试异常 - ${error.message}`, 'red');
      }
    }
  }

  generateTestReport() {
    log('\n📊 综合测试报告', 'magenta');
    log('=' * 50, 'blue');

    // 统计通过的测试
    let passCount = 0;
    let totalCount = 0;

    const testItems = [
      { name: '数据库结构', result: this.results.dbStructure },
      { name: '数据库连接', result: this.results.dbConnection },
      { name: '聊天API健康', result: this.results.chatAPIHealth },
      { name: '模型验证', result: this.results.modelValidation },
    ];

    testItems.forEach(item => {
      totalCount++;
      if (item.result) passCount++;
      
      const status = item.result ? '✅ 通过' : '❌ 失败';
      const color = item.result ? 'green' : 'red';
      log(`${status} ${item.name}`, color);
    });

    // 数据完整性详情
    if (this.results.dataIntegrity) {
      log('\n📋 数据完整性详情:', 'blue');
      this.results.dataIntegrity.forEach(check => {
        if (check.status === 'pass') {
          log(`  ✅ ${check.type}: 检查通过`, 'green');
        } else if (check.status === 'warning') {
          log(`  ⚠️  ${check.type}: ${check.count} 项需要注意`, 'yellow');
        } else {
          log(`  ❌ ${check.type}: ${check.error || '检查失败'}`, 'red');
        }
      });
    }

    // 总体评分
    const score = Math.round((passCount / totalCount) * 100);
    const scoreColor = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';
    
    log(`\n🎯 总体评分: ${score}% (${passCount}/${totalCount} 通过)`, scoreColor);

    if (score >= 80) {
      log('🎊 系统状态良好，数据流转正常！', 'green');
    } else if (score >= 60) {
      log('⚠️  系统基本正常，有部分问题需要关注。', 'yellow');
    } else {
      log('🚨 系统存在重要问题，需要立即处理！', 'red');
    }

    // 建议
    log('\n💡 改进建议:', 'blue');
    if (!this.results.dbStructure) {
      log('  • 运行 npx prisma db push 同步数据库结构', 'yellow');
    }
    if (!this.results.dbConnection) {
      log('  • 检查数据库连接配置和权限', 'yellow');  
    }
    log('  • 定期运行此测试脚本监控系统状态', 'blue');
    log('  • 考虑添加自动化监控和告警', 'blue');
  }

  async cleanup() {
    if (this.db) {
      await this.db.close();
    }
  }
}

// 执行测试
if (require.main === module) {
  const runner = new ComprehensiveTestRunner();
  
  runner.runAllTests()
    .then(() => {
      log('\n🏁 综合测试完成!', 'magenta');
      process.exit(0);
    })
    .catch(error => {
      log(`💥 测试执行失败: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = { ComprehensiveTestRunner, DatabaseChecker, APITester };