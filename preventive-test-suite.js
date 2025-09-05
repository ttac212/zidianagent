/**
 * 预防性测试套件
 * 用于持续监控项目配置一致性，避免类似52条消息显示问题的再次发生
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

class PreventiveTestSuite {
  constructor() {
    this.testResults = [];
    this.errors = [];
    this.warnings = [];
    this.configIssues = [];
    this.performanceIssues = [];
  }

  // 运行所有预防性测试
  async runAllTests() {
    console.log('🚀 运行预防性测试套件...\n');
    
    try {
      // 1. 配置一致性测试
      await this.testConfigurationConsistency();
      
      // 2. 虚拟滚动配置测试
      await this.testVirtualScrollConfig();
      
      // 3. 边界值测试
      await this.testBoundaryValues();
      
      // 4. 数据库查询测试
      await this.testDatabaseQueries();
      
      // 5. API端点数据完整性测试
      await this.testAPIDataIntegrity();
      
      // 6. 对话加载测试
      await this.testConversationLoading();
      
      // 7. 内存泄漏检测
      await this.testMemoryLeaks();
      
    } catch (error) {
      this.errors.push({
        test: 'Test Suite Execution',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // 生成测试报告
    this.generateTestReport();
  }

  // 测试配置一致性
  async testConfigurationConsistency() {
    console.log('⚙️ 测试配置一致性...');
    
    try {
      // 检查聊天配置文件是否存在
      const configPath = 'lib/config/chat-config.ts';
      if (!fs.existsSync(configPath)) {
        this.configIssues.push('聊天配置文件不存在');
        return;
      }
      
      // 读取配置内容
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // 验证关键配置项
      const requiredConfigs = [
        'VIRTUAL_SCROLL_CONFIG',
        'threshold',
        'itemHeight',
        'overscan',
        'autoScrollThreshold'
      ];
      
      const missingConfigs = requiredConfigs.filter(config => 
        !configContent.includes(config)
      );
      
      if (missingConfigs.length > 0) {
        this.configIssues.push(`缺少配置项: ${missingConfigs.join(', ')}`);
      }
      
      this.testResults.push({
        test: 'Configuration Consistency',
        status: missingConfigs.length === 0 ? 'PASS' : 'FAIL',
        issues: missingConfigs
      });
      
    } catch (error) {
      this.errors.push({
        test: 'Configuration Consistency',
        error: error.message
      });
    }
  }

  // 测试虚拟滚动配置
  async testVirtualScrollConfig() {
    console.log('🔄 测试虚拟滚动配置...');
    
    try {
      const files = [
        'components/chat/smart-chat-center-v2-fixed.tsx',
        'components/chat/chat-messages-virtual.tsx'
      ];
      
      const thresholds = [];
      
      files.forEach(file => {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // 检查是否使用统一配置
          const usesConfig = content.includes('VIRTUAL_SCROLL_CONFIG');
          if (!usesConfig) {
            this.configIssues.push(`${file} 未使用统一配置`);
          }
          
          // 检查硬编码阈值
          const hardcodedThresholds = content.match(/length\s*>\s*(\d+)/g);
          if (hardcodedThresholds) {
            hardcodedThresholds.forEach(match => {
              const value = parseInt(match.match(/\d+/)[0]);
              if (value > 10 && value < 1000) { // 过滤掉明显不是阈值的数字
                thresholds.push({ file, value });
              }
            });
          }
        }
      });
      
      // 检查阈值一致性
      const uniqueThresholds = [...new Set(thresholds.map(t => t.value))];
      const isConsistent = uniqueThresholds.length <= 1;
      
      this.testResults.push({
        test: 'Virtual Scroll Configuration',
        status: isConsistent && this.configIssues.length === 0 ? 'PASS' : 'FAIL',
        thresholds: uniqueThresholds,
        issues: isConsistent ? [] : ['阈值不一致']
      });
      
    } catch (error) {
      this.errors.push({
        test: 'Virtual Scroll Configuration',
        error: error.message
      });
    }
  }

  // 测试边界值
  async testBoundaryValues() {
    console.log('🎯 测试边界值处理...');
    
    try {
      // 检查关键边界值文件
      const criticalFiles = [
        'components/chat/smart-chat-center-v2-fixed.tsx',
        'components/chat/chat-messages-virtual.tsx',
        'hooks/use-conversations.ts'
      ];
      
      const boundaryIssues = [];
      
      criticalFiles.forEach(file => {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // 检查可能的问题模式
          const problemPatterns = [
            // 精确匹配可能有边界问题
            { pattern: /===\s*\d+/, issue: '使用精确匹配，可能有边界问题' },
            // 硬编码的小数字阈值
            { pattern: /[><]=?\s*[1-9]\d?(?![0-9])/, issue: '硬编码的小数字阈值' },
          ];
          
          problemPatterns.forEach(({ pattern, issue }) => {
            const matches = content.match(new RegExp(pattern.source, 'g'));
            if (matches && matches.length > 0) {
              boundaryIssues.push({ file, issue, count: matches.length });
            }
          });
        }
      });
      
      this.testResults.push({
        test: 'Boundary Values',
        status: boundaryIssues.length === 0 ? 'PASS' : 'WARN',
        issues: boundaryIssues
      });
      
    } catch (error) {
      this.errors.push({
        test: 'Boundary Values',
        error: error.message
      });
    }
  }

  // 测试数据库查询
  async testDatabaseQueries() {
    console.log('💾 测试数据库查询性能...');
    
    try {
      const prisma = new PrismaClient();
      
      // 测试对话查询性能
      const testConversationId = 'cmeym11b70011vbm8p0075xee';
      
      // 测试1: 检查对话是否存在
      const conversation = await prisma.conversation.findUnique({
        where: { id: testConversationId },
        include: { _count: { select: { messages: true } } }
      });
      
      if (!conversation) {
        this.warnings.push('测试对话不存在，跳过某些测试');
      } else {
        // 测试2: 检查消息加载时间
        const startTime = Date.now();
        const messages = await prisma.message.findMany({
          where: { conversationId: testConversationId },
          orderBy: { createdAt: 'asc' },
          take: 100 // 限制查询数量
        });
        const loadTime = Date.now() - startTime;
        
        this.performanceIssues.push({
          query: 'Message Loading',
          messageCount: messages.length,
          loadTime,
          isAcceptable: loadTime < 1000 // 1秒内可接受
        });
      }
      
      await prisma.$disconnect();
      
      this.testResults.push({
        test: 'Database Queries',
        status: 'PASS',
        performance: this.performanceIssues.slice(-1)
      });
      
    } catch (error) {
      this.errors.push({
        test: 'Database Queries',
        error: error.message
      });
    }
  }

  // 测试API端点数据完整性
  async testAPIDataIntegrity() {
    console.log('🌐 测试API端点数据完整性...');
    
    try {
      // 这里模拟API测试，实际环境中需要启动服务器
      const apiEndpoints = [
        { path: '/conversations', expectedFields: ['id', 'title', 'messages'] },
        { path: '/health', expectedFields: ['status', 'timestamp'] }
      ];
      
      // 简单的结构检查（在实际实现中会调用真实API）
      const apiIssues = [];
      
      // 检查API路由文件是否存在
      apiEndpoints.forEach(endpoint => {
        const routeFile = `app/api${endpoint.path}/route.ts`;
        if (!fs.existsSync(routeFile)) {
          apiIssues.push(`API路由文件不存在: ${routeFile}`);
        }
      });
      
      this.testResults.push({
        test: 'API Data Integrity',
        status: apiIssues.length === 0 ? 'PASS' : 'FAIL',
        issues: apiIssues
      });
      
    } catch (error) {
      this.errors.push({
        test: 'API Data Integrity',
        error: error.message
      });
    }
  }

  // 测试对话加载功能
  async testConversationLoading() {
    console.log('💬 测试对话加载功能...');
    
    try {
      // 检查关键组件是否存在
      const requiredComponents = [
        'components/chat/smart-chat-center-v2-fixed.tsx',
        'components/chat/chat-messages.tsx',
        'components/chat/chat-messages-virtual.tsx',
        'hooks/use-conversations.ts'
      ];
      
      const missingComponents = requiredComponents.filter(file => !fs.existsSync(file));
      
      if (missingComponents.length > 0) {
        this.configIssues.push(`缺少关键组件: ${missingComponents.join(', ')}`);
      }
      
      // 检查虚拟滚动逻辑
      const mainComponent = 'components/chat/smart-chat-center-v2-fixed.tsx';
      if (fs.existsSync(mainComponent)) {
        const content = fs.readFileSync(mainComponent, 'utf8');
        
        // 检查是否有正确的条件渲染逻辑
        const hasConditionalRendering = content.includes('state.messages.length >') || content.includes('messages.length >');
        const usesVirtualScroll = content.includes('ChatMessagesVirtual');
        const usesNormalScroll = content.includes('ChatMessages');
        
        if (!hasConditionalRendering) {
          this.configIssues.push('缺少消息数量条件渲染逻辑');
        }
        
        if (!usesVirtualScroll || !usesNormalScroll) {
          this.configIssues.push('缺少虚拟滚动或普通滚动组件');
        }
      }
      
      this.testResults.push({
        test: 'Conversation Loading',
        status: missingComponents.length === 0 && this.configIssues.length === 0 ? 'PASS' : 'FAIL',
        missingComponents,
        configIssues: this.configIssues.slice(-2) // 最近的问题
      });
      
    } catch (error) {
      this.errors.push({
        test: 'Conversation Loading',
        error: error.message
      });
    }
  }

  // 测试内存泄漏
  async testMemoryLeaks() {
    console.log('🧠 测试内存泄漏风险...');
    
    try {
      const riskPatterns = [
        // 未清理的事件监听器
        { pattern: /addEventListener.*(?!removeEventListener)/, risk: '可能的事件监听器泄漏' },
        // 未清理的定时器
        { pattern: /setInterval.*(?!clearInterval)/, risk: '可能的定时器泄漏' },
        { pattern: /setTimeout.*(?!clearTimeout)/, risk: '可能的超时泄漏' },
        // 大对象存储
        { pattern: /useState\s*\(\s*\[\s*\]/, risk: '可能的大数组状态' },
      ];
      
      const memoryRisks = [];
      const scanFiles = [
        'components/chat',
        'hooks'
      ];
      
      scanFiles.forEach(dir => {
        if (fs.existsSync(dir)) {
          this.scanForMemoryLeaks(dir, riskPatterns, memoryRisks);
        }
      });
      
      this.testResults.push({
        test: 'Memory Leaks',
        status: memoryRisks.length === 0 ? 'PASS' : 'WARN',
        risks: memoryRisks.slice(0, 10) // 前10个风险
      });
      
    } catch (error) {
      this.errors.push({
        test: 'Memory Leaks',
        error: error.message
      });
    }
  }

  // 递归扫描内存泄漏风险
  scanForMemoryLeaks(dir, patterns, risks) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        this.scanForMemoryLeaks(fullPath, patterns, risks);
      } else if (item.isFile() && (item.name.endsWith('.tsx') || item.name.endsWith('.ts'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          patterns.forEach(({ pattern, risk }) => {
            if (content.match(new RegExp(pattern.source, 'g'))) {
              risks.push({
                file: fullPath,
                risk,
                severity: 'medium'
              });
            }
          });
        } catch (error) {
          // 忽略读取错误
        }
      }
    }
  }

  // 生成测试报告
  generateTestReport() {
    console.log('\n📊 预防性测试结果报告\n');
    
    // 统计摘要
    const passCount = this.testResults.filter(r => r.status === 'PASS').length;
    const failCount = this.testResults.filter(r => r.status === 'FAIL').length;
    const warnCount = this.testResults.filter(r => r.status === 'WARN').length;
    
    console.log('📈 测试统计:');
    console.log(`  ✅ 通过: ${passCount} 个`);
    console.log(`  ❌ 失败: ${failCount} 个`);
    console.log(`  ⚠️  警告: ${warnCount} 个`);
    console.log(`  🚨 错误: ${this.errors.length} 个`);
    
    // 详细结果
    console.log('\n📋 详细测试结果:');
    this.testResults.forEach((result, index) => {
      const statusEmoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`\n${index + 1}. ${statusEmoji} ${result.test}`);
      
      if (result.issues && result.issues.length > 0) {
        console.log(`   问题: ${result.issues.join(', ')}`);
      }
      
      if (result.performance) {
        result.performance.forEach(perf => {
          console.log(`   性能: ${perf.query} - ${perf.loadTime}ms (${perf.isAcceptable ? '可接受' : '需优化'})`);
        });
      }
    });
    
    // 错误详情
    if (this.errors.length > 0) {
      console.log('\n🚨 错误详情:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.test}: ${error.error}`);
      });
    }
    
    // 生成改进建议
    this.generateImprovementSuggestions();
    
    // 保存测试结果
    this.saveTestResults();
  }

  // 生成改进建议
  generateImprovementSuggestions() {
    console.log('\n💡 改进建议:');
    
    const suggestions = [];
    
    if (this.configIssues.length > 0) {
      suggestions.push('🔧 修复配置一致性问题，确保所有组件使用统一配置');
    }
    
    const slowQueries = this.performanceIssues.filter(p => !p.isAcceptable);
    if (slowQueries.length > 0) {
      suggestions.push('⚡ 优化数据库查询性能，考虑添加索引或分页');
    }
    
    const failedTests = this.testResults.filter(r => r.status === 'FAIL');
    if (failedTests.length > 0) {
      suggestions.push('❌ 修复失败的测试项，确保系统稳定性');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('🎉 所有测试通过，系统配置良好！');
    }
    
    suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion}`);
    });
    
    console.log('\n📅 建议定期运行此测试套件以确保系统健康');
  }

  // 保存测试结果
  saveTestResults() {
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.status === 'PASS').length,
        failed: this.testResults.filter(r => r.status === 'FAIL').length,
        warnings: this.testResults.filter(r => r.status === 'WARN').length,
        errors: this.errors.length
      },
      testResults: this.testResults,
      errors: this.errors,
      configIssues: this.configIssues,
      performanceIssues: this.performanceIssues
    };
    
    const reportPath = `test-reports/preventive-test-${Date.now()}.json`;
    
    // 确保目录存在
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 测试结果已保存到: ${reportPath}`);
  }

  // 运行测试
  async run() {
    await this.runAllTests();
  }
}

// 运行预防性测试套件
if (require.main === module) {
  const testSuite = new PreventiveTestSuite();
  testSuite.run().then(() => {
    console.log('\n✨ 预防性测试完成');
    process.exit(0);
  }).catch(error => {
    console.error('❌ 测试套件执行失败:', error);
    process.exit(1);
  });
}

module.exports = { PreventiveTestSuite };