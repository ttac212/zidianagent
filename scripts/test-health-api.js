/**
 * 健康检查API测试脚本
 * 验证503错误修复效果
 */

const http = require('http');

console.log('===========================================');
console.log('       健康检查API测试工具 v1.0           ');
console.log('===========================================\n');

const PORT = 3007;
const HOST = 'localhost';
const ENDPOINT = '/api/health';

// 测试统计
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
const responseTimes = [];
const statusCodes = {};

// 单次健康检查请求
function makeHealthCheckRequest() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const options = {
      hostname: HOST,
      port: PORT,
      path: ENDPOINT,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        totalRequests++;
        
        // 记录状态码
        statusCodes[res.statusCode] = (statusCodes[res.statusCode] || 0) + 1;
        
        if (res.statusCode === 200) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
        
        responseTimes.push(responseTime);
        
        let parsedData = {};
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          // 忽略JSON解析错误
        }
        
        resolve({
          statusCode: res.statusCode,
          responseTime,
          data: parsedData,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (error) => {
      totalRequests++;
      failedRequests++;
      resolve({
        statusCode: 0,
        responseTime: Date.now() - startTime,
        error: error.message
      });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      totalRequests++;
      failedRequests++;
      resolve({
        statusCode: 0,
        responseTime: 5000,
        error: 'Request timeout'
      });
    });
    
    req.end();
  });
}

// 执行测试
async function runTests() {
  console.log('📋 步骤1: 单次健康检查测试');
  console.log('-------------------------------------------');
  
  const singleTest = await makeHealthCheckRequest();
  console.log(`状态码: ${singleTest.statusCode}`);
  console.log(`响应时间: ${singleTest.responseTime}ms`);
  
  if (singleTest.data && singleTest.data.status) {
    console.log(`健康状态: ${singleTest.data.status}`);
    
    if (singleTest.data.diagnostics) {
      console.log(`请求ID: ${singleTest.data.diagnostics.requestId}`);
      console.log(`配置状态: ${singleTest.data.diagnostics.configStatus}`);
      
      if (singleTest.data.diagnostics.statistics) {
        const stats = singleTest.data.diagnostics.statistics;
        console.log(`\n服务器统计:`);
        console.log(`  总请求数: ${stats.total}`);
        console.log(`  成功数: ${stats.success}`);
        console.log(`  失败数: ${stats.failure}`);
        console.log(`  成功率: ${stats.successRate}%`);
      }
    }
    
    if (singleTest.data.healthChecks) {
      console.log(`\n健康检查项:`);
      singleTest.data.healthChecks.forEach(check => {
        console.log(`  ${check}`);
      });
    }
  }
  
  if (singleTest.error) {
    console.log(`错误: ${singleTest.error}`);
  }
  
  // 并发测试
  console.log('\n\n📊 步骤2: 并发请求测试（10个并发）');
  console.log('-------------------------------------------');
  
  const concurrentPromises = [];
  for (let i = 0; i < 10; i++) {
    concurrentPromises.push(makeHealthCheckRequest());
  }
  
  const concurrentResults = await Promise.all(concurrentPromises);
  
  console.log('并发测试结果:');
  concurrentResults.forEach((result, index) => {
    console.log(`  请求${index + 1}: 状态${result.statusCode} - ${result.responseTime}ms`);
  });
  
  // 连续请求测试
  console.log('\n\n🔄 步骤3: 连续请求测试（20次）');
  console.log('-------------------------------------------');
  
  for (let i = 0; i < 20; i++) {
    const result = await makeHealthCheckRequest();
    process.stdout.write(`${result.statusCode === 200 ? '✓' : '✗'}`);
    if ((i + 1) % 10 === 0) process.stdout.write('\n');
    
    // 短暂延迟避免过载
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 统计分析
  console.log('\n\n\n📈 测试统计汇总');
  console.log('===========================================');
  
  const successRate = totalRequests > 0 ? 
    (successfulRequests / totalRequests * 100).toFixed(2) : 0;
  
  console.log(`总请求数: ${totalRequests}`);
  console.log(`成功请求: ${successfulRequests}`);
  console.log(`失败请求: ${failedRequests}`);
  console.log(`成功率: ${successRate}%`);
  
  console.log('\n状态码分布:');
  Object.entries(statusCodes).forEach(([code, count]) => {
    const percentage = (count / totalRequests * 100).toFixed(2);
    console.log(`  ${code}: ${count}次 (${percentage}%)`);
  });
  
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    
    console.log('\n响应时间统计:');
    console.log(`  平均: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  最小: ${minResponseTime}ms`);
    console.log(`  最大: ${maxResponseTime}ms`);
  }
  
  // 诊断结果
  console.log('\n\n🔬 诊断结果');
  console.log('===========================================');
  
  if (failedRequests === 0) {
    console.log('✅ 所有健康检查请求都成功！');
    console.log('503错误已被成功修复。');
  } else if (failedRequests < totalRequests * 0.1) {
    console.log('⚠️ 发现少量失败请求');
    console.log(`失败率: ${(failedRequests / totalRequests * 100).toFixed(2)}%`);
    console.log('可能是网络抖动或临时问题。');
  } else {
    console.log('❌ 发现大量失败请求');
    console.log(`失败率: ${(failedRequests / totalRequests * 100).toFixed(2)}%`);
    console.log('503错误问题可能仍然存在。');
    console.log('\n建议检查:');
    console.log('1. 服务器是否正在运行');
    console.log('2. 环境变量配置是否正确');
    console.log('3. 查看服务器日志获取更多信息');
  }
  
  console.log('\n✨ 测试完成！');
}

// 检查服务器是否运行
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: '/',
      method: 'HEAD'
    }, (res) => {
      resolve(true);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// 主函数
async function main() {
  console.log(`🔍 检查服务器 http://${HOST}:${PORT}...`);
  
  const serverRunning = await checkServerRunning();
  
  if (!serverRunning) {
    console.log('\n❌ 服务器未运行！');
    console.log('请先启动开发服务器:');
    console.log('  pnpm dev');
    console.log('\n然后重新运行此测试脚本。');
    process.exit(1);
  }
  
  console.log('✅ 服务器正在运行\n');
  
  await runTests();
}

// 运行主函数
main().catch(console.error);