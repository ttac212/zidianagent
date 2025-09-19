#!/usr/bin/env node

/**
 * 测试聊天修复效果的快速脚本
 */

const fetch = require('node-fetch');

async function testChatFix() {
  console.log('🧪 测试聊天API修复效果...\n');
  
  try {
    // 测试1: 健康检查
    console.log('1️⃣ 测试健康检查');
    const healthRes = await fetch('http://localhost:3007/api/health');
    const healthData = await healthRes.json();
    console.log(`✅ 健康检查: ${healthData.status} (运行时间: ${healthData.uptime}s)\n`);
    
    // 测试2: 环境变量检查
    console.log('2️⃣ 测试环境变量加载');
    const envRes = await fetch('http://localhost:3007/api/debug/env');
    if (envRes.ok) {
      const envData = await envRes.json();
      console.log(`✅ API Key加载: ${envData.keySelection?.keySource || '未找到'}`);
      console.log(`✅ 模型配置: ${envData.environment.MODEL_ALLOWLIST}\n`);
    } else {
      console.log('⚠️ 环境变量检查API不存在（正常，已清理）\n');
    }
    
    // 测试3: 聊天API（需要认证，预期401）
    console.log('3️⃣ 测试聊天API（预期401认证错误）');
    const startTime = Date.now();
    const chatRes = await fetch('http://localhost:3007/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: '测试消息' }],
        model: 'claude-opus-4-1-20250805'
      })
    });
    const duration = Date.now() - startTime;
    
    console.log(`📊 响应状态: ${chatRes.status} ${chatRes.statusText}`);
    console.log(`⏱️ 响应时间: ${duration}ms`);
    
    if (chatRes.status === 401) {
      console.log('✅ 认证错误正常（说明API路由工作正常）');
    } else if (chatRes.status === 500) {
      const errorData = await chatRes.text();
      console.log('❌ 仍然存在500错误:');
      console.log(errorData);
    } else {
      console.log(`ℹ️ 意外状态码: ${chatRes.status}`);
    }
    
    console.log('\n🎯 测试完成！');
    
    if (duration < 5000 && chatRes.status !== 500) {
      console.log('🎉 修复成功！响应时间正常，无500错误');
    } else if (duration >= 5000) {
      console.log('⚠️ 响应时间仍然过长，可能需要进一步调试');
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }
}

testChatFix();