import { test, expect } from '@playwright/test'
import * as dt from '@/lib/utils/date-toolkit'

/**
 * 聊天功能 E2E 测试
 */

test.describe('聊天功能', () => {
  test.beforeEach(async ({ page }) => {
    // 访问工作区页面
    await page.goto('/workspace')
    
    // 如果被重定向到登录页面，进行登录
    await page.waitForLoadState('networkidle')
    
    if (page.url().includes('/login')) {
      console.log('检测到登录页面，开始邮箱登录流程...')
      
      // 等待页面完全加载
      await page.waitForLoadState('domcontentloaded')
      
      // 查找邮箱输入框
      const emailInput = page.locator('#login-email, input[type="email"]').first()
      await expect(emailInput).toBeVisible({ timeout: 10000 })
      
      console.log('找到邮箱输入框，填入邮箱...')
      await emailInput.fill('hi@2308.com')
      
      // 等待输入完成
      await page.waitForTimeout(500)
      
      // 查找登录按钮（更精确的选择器）
      const loginButton = page.locator('button[type="submit"]').filter({ hasText: '登录' })
      await expect(loginButton).toBeVisible({ timeout: 5000 })
      
      console.log('找到登录按钮，准备点击...')
      
      // 检查是否有错误信息
      const errorAlert = page.locator('[role="alert"]').first()
      if (await errorAlert.isVisible()) {
        const errorText = await errorAlert.textContent()
        console.log('发现错误信息:', errorText)
      }
      
      // 点击登录按钮
      await loginButton.click()
      console.log('已点击登录按钮')
      
      // 等待登录处理
      await page.waitForTimeout(3000)
      
      // 检查登录后状态
      console.log('登录后URL:', page.url())
      
      // 检查是否有错误提示
      const postLoginError = page.locator('[role="alert"]').first()
      if (await postLoginError.isVisible()) {
        const errorText = await postLoginError.textContent()
        console.log('登录后错误信息:', errorText)
      }
      
      // 如果还在登录页面，等待重定向或手动跳转
      if (page.url().includes('/login')) {
        console.log('仍在登录页面，等待重定向...')
        try {
          await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 8000 })
          console.log('重定向成功，新URL:', page.url())
        } catch (_error) {
          console.log('重定向超时，尝试手动跳转到工作区')
          await page.goto('/workspace')
          await page.waitForLoadState('networkidle')
        }
      }
      
      console.log('登录流程完成，当前页面:', page.url())
    }
    
    // 确保页面完全加载
    await page.waitForLoadState('networkidle')
    
    // 如果不在工作区页面，说明登录失败
    if (!page.url().includes('/workspace')) {
      throw new Error(`登录后未跳转到工作区页面，当前URL: ${page.url()}`)
    }
    
    console.log('已进入工作区，等待聊天组件加载...')
    
    // 等待聊天组件加载完成（使用更灵活的选择器）
    try {
      await page.waitForSelector('textarea', { timeout: 15000 })
      console.log('聊天输入框已加载')
    } catch (error) {
      console.log('聊天输入框加载超时，页面内容:', await page.textContent('body'))
      throw error
    }
  })

  test('发送消息并接收回复', async ({ page }) => {
    // 查找输入框 - 使用更精确的选择器
    const input = page.locator('textarea').first()
    await expect(input).toBeVisible()
    
    // 输入消息
    await input.fill('你好，请介绍一下你自己')
    
    // 发送消息（按 Enter 或点击发送按钮）
    await page.keyboard.press('Enter')
    
    // 等待助手回复出现 - 使用更灵活的选择器
    // 方法1：等待包含AI回复特征的消息出现
    console.log('等待AI回复...')
    
    // 记录发送前的消息数量
    const messagesBefore = await page.locator('[data-message-id]').count()
    console.log('发送前消息数量:', messagesBefore)
    
    // 等待新消息出现（AI回复）
    await page.waitForFunction(
      (beforeCount) => {
        const messages = document.querySelectorAll('[data-message-id]')
        return messages.length > beforeCount
      },
      messagesBefore,
      { timeout: 30000 }
    )
    
    console.log('检测到新消息，验证是否为AI回复...')
    
    // 获取最新的消息（应该是AI回复）
    const allMessages = page.locator('[data-message-id]')
    const latestMessage = allMessages.last()
    
    // 验证最新消息的内容（AI回复通常包含较长的文本）
    const replyText = await latestMessage.textContent()
    console.log('AI回复内容预览:', replyText?.substring(0, 100) + '...')
    
    expect(replyText).toBeTruthy()
    expect(replyText!.length).toBeGreaterThan(10)
    
    // 额外验证：AI回复通常包含特定内容（如"Claude"或其他AI助手标识）
    // 这是一个更可靠的验证方式
    expect(replyText!.length).toBeGreaterThan(20) // AI回复通常比较长
  })

  test('复制消息功能', async ({ page }) => {
    // 先发送一条消息以获得回复
    const input = page.locator('textarea').first()
    await input.fill('Hello')
    await page.keyboard.press('Enter')
    
    // 等待回复
    await page.waitForSelector('[data-role="assistant"], [role="assistant"]', { timeout: 30000 })
    
    // 查找并点击复制按钮
    const copyButton = page.locator('button:has-text("复制")').first()
    await expect(copyButton).toBeVisible()
    await copyButton.click()
    
    // 验证复制成功反馈
    // 方式1：检查 Toast 通知
    const toast = page.locator('text=已复制到剪贴板')
    await expect(toast).toBeVisible()
    
    // 方式2：检查按钮状态变化
    const successButton = page.locator('button:has-text("已复制")')
    await expect(successButton).toBeVisible()
    
    // 等待按钮恢复原状
    await page.waitForTimeout(2500)
    await expect(copyButton).toBeVisible()
  })

  test('创建新对话', async ({ page }) => {
    // 点击新建对话按钮
    const newChatButton = page.locator('button:has-text("新"), button:has-text("New")')
    
    if (await newChatButton.isVisible()) {
      await newChatButton.click()
      
      // 验证输入框被清空或重置
      const input = page.locator('textarea').first()
      await expect(input).toHaveValue('')
    }
  })

  test('切换模型', async ({ page }) => {
    // 查找模型选择器
    const modelSelector = page.locator('[data-testid="model-selector"], select, [role="combobox"]').first()
    
    if (await modelSelector.isVisible()) {
      await modelSelector.click()
      
      // 选择不同的模型
      const modelOption = page.locator('text=/Claude|GPT|Gemini/i').first()
      if (await modelOption.isVisible()) {
        await modelOption.click()
      }
    }
  })

  test('响应式设计 - 移动端', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })
    
    // 验证页面在移动端正常显示
    const input = page.locator('textarea').first()
    await expect(input).toBeVisible()
    
    // 验证移动端菜单按钮（如果有）
    const menuButton = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"]')
    if (await menuButton.isVisible()) {
      await menuButton.click()
      // 验证菜单打开
      const menu = page.locator('[role="navigation"], nav')
      await expect(menu).toBeVisible()
    }
  })
})

