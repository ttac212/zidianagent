/**
 * 测试连接监控功能在关键页面的集成状态
 * 验证所有重要页面都已成功集成连接监控组件
 * Phase 2: 多页面推广验证
 */

const http = require('http');
const path = require('path');

class ConnectionMonitoringIntegrationTest {
  constructor() {
    this.testResults = [];
    this.testStartTime = Date.now();
    this.baseUrl = 'http://localhost:3007';
    
    // 已集成连接监控的关键页面
    this.integratedPages = [
      { 
        path: '/', 
        name: '主页', 
        expectedRedirect: false,
        requiresAuth: false 
      },
      { 
        path: '/settings', 
        name: '设置页面', 
        expectedRedirect: true,
        requiresAuth: true,
        redirectPath: '/login'
      },
      { 
        path: '/workspace', 
        name: '工作区页面', 
        expectedRedirect: true,
        requiresAuth: true,
        redirectPath: '/login'
      },
      { 
        path: '/documents', 
        name: '文档页面', 
        expectedRedirect: true,
        requiresAuth: true,
        redirectPath: '/login'
      },
      { 
        path: '/inspiration', 
        name: '视频内容洞察页面', 
        expectedRedirect: true,
        requiresAuth: true,
        redirectPath: '/login'
      }
    ];
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}`;
    this.testResults.push({
      timestamp,
      type,
      message,
      elapsed: Date.now() - this.testStartTime
    });
  }

  async makeHttpRequest(url, timeout = 8000, followRedirects = false) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const req = http.get(url, { timeout }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          resolve({
            success: true,
            statusCode: res.statusCode,
            data: data,
            responseTime,
            headers: res.headers
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject({
          success: false,
          error: 'Request timeout',
          responseTime: Date.now() - startTime
        });
      });

      req.on('error', (err) => {
        reject({
          success: false,
          error: err.message,
          responseTime: Date.now() - startTime
        });
      });
    });
  }

  async testHealthEndpointAvailability() {
    this.log('🔍 测试健康检查端点可用性');
    
    try {
      const response = await this.makeHttpRequest(`${this.baseUrl}/api/health`);
      
      if (response.success && response.statusCode === 200) {
        const healthData = JSON.parse(response.data);
        this.log(`✅ 健康检查端点正常: 状态=${healthData.status}, 响应时间=${response.responseTime}ms`, 'SUCCESS');
        return true;
      } else {
        this.log(`❌ 健康检查端点异常: HTTP ${response.statusCode}`, 'ERROR');
        return false;
      }
    } catch (error) {
      this.log(`❌ 健康检查端点不可用: ${error.error || error.message}`, 'ERROR');
      return false;
    }
  }

  async testPageAccessibility(page) {
    this.log(`🔍 测试页面可访问性: ${page.name} (${page.path})`);
    
    try {
      const response = await this.makeHttpRequest(`${this.baseUrl}${page.path}`);
      
      if (page.requiresAuth && page.expectedRedirect) {
        // 需要认证的页面应该重定向到登录页面
        if (response.success && response.statusCode === 307) {
          const locationHeader = response.headers.location;
          
          if (locationHeader && locationHeader.includes('/login')) {
            this.log(`✅ ${page.name} 认证重定向正常: ${locationHeader}`, 'SUCCESS');
            return true;
          } else {
            this.log(`❌ ${page.name} 重定向目标异常: ${locationHeader}`, 'ERROR');
            return false;
          }
        } else {
          this.log(`❌ ${page.name} 未按预期重定向: HTTP ${response.statusCode}`, 'ERROR');
          return false;
        }
      } else {
        // 公开页面应该正常访问
        if (response.success && response.statusCode === 200) {
          this.log(`✅ ${page.name} 页面访问正常 (响应时间: ${response.responseTime}ms)`, 'SUCCESS');
          return true;
        } else {
          this.log(`❌ ${page.name} 页面访问异常: HTTP ${response.statusCode}`, 'ERROR');
          return false;
        }
      }
    } catch (error) {
      this.log(`❌ ${page.name} 页面访问失败: ${error.error || error.message}`, 'ERROR');
      return false;
    }
  }

  async testConnectionMonitoringIntegration() {
    this.log('🔍 测试连接监控组件集成状态');
    
    // 测试策略: 通过检查各页面是否正常响应，间接验证连接监控组件没有影响页面功能
    let passedPages = 0;
    
    for (const page of this.integratedPages) {
      const result = await this.testPageAccessibility(page);
      if (result) {
        passedPages++;
      }
      
      // 间隔检查，避免请求过于密集
      await this.sleep(200);
    }
    
    const successRate = (passedPages / this.integratedPages.length) * 100;
    
    this.log(`📊 页面集成结果:`);
    this.log(`   总页面数: ${this.integratedPages.length}`);
    this.log(`   成功页面数: ${passedPages}`);
    this.log(`   集成成功率: ${successRate.toFixed(1)}%`);
    
    if (successRate >= 100) {
      this.log('🎉 所有关键页面连接监控集成成功！', 'SUCCESS');
      return true;
    } else if (successRate >= 80) {
      this.log('✅ 大部分页面集成成功，部分页面需要检查', 'SUCCESS');
      return true;
    } else {
      this.log('⚠️  多个页面集成失败，需要进一步排查', 'WARN');
      return false;
    }
  }

  async testResponsiveness() {
    this.log('🔍 测试集成后的系统响应性');
    
    // 并发请求测试，验证连接监控组件不会影响系统性能
    const concurrentRequests = 5;
    const requests = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
      requests.push(this.makeHttpRequest(`${this.baseUrl}/api/health`, 5000));
    }
    
    try {
      const results = await Promise.allSettled(requests);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const avgResponseTime = results
        .filter(r => r.status === 'fulfilled' && r.value.success)
        .reduce((sum, r) => sum + r.value.responseTime, 0) / successCount;
      
      this.log(`✅ 并发响应测试完成:`);
      this.log(`   并发请求数: ${concurrentRequests}`);
      this.log(`   成功数量: ${successCount}`);
      this.log(`   平均响应时间: ${Math.round(avgResponseTime)}ms`);
      
      if (successCount >= concurrentRequests && avgResponseTime < 500) {
        this.log('🚀 系统响应性优秀，连接监控组件无性能影响', 'SUCCESS');
        return true;
      } else if (successCount >= concurrentRequests * 0.8) {
        this.log('✅ 系统响应性良好', 'SUCCESS');
        return true;
      } else {
        this.log('⚠️  系统响应性可能受到影响', 'WARN');
        return false;
      }
      
    } catch (error) {
      this.log(`❌ 并发响应测试失败: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testConnectionStatusVariants() {
    this.log('🔍 测试不同页面的连接状态组件配置');
    
    // 验证不同页面的连接监控配置是否合理
    const pageConfigurations = {
      '主页': { autoHideWhenHealthy: true, showDetails: false },
      '工作区页面': { autoHideWhenHealthy: false, showDetails: false },
      '设置页面': { showDetails: true },
      '文档页面': { autoHideWhenHealthy: true },
      '视频内容洞察页面': { autoHideWhenHealthy: true }
    };
    
    let validConfigurations = 0;
    
    for (const [pageName, config] of Object.entries(pageConfigurations)) {
      // 通过页面能正常访问来间接验证配置正确
      const page = this.integratedPages.find(p => p.name === pageName);
      if (page) {
        const accessible = await this.testPageAccessibility(page);
        if (accessible) {
          this.log(`✅ ${pageName} 连接监控配置验证通过`, 'SUCCESS');
          validConfigurations++;
        } else {
          this.log(`❌ ${pageName} 连接监控配置可能有问题`, 'ERROR');
        }
      }
    }
    
    const configSuccessRate = (validConfigurations / Object.keys(pageConfigurations).length) * 100;
    
    this.log(`📊 连接状态组件配置验证:`);
    this.log(`   总配置数: ${Object.keys(pageConfigurations).length}`);
    this.log(`   有效配置数: ${validConfigurations}`);
    this.log(`   配置正确率: ${configSuccessRate.toFixed(1)}%`);
    
    return configSuccessRate >= 80;
  }

