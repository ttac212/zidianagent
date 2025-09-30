/**
 * 临时调试辅助脚本 - 帮助诊断历史消息显示问题
 * 使用方法：在浏览器控制台运行此代码
 */

(function() {
  console.log('🔍 开始调试历史消息显示问题...\n')

  // 1. 检查当前页面状态
  console.log('1️⃣ 检查页面状态:')

  // 检查是否在聊天页面
  const isChatPage = window.location.pathname.includes('chat') ||
                     window.location.pathname.includes('conversation') ||
                     document.querySelector('[data-message-id]')

  console.log(`   - 是否在聊天页面: ${isChatPage}`)

  // 2. 检查DOM中的消息元素
  console.log('\n2️⃣ 检查DOM中的消息:')
  const messageElements = document.querySelectorAll('[data-message-id]')
  console.log(`   - 找到的消息元素数量: ${messageElements.length}`)

  if (messageElements.length > 0) {
    messageElements.forEach((el, index) => {
      const messageId = el.getAttribute('data-message-id')
      const content = el.textContent?.slice(0, 50) + '...'
      console.log(`   - 消息 ${index + 1}: ID=${messageId}, 内容="${content}"`)
    })
  }

  // 3. 检查React DevTools中的组件状态（如果可用）
  console.log('\n3️⃣ 检查React组件状态:')

  // 尝试找到聊天组件的根元素
  const chatContainer = document.querySelector('[class*="chat"]') ||
                        document.querySelector('[class*="message"]') ||
                        document.querySelector('main')

  if (chatContainer && chatContainer._reactInternalFiber) {
    console.log('   - 找到React组件容器')
  } else if (chatContainer && chatContainer._reactInternals) {
    console.log('   - 找到React组件容器 (React 17+)')
  } else {
    console.log('   - ⚠️ 无法访问React组件状态，请使用React DevTools')
  }

  // 4. 检查控制台日志中的调试信息
  console.log('\n4️⃣ 查找相关的调试日志:')
  console.log('   - 请查看控制台中包含以下标识的日志:')
  console.log('     🔍 消息同步调试')
  console.log('     🔄 转换API消息')
  console.log('     🔄 转换API对话')
  console.log('     ✅ 转换后的消息')
  console.log('     ✅ 转换后的对话')

  // 5. 检查网络请求
  console.log('\n5️⃣ 检查网络请求:')
  console.log('   - 打开开发者工具的Network标签')
  console.log('   - 查找对 /api/conversations/ 的请求')
  console.log('   - 检查响应中的messages字段')

  // 6. 提供手动测试方法
  console.log('\n6️⃣ 手动测试方法:')
  console.log('   - 刷新页面并观察控制台日志')
  console.log('   - 切换不同的对话并观察消息加载')
  console.log('   - 发送新消息并检查是否正确显示')

  // 7. 创建一个测试函数
  window.debugChatMessages = function() {
    console.log('🧪 执行聊天消息调试测试...')

    // 检查全局状态
    if (window.React && window.React.version) {
      console.log(`   - React版本: ${window.React.version}`)
    }

    // 触发人工重新渲染（如果可能）
    const event = new Event('resize')
    window.dispatchEvent(event)

    console.log('   - 已触发重新渲染事件')
  }

  console.log('\n💡 提示: 运行 debugChatMessages() 执行额外的调试测试')
  console.log('\n📋 常见问题排查清单:')
  console.log('   ☐ 数据库中是否有消息数据？')
  console.log('   ☐ API是否正确返回消息？')
  console.log('   ☐ 数据转换是否正确？')
  console.log('   ☐ React组件状态是否正确更新？')
  console.log('   ☐ 是否存在JavaScript错误？')
  console.log('\n运行 scripts/debug-chat-messages.ts 检查数据库层面的问题')
})();