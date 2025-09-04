/**
 * 性能基准测试和监控脚本
 * 用于Phase 0建立基准线和持续监控
 */

const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDir();
    this.baseline = null;
    this.samples = [];
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  // 获取系统性能指标
  async getSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: Math.floor(process.uptime()),
    };
  }

  // 建立性能基准线
  async establishBaseline() {
    const samples = [];
    const sampleCount = 10;
    const interval = 1000; // 1秒间隔

    for (let i = 0; i < sampleCount; i++) {
      const metrics = await this.getSystemMetrics();
      samples.push(metrics);
      
      if (i < sampleCount - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      
      process.stdout.write(`\r采集样本: ${i + 1}/${sampleCount}`);
    }
    
    // 计算平均值
    this.baseline = {
      memory: {
        heapUsed: Math.round(samples.reduce((sum, s) => sum + s.memory.heapUsed, 0) / samples.length),
        heapTotal: Math.round(samples.reduce((sum, s) => sum + s.memory.heapTotal, 0) / samples.length),
        rss: Math.round(samples.reduce((sum, s) => sum + s.memory.rss, 0) / samples.length),
      },
      timestamp: new Date().toISOString(),
      sampleCount,
    };

    // 保存基准数据
    const baselineFile = path.join(this.logDir, 'performance-baseline.json');
    fs.writeFileSync(baselineFile, JSON.stringify(this.baseline, null, 2));
    
    : ${this.baseline.memory.heapUsed}MB`);
    : ${this.baseline.memory.rss}MB`);
    return this.baseline;
  }

  // 连续监控模式
  async startContinuousMonitoring(durationMinutes = 5) {
    const startTime = Date.now();
    const endTime = startTime + (durationMinutes * 60 * 1000);
    const samples = [];

    while (Date.now() < endTime) {
      const metrics = await this.getSystemMetrics();
      samples.push(metrics);
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      process.stdout.write(`\r监控中... ${elapsed}s (内存: ${metrics.memory.heapUsed}MB)`);
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒间隔
    }
    
    // 分析趋势
    const memoryTrend = samples.map(s => s.memory.heapUsed);
    const memoryGrowth = memoryTrend[memoryTrend.length - 1] - memoryTrend[0];
    
    }MB`);
    }MB`);
    
    // 保存监控数据
    const monitorFile = path.join(this.logDir, `performance-monitor-${Date.now()}.json`);
    fs.writeFileSync(monitorFile, JSON.stringify({
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      samples,
      analysis: {
        memoryGrowth,
        maxMemory: Math.max(...memoryTrend),
        minMemory: Math.min(...memoryTrend),
        sampleCount: samples.length,
      }
    }, null, 2));
    
    return {
      samples,
      memoryGrowth,
      file: monitorFile,
    };
  }

  // 健康检查API性能测试
  async testHealthAPI(endpoint = 'http://localhost:3007/api/health') {
    const results = [];
    const testCount = 20;

    for (let i = 0; i < testCount; i++) {
      const startTime = Date.now();
      
      try {
        const response = await fetch(endpoint);
        const responseTime = Date.now() - startTime;
        const data = await response.json();
        
        results.push({
          attempt: i + 1,
          responseTime,
          status: response.status,
          success: response.ok,
          data: data,
        });
        
        process.stdout.write(`\r测试进度: ${i + 1}/${testCount} (${responseTime}ms)`);
        
      } catch (error) {
        results.push({
          attempt: i + 1,
          responseTime: Date.now() - startTime,
          success: false,
          error: error.message,
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms间隔
    }
    
    // 分析结果
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    
    if (successfulTests.length > 0) {
      const responseTimes = successfulTests.map(r => r.responseTime);
      const avgResponse = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      
      .toFixed(1)}%`);
      }ms`);
      }ms`);
      }ms`);
      
      if (failedTests.length > 0) {
        }
    } else {
      }
    
    return {
      results,
      summary: {
        successRate: successfulTests.length / testCount,
        avgResponseTime: successfulTests.length > 0 ? 
          successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length : 0,
      }
    };
  }
}

// 命令行界面
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'baseline';
  
  const monitor = new PerformanceMonitor();
  
  switch (command) {
    case 'baseline':
      await monitor.establishBaseline();
      break;
      
    case 'monitor':
      const duration = parseInt(args[1]) || 5;
      await monitor.startContinuousMonitoring(duration);
      break;
      
    case 'test-api':
      const endpoint = args[1] || 'http://localhost:3007/api/health';
      await monitor.testHealthAPI(endpoint);
      break;
      
    case 'full':
      await monitor.establishBaseline();
      
      await monitor.startContinuousMonitoring(3);
      
      await monitor.testHealthAPI();
      
      break;
      
    default:
      test-api [端点]       测试API性能
  full                  执行完整评估

示例:
  node performance-monitor.js baseline
  node performance-monitor.js monitor 10
  node performance-monitor.js test-api http://localhost:3007/api/health
  node performance-monitor.js full
      `);
  }
}

// 如果直接执行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = PerformanceMonitor;