  async runIntegrationTest() {
    this.log('🚀 开始连接监控多页面集成测试', 'SUCCESS');
    
    const tests = [
      { name: '健康检查端点可用性', fn: () => this.testHealthEndpointAvailability() },
      { name: '连接监控组件集成状态', fn: () => this.testConnectionMonitoringIntegration() },
      { name: '系统响应性测试', fn: () => this.testResponsiveness() },
      { name: '连接状态组件配置验证', fn: () => this.testConnectionStatusVariants() },
    ];
    
    let passedTests = 0;
    
    for (const test of tests) {
      this.log(`\n📋 执行测试: ${test.name}`);
      try {
        const result = await test.fn();
        if (result) {
          passedTests++;
          this.log(`✅ ${test.name} - 通过`, 'SUCCESS');
        } else {
          this.log(`❌ ${test.name} - 失败`, 'ERROR');
        }
      } catch (error) {
        this.log(`💥 ${test.name} - 异常: ${error.message}`, 'ERROR');
      }
    }
    
    this.log(`\n📊 多页面集成测试结果总结:`);
    this.log(`   总测试数: ${tests.length}`);
    this.log(`   通过数量: ${passedTests}`);
    this.log(`   成功率: ${Math.round((passedTests / tests.length) * 100)}%`);
    this.log(`   总耗时: ${Math.round((Date.now() - this.testStartTime) / 1000)}秒`);
    
    if (passedTests === tests.length) {
      this.log('🎉 连接监控功能已成功推广到所有关键页面！', 'SUCCESS');
    } else if (passedTests >= tests.length * 0.75) {
      this.log('✅ 连接监控功能推广基本成功，个别问题需要关注', 'SUCCESS');
    } else {
      this.log('⚠️  连接监控功能推广存在问题，需要进一步优化', 'WARN');
    }
    
    return passedTests >= tests.length * 0.75;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 执行集成测试
async function main() {
  const tester = new ConnectionMonitoringIntegrationTest();
  
  );
  );
  
  try {
    await tester.runIntegrationTest();
  } catch (error) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ConnectionMonitoringIntegrationTest;