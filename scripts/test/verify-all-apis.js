#!/usr/bin/env node

const http = require('http');

// 核心API端点列表
const apiEndpoints = [
  { path: '/api/health', method: 'GET', description: '健康检查API' },
  { path: '/api/data/metrics', method: 'GET', description: '统一度量API (GET)' },
  { path: '/api/analytics/events', method: 'GET', description: 'API重定向测试 (events)' },
  { path: '/api/analytics/metrics', method: 'GET', description: 'API重定向测试 (metrics)' },
  { path: '/api/auth/session', method: 'GET', description: '会话检查API' },
  { path: '/api/conversations', method: 'GET', description: '对话列表API' },
];

// POST请求测试
const postEndpoints = [
  { 
    path: '/api/data/metrics', 
    method: 'POST',
    body: JSON.stringify({ type: 'event', eventType: 'test', value: 100 }),
    description: '统一度量API (POST)'
  }
];

// 测试函数
function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3007,
      path: endpoint.path,
      method: endpoint.method,
      timeout: 3000,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path: endpoint.path,
          method: endpoint.method,
          description: endpoint.description,
          status: res.statusCode,
          success: res.statusCode < 400 || res.statusCode === 401, // 401是正常的未授权响应
          redirected: res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307,
          headers: res.headers,
          data: data.slice(0, 100) // 只保留前100个字符
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        path: endpoint.path,
        method: endpoint.method,
        description: endpoint.description,
        status: 0,
        success: false,
        error: error.code === 'ECONNREFUSED' ? '服务器未运行' : error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        path: endpoint.path,
        method: endpoint.method,
        description: endpoint.description,
        status: 0,
        success: false,
        error: '请求超时'
      });
    });

    if (endpoint.method === 'POST' && endpoint.body) {
      req.write(endpoint.body);
    }

    req.end();
  });
}

// 主测试函数
async function runTests() {
  const allEndpoints = [...apiEndpoints, ...postEndpoints];
  const results = [];

  // 测试所有端点
  for (const endpoint of allEndpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    if (result.error === '服务器未运行') {
      } else if (result.redirected) {
      `);
    } else if (result.success) {
      `);
    } else {
      `);
    }
  }

  // 统计结果
  );
  );
  
  const serverDown = results.every(r => r.error === '服务器未运行');
  
  if (serverDown) {
    } else {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success && r.error !== '服务器未运行').length;
    const redirected = results.filter(r => r.redirected).length;
    
    if (failed > 0) {
      results.filter(r => !r.success && r.error !== '服务器未运行').forEach(r => {
        console.info(`  ${r.endpoint}: ${r.error || `HTTP ${r.status}`}`);
      });
    }
  }
  
  return serverDown;
}

// 执行测试
runTests().then(serverDown => {
  if (serverDown) {
    console.info('\n服务器未运行，请先启动开发服务器');
    process.exit(1);
  } else {
    console.info('\n所有API测试完成');
    process.exit(0);
  }
});