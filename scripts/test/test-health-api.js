/**
 * 健康检查API测试脚本
 * 验证503错误修复效果
 */

const http = require('http');

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
  const singleTest = await makeHealthCheckRequest();
  if (singleTest.data && singleTest.data.status) {
    if (singleTest.data.diagnostics) {
      if (singleTest.data.diagnostics.statistics) {
        const stats = singleTest.data.diagnostics.statistics;
        }
    }
    
    if (singleTest.data.healthChecks) {
      singleTest.data.healthChecks.forEach(check => {
        });
    }
  }
  
  if (singleTest.error) {
    }
  
  // 并发测试
  const concurrentPromises = [];
  for (let i = 0; i < 10; i++) {
    concurrentPromises.push(makeHealthCheckRequest());
  }
  
  const concurrentResults = await Promise.all(concurrentPromises);
  
  concurrentResults.forEach((result, index) => {
    });
  
  // 连续请求测试
  for (let i = 0; i < 20; i++) {
    const result = await makeHealthCheckRequest();
    process.stdout.write(`${result.statusCode === 200 ? '✓' : '✗'}`);
    if ((i + 1) % 10 === 0) process.stdout.write('\n');
    
    // 短暂延迟避免过载
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 统计分析
  const successRate = totalRequests > 0 ? 
    (successfulRequests / totalRequests * 100).toFixed(2) : 0;
  
  Object.entries(statusCodes).forEach(([code, count]) => {
    const percentage = (count / totalRequests * 100).toFixed(2);
    `);
  });
  
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    
    }ms`);
    }
  
  // 诊断结果
  if (failedRequests === 0) {
    } else if (failedRequests < totalRequests * 0.1) {
    .toFixed(2)}%`);
    } else {
    .toFixed(2)}%`);
    }
  
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
  const serverRunning = await checkServerRunning();
  
  if (!serverRunning) {
    process.exit(1);
  }
  
  await runTests();
}

// 运行主函数
main().catch(console.error);