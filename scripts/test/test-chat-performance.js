/**
 * 聊天API性能测试脚本
 * 测试优化后的使用量统计机制
 */

async function testChatPerformance() {
  const baseUrl = 'http://localhost:3007';
  const healthEndpoint = `${baseUrl}/api/health`;
  const chatEndpoint = `${baseUrl}/api/chat`;

  // 1. 基础健康检查
  try {
    const healthStart = Date.now();
    const healthResponse = await fetch(healthEndpoint);
    const healthTime = Date.now() - healthStart;
    
    if (healthResponse.ok) {
      `);
    } else {
      return;
    }
  } catch (error) {
    return;
  }

  // 2. 聊天API基础测试（无认证，预期401）
  const testPayload = {
    messages: [
      { role: 'user', content: '这是一个性能测试' }
    ],
    model: 'claude-3.5-haiku-20241022'
  };

  let totalTime = 0;
  const testCount = 10;
  let successCount = 0;
  
  for (let i = 1; i <= testCount; i++) {
    try {
      const start = Date.now();
      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });
      const responseTime = Date.now() - start;
      totalTime += responseTime;
      
      // 无认证预期返回401，但响应应该很快
      if (response.status === 401) {
        successCount++;
      } else {
        }
      
    } catch (error) {
      }
  }

  // 3. 性能统计
  const avgTime = totalTime / testCount;
  }ms`);
  * 100).toFixed(1)}%`);
  
  if (avgTime < 50) {
    ');
  } else if (avgTime < 100) {
    ');
  } else {
    ');
  }

  // 4. 并发测试
  ');
  const concurrentPromises = Array(5).fill().map(async (_, i) => {
    const start = Date.now();
    try {
      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });
      const time = Date.now() - start;
      return { index: i + 1, time, status: response.status };
    } catch (error) {
      return { index: i + 1, time: Date.now() - start, error: error.message };
    }
  });
  
  const concurrentResults = await Promise.all(concurrentPromises);
  
  concurrentResults.forEach(result => {
    if (result.error) {
      } else {
      }
  });

  const concurrentAvg = concurrentResults.reduce((sum, r) => sum + r.time, 0) / concurrentResults.length;
  }ms`);

  // 5. 最终检查健康状态
  try {
    const finalHealthResponse = await fetch(healthEndpoint);
    if (finalHealthResponse.ok) {
      const healthData = await finalHealthResponse.json();
      if (healthData.diagnostics?.statistics) {
        const stats = healthData.diagnostics.statistics;
        `);
      }
    } else {
      }
  } catch (error) {
    }

  }

// 运行测试
testChatPerformance().catch(console.error);