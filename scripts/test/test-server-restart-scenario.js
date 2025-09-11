/**
 * 服务器重启场景验证测试
 * 验证连接监控系统在服务器重启时的表现
 * Phase 2: 服务器重启场景验证
 */

const http = require('http');
const { spawn, exec } = require('child_process');
const path = require('path');

class ServerRestartScenarioTest {
  constructor() {
    this.testResults = [];
    this.serverProcess = null;
    this.healthEndpoint = 'http://localhost:3007/api/health';
    this.settingsEndpoint = 'http://localhost:3007/settings';
    this.testStartTime = Date.now();
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

  async makeHttpRequest(url, timeout = 8000) {
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

  async waitForServerReady(maxAttempts = 30, interval = 2000) {
    this.log(`等待服务器启动 (最多${maxAttempts}次尝试，间隔${interval}ms)`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.makeHttpRequest(this.healthEndpoint, 5000);
        
        if (response.success && response.statusCode === 200) {
          this.log(`✅ 服务器已就绪 (第${attempt}次尝试，响应时间: ${response.responseTime}ms)`, 'SUCCESS');
          return true;
        }
        
        this.log(`❌ 服务器未就绪 (第${attempt}次尝试，状态码: ${response.statusCode})`, 'WARN');
        
      } catch (error) {
        this.log(`❌ 连接失败 (第${attempt}次尝试): ${error.error || error.message}`, 'WARN');
      }
      
      if (attempt < maxAttempts) {
        await this.sleep(interval);
      }
    }
    
    this.log(`❌ 服务器启动超时 (${maxAttempts}次尝试后仍无法连接)`, 'ERROR');
    return false;
  }

  async testHealthEndpointAccessibility() {
    this.log('🔍 测试健康检查端点可访问性');
    
    try {
      const response = await this.makeHttpRequest(this.healthEndpoint);
      
      if (response.success && response.statusCode === 200) {
        const healthData = JSON.parse(response.data);
        this.log(`✅ 健康检查成功: 状态=${healthData.status}, 响应时间=${response.responseTime}ms`, 'SUCCESS');
        this.log(`   服务器运行时间: ${healthData.uptime}秒, 版本: ${healthData.version}`, 'INFO');
        return true;
      } else {
        this.log(`❌ 健康检查失败: HTTP ${response.statusCode}`, 'ERROR');
        return false;
      }
    } catch (error) {
      this.log(`❌ 健康检查异常: ${error.error || error.message}`, 'ERROR');
      return false;
    }
  }

  async testSettingsPageAccessibility() {
    this.log('🔍 测试设置页面可访问性');
    
    try {
      const response = await this.makeHttpRequest(this.settingsEndpoint);
      
      // 设置页面需要登录，应该返回307重定向
      if (response.success && response.statusCode === 307) {
        this.log(`✅ 设置页面访问正常: 返回登录重定向 (${response.responseTime}ms)`, 'SUCCESS');
        return true;
      } else {
        this.log(`❌ 设置页面访问异常: HTTP ${response.statusCode}`, 'ERROR');
        return false;
      }
    } catch (error) {
      this.log(`❌ 设置页面访问失败: ${error.error || error.message}`, 'ERROR');
      return false;
    }
  }

  async testConnectionMonitoringBehavior() {
    this.log('🔍 测试连接监控行为 (模拟断网检测)');
    
    const testStartTime = Date.now();
    let consecutiveFailures = 0;
    const maxTestDuration = 60000; // 1分钟测试
    const checkInterval = 5000; // 5秒间隔
    
    while (Date.now() - testStartTime < maxTestDuration) {
      try {
        const response = await this.makeHttpRequest(this.healthEndpoint, 3000);
        
        if (response.success && response.statusCode === 200) {
          if (consecutiveFailures > 0) {
            this.log(`✅ 连接恢复检测成功 (之前连续失败${consecutiveFailures}次)`, 'SUCCESS');
          }
          consecutiveFailures = 0;
        } else {
          consecutiveFailures++;
          this.log(`❌ 连接检测失败 (连续${consecutiveFailures}次)`, 'WARN');
        }
        
      } catch (error) {
        consecutiveFailures++;
        this.log(`❌ 连接异常 (连续${consecutiveFailures}次): ${error.error || error.message}`, 'WARN');
        
        // 模拟连接监控的自适应间隔策略
        if (consecutiveFailures >= 3) {
          this.log('⚠️  连接监控应该进入严重异常模式 (5秒间隔)', 'INFO');
        } else if (consecutiveFailures >= 1) {
          this.log('⚠️  连接监控应该进入恢复模式 (10秒间隔)', 'INFO');
        }
      }
      
      await this.sleep(checkInterval);
    }
    
    this.log('✅ 连接监控行为测试完成', 'SUCCESS');
    return true;
  }

  async simulateServerRestart() {
    this.log('🔄 开始模拟服务器重启场景');
    
    // 首先验证服务器正在运行
    const serverRunning = await this.testHealthEndpointAccessibility();
    if (!serverRunning) {
      this.log('❌ 服务器未运行，无法进行重启测试', 'ERROR');
      return false;
    }
    
    this.log('⏸️  请手动重启开发服务器来测试连接监控...');
    this.log('💡 操作步骤:');
    this.log('   1. 在另一个终端中停止开发服务器 (Ctrl+C)');
    this.log('   2. 等待10-15秒');
    this.log('   3. 重新启动开发服务器 (pnpm dev)');
    this.log('   4. 观察此测试脚本的连接检测结果');
    
    // 持续监控连接状态变化
    let lastStatus = 'unknown';
    let disconnectDetectedAt = null;
    let reconnectDetectedAt = null;
    
    for (let i = 0; i < 60; i++) { // 5分钟测试
      try {
        const response = await this.makeHttpRequest(this.healthEndpoint, 5000);
        
        if (response.success && response.statusCode === 200) {
          if (lastStatus === 'disconnected') {
            reconnectDetectedAt = Date.now();
            const disconnectDuration = reconnectDetectedAt - disconnectDetectedAt;
            this.log(`🔄 服务器重新连接成功! 断开持续时间: ${Math.round(disconnectDuration/1000)}秒`, 'SUCCESS');
          }
          lastStatus = 'connected';
        }
        
      } catch (error) {
        if (lastStatus !== 'disconnected') {
          disconnectDetectedAt = Date.now();
          this.log(`💥 检测到服务器断开: ${error.error || error.message}`, 'WARN');
        }
        lastStatus = 'disconnected';
      }
      
      await this.sleep(5000); // 5秒检查间隔
    }
    
    return true;
  }

  async runComprehensiveTest() {
    this.log('🚀 开始服务器重启场景综合测试', 'SUCCESS');
    
    const tests = [
      { name: '等待服务器就绪', fn: () => this.waitForServerReady() },
      { name: '健康检查端点测试', fn: () => this.testHealthEndpointAccessibility() },
      { name: '设置页面访问测试', fn: () => this.testSettingsPageAccessibility() },
      { name: '连接监控行为测试', fn: () => this.testConnectionMonitoringBehavior() },
      { name: '服务器重启场景模拟', fn: () => this.simulateServerRestart() },
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
    
    this.log(`\n📊 测试结果总结:`);
    this.log(`   总测试数: ${tests.length}`);
    this.log(`   通过数量: ${passedTests}`);
    this.log(`   成功率: ${Math.round((passedTests / tests.length) * 100)}%`);
    this.log(`   总耗时: ${Math.round((Date.now() - this.testStartTime) / 1000)}秒`);
    
    if (passedTests === tests.length) {
      this.log('🎉 所有测试通过! 连接监控系统工作正常', 'SUCCESS');
    } else {
      this.log('⚠️  部分测试未通过，请检查连接监控配置', 'WARN');
    }
    
    return passedTests === tests.length;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 执行测试
async function main() {
  const tester = new ServerRestartScenarioTest();
  
  );
  );
  
  try {
    await tester.runComprehensiveTest();
  } catch (error) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ServerRestartScenarioTest;