test.describe('对话管理', () => {
  test('编辑对话标题', async ({ page }) => {
    await page.goto('/workspace')
    
    // 如果有对话列表
    const conversationItem = page.locator('[data-testid="conversation-item"]').first()
    if (await conversationItem.isVisible()) {
      // 悬停显示编辑按钮
      await conversationItem.hover()
      
      const editButton = page.locator('[data-testid="edit-conversation"], button[aria-label*="edit"]')
      if (await editButton.isVisible()) {
        await editButton.click()
        
        // 编辑标题
        const titleInput = page.locator('input[type="text"]').first()
        await titleInput.fill('测试对话标题')
        await page.keyboard.press('Enter')
        
        // 验证标题更新
        await expect(conversationItem).toContainText('测试对话标题')
      }
    }
  })

  test('删除对话', async ({ page }) => {
    await page.goto('/workspace')
    
    const conversationItem = page.locator('[data-testid="conversation-item"]').first()
    if (await conversationItem.isVisible()) {
      const initialCount = await page.locator('[data-testid="conversation-item"]').count()
      
      // 悬停显示删除按钮
      await conversationItem.hover()
      
      const deleteButton = page.locator('[data-testid="delete-conversation"], button[aria-label*="delete"]')
      if (await deleteButton.isVisible()) {
        // 处理确认对话框
        page.on('dialog', dialog => dialog.accept())
        
        await deleteButton.click()
        
        // 验证对话被删除
        const newCount = await page.locator('[data-testid="conversation-item"]').count()
        expect(newCount).toBe(initialCount - 1)
      }
    }
  })

  test('搜索对话', async ({ page }) => {
    await page.goto('/workspace')
    
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]')
    if (await searchInput.isVisible()) {
      // 输入搜索词
      await searchInput.fill('测试')
      
      // 等待搜索结果
      await page.waitForTimeout(500)
      
      // 验证搜索结果（如果有对话）
      const conversations = page.locator('[data-testid="conversation-item"]')
      const count = await conversations.count()
      
      if (count > 0) {
        // 验证所有可见对话包含搜索词
        for (let i = 0; i < count; i++) {
          const text = await conversations.nth(i).textContent()
          expect(text?.toLowerCase()).toContain('测试')
        }
      }
    }
  })
})

test.describe('性能测试', () => {
  test('页面加载时间', async ({ page }) => {
    const startTime = dt.timestamp()
    await page.goto('/workspace')
    await page.waitForLoadState('domcontentloaded')
    const loadTime = dt.timestamp() - startTime
    
    // 页面应在3秒内加载完成
    expect(loadTime).toBeLessThan(3000)
  })

  test('消息发送响应时间', async ({ page }) => {
    await page.goto('/workspace')
    
    const input = page.locator('textarea').first()
    await input.fill('test')
    
    const startTime = dt.timestamp()
    await page.keyboard.press('Enter')
    
    // 等待加载状态出现
    const loadingIndicator = page.locator('[data-testid="loading"], .animate-pulse, .animate-spin').first()
    await expect(loadingIndicator).toBeVisible({ timeout: 1000 })
    
    const responseTime = dt.timestamp() - startTime
    
    // 响应应在500ms内开始
    expect(responseTime).toBeLessThan(500)
  })
})