import { test, expect } from '@playwright/test'

/**
 * E2E测试：页面刚加载时立刻发送消息
 * 验证会话被自动创建且消息落库
 */

test.describe('消息发送 - 无对话情况', () => {
  test.beforeEach(async ({ page }) => {
    // 访问workspace页面
    await page.goto('/workspace')

    // 等待页面加载完成
    await page.waitForLoadState('networkidle')
  })

  test('页面加载后立即发送消息，应该自动创建对话并持久化消息', async ({ page }) => {
    // 确认初始状态：没有选中的对话
    const conversationList = page.locator('[data-testid="conversation-list"]')
    await expect(conversationList).toBeVisible()

    // 找到输入框并输入消息
    const messageInput = page.locator('[data-testid="chat-input"]')
    await expect(messageInput).toBeVisible()
    await messageInput.fill('测试消息：页面刚加载时发送')

    // 发送消息
    await messageInput.press('Enter')

    // 验证：应该看到用户消息出现在聊天区域
    const chatMessages = page.locator('[data-testid="chat-messages"]')
    await expect(chatMessages.locator('text=测试消息：页面刚加载时发送')).toBeVisible()

    // 验证：对话列表中应该出现新对话
    await expect(conversationList.locator('.conversation-item')).toHaveCount(1)

    // 验证：等待AI回复开始
    await expect(chatMessages.locator('[data-role="assistant"]')).toBeVisible({ timeout: 10000 })

    // 刷新页面，验证消息已持久化
    await page.reload()
    await page.waitForLoadState('networkidle')

    // 验证：刷新后消息仍然存在
    await expect(chatMessages.locator('text=测试消息：页面刚加载时发送')).toBeVisible()
    await expect(conversationList.locator('.conversation-item')).toHaveCount(1)
  })

  test('在无对话状态下连续发送多条消息，应该使用同一个对话', async ({ page }) => {
    const messageInput = page.locator('[data-testid="chat-input"]')
    const chatMessages = page.locator('[data-testid="chat-messages"]')
    const conversationList = page.locator('[data-testid="conversation-list"]')

    // 发送第一条消息
    await messageInput.fill('第一条消息')
    await messageInput.press('Enter')

    // 等待第一条消息显示
    await expect(chatMessages.locator('text=第一条消息')).toBeVisible()

    // 等待AI回复结束（通过检查输入框是否重新可用）
    await expect(messageInput).not.toBeDisabled({ timeout: 15000 })

    // 发送第二条消息
    await messageInput.fill('第二条消息')
    await messageInput.press('Enter')

    // 验证：两条消息都在同一个对话中
    await expect(chatMessages.locator('text=第一条消息')).toBeVisible()
    await expect(chatMessages.locator('text=第二条消息')).toBeVisible()

    // 验证：只有一个对话存在
    await expect(conversationList.locator('.conversation-item')).toHaveCount(1)
  })

  test('创建对话失败时，应该显示错误并不发送消息', async ({ page }) => {
    // 模拟网络错误或API失败
    await page.route('/api/conversations', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: '服务器错误' })
      })
    })

    const messageInput = page.locator('[data-testid="chat-input"]')
    const chatMessages = page.locator('[data-testid="chat-messages"]')

    // 尝试发送消息
    await messageInput.fill('测试消息')
    await messageInput.press('Enter')

    // 验证：应该显示错误提示
    await expect(page.locator('text=创建对话失败')).toBeVisible({ timeout: 5000 })

    // 验证：消息不应该出现在聊天区域
    await expect(chatMessages.locator('text=测试消息')).not.toBeVisible()

    // 验证：输入框内容应该被清空（因为消息发送失败）
    // 注意：根据实际实现，这个行为可能需要调整
  })
})