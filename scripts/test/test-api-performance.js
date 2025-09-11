/**
 * API性能测试脚本
 * 测试各个API端点的响应时间
 */

async function testAPIPerformance() {
  const baseUrl = 'http://localhost:3007'
  const endpoints = [
    {
      name: '健康检查',
      url: '/api/health',
      method: 'GET',
      expectedTime: 50
    },
    {
      name: '聊天API',
      url: '/api/chat',
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'test' }],
        model: 'claude-3.5-haiku-20241022'
      },
      expectedTime: 20,
      expectedStatus: 401 // 未认证
    },
    {
      name: '用户详情',
      url: '/api/users/test-user-id',
      method: 'GET',
      expectedTime: 100,
      expectedStatus: 401
    },
    {
      name: '模型统计',
      url: '/api/users/test-user-id/model-stats?days=30',
      method: 'GET',
      expectedTime: 200,
      expectedStatus: 401
    }
  ]

  const results = []

  for (const endpoint of endpoints) {
    const testResults = []
    const iterations = 5

    for (let i = 1; i <= iterations; i++) {
      try {
        const options = {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json'
          }
        }

        if (endpoint.body) {
          options.body = JSON.stringify(endpoint.body)
        }

        const start = Date.now()
        const response = await fetch(baseUrl + endpoint.url, options)
        const responseTime = Date.now() - start

        testResults.push({
          iteration: i,
          status: response.status,
          time: responseTime
        })

        } catch (error) {
        testResults.push({
          iteration: i,
          status: 0,
          time: -1,
          error: error.message
        })
      }
    }

    // 计算统计
    const validResults = testResults.filter(r => r.time > 0)
    const avgTime = validResults.length > 0
      ? validResults.reduce((sum, r) => sum + r.time, 0) / validResults.length
      : -1

    const minTime = validResults.length > 0
      ? Math.min(...validResults.map(r => r.time))
      : -1

    const maxTime = validResults.length > 0
      ? Math.max(...validResults.map(r => r.time))
      : -1

    const result = {
      endpoint: endpoint.name,
      url: endpoint.url,
      avgTime: Math.round(avgTime),
      minTime,
      maxTime,
      expectedTime: endpoint.expectedTime,
      passed: avgTime > 0 && avgTime <= endpoint.expectedTime,
      successRate: (validResults.length / iterations * 100).toFixed(1) + '%'
    }

    results.push(result)

    \n`)
  }

  // 总结报告
  console.table(results.map(r => ({
    'API端点': r.endpoint,
    '平均响应(ms)': r.avgTime,
    '期望(ms)': r.expectedTime,
    '成功率': r.successRate,
    '状态': r.passed ? '✅' : '❌'
  })))

  const passedCount = results.filter(r => r.passed).length
  const totalCount = results.length
  const passRate = (passedCount / totalCount * 100).toFixed(1)

  `)

  // 性能评级
  const avgResponseTime = results.reduce((sum, r) => sum + r.avgTime, 0) / results.length
  
  if (avgResponseTime < 50) {
    ')
  } else if (avgResponseTime < 100) {
    ')
  } else if (avgResponseTime < 200) {
    ')
  } else if (avgResponseTime < 500) {
    ')
  } else {
    ')
  }

  // 优化建议
  const slowAPIs = results.filter(r => !r.passed)
  if (slowAPIs.length > 0) {
    slowAPIs.forEach(api => {
      `)
    })
  }

  }

// 运行测试
testAPIPerformance().catch(console.error)