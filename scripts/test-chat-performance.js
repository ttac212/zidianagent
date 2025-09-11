/**
 * 聊天API性能测试脚本
 * 测试优化后的使用量统计机制
 */

async function testChatPerformance() {
  console.log('===========================================');
  console.log('       聊天API性能测试 v1.0              ');
  console.log('===========================================\n');

  const baseUrl = 'http://localhost:3007';
  const healthEndpoint = `${baseUrl}/api/health`;
  const chatEndpoint = `${baseUrl}/api/chat`;

  // 1. 基础健康检查
  console.log('📋 步骤1: 基础健康检查');
  console.log('-------------------------------------------');
  
  try {
    const healthStart = Date.now();
    const healthResponse = await fetch(healthEndpoint);
    const healthTime = Date.now() - healthStart;
    
    if (healthResponse.ok) {
      console.log(`✅ 健康检查正常 (${healthTime}ms)`);
    } else {
      console.log(`❌ 健康检查异常: ${healthResponse.status}`);
      return;
    }
  } catch (error) {
    console.log(`❌ 健康检查失败: ${error.message}`);
    return;
  }

  // 2. 聊天API基础测试（无认证，预期401）
  console.log('\n📊 步骤2: 聊天API响应时间测试');
  console.log('-------------------------------------------');
  
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
        console.log(`  请求${i}: 预期401响应 - ${responseTime}ms`);
        successCount++;
      } else {
        console.log(`  请求${i}: 非预期状态${response.status} - ${responseTime}ms`);
      }
      
    } catch (error) {
      console.log(`  请求${i}: 错误 - ${error.message}`);
    }
  }

  // 3. 性能统计
  console.log('\n📈 步骤3: 性能统计');
  console.log('-------------------------------------------');
  
  const avgTime = totalTime / testCount;
  console.log(`平均响应时间: ${avgTime.toFixed(2)}ms`);
  console.log(`成功率: ${((successCount / testCount) * 100).toFixed(1)}%`);
  
  if (avgTime < 50) {
    console.log('✅ 响应时间优秀 (<50ms)');
  } else if (avgTime < 100) {
    console.log('⚠️ 响应时间良好 (<100ms)');
  } else {
    console.log('❌ 响应时间需要优化 (>100ms)');
  }

  // 4. 并发测试
  console.log('\n🔄 步骤4: 并发响应测试 (5个并发)');
  console.log('-------------------------------------------');
  
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
      console.log(`  并发${result.index}: 错误 - ${result.time}ms`);
    } else {
      console.log(`  并发${result.index}: 状态${result.status} - ${result.time}ms`);
    }
  });

  const concurrentAvg = concurrentResults.reduce((sum, r) => sum + r.time, 0) / concurrentResults.length;
  console.log(`并发平均响应时间: ${concurrentAvg.toFixed(2)}ms`);

  // 5. 最终检查健康状态
  console.log('\n🔬 步骤5: 最终健康检查');
  console.log('-------------------------------------------');
  
  try {
    const finalHealthResponse = await fetch(healthEndpoint);
    if (finalHealthResponse.ok) {
      const healthData = await finalHealthResponse.json();
      console.log(`✅ 服务器状态: ${healthData.status}`);
      console.log(`内存使用: ${healthData.memoryUsage?.heapUsed || 'N/A'}MB`);
      console.log(`响应时间: ${healthData.responseTime || 'N/A'}ms`);
      
      if (healthData.diagnostics?.statistics) {
        const stats = healthData.diagnostics.statistics;
        console.log(`健康检查统计: ${stats.success}/${stats.total} (${stats.successRate}%)`);
      }
    } else {
      console.log(`❌ 最终健康检查异常: ${finalHealthResponse.status}`);
    }
  } catch (error) {
    console.log(`❌ 最终健康检查失败: ${error.message}`);
  }

  console.log('\n✨ 性能测试完成！');
}

// 运行测试
testChatPerformance().catch(console.error);