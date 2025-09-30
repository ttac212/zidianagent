/**
 * 删除对话修复验证测试
 * 验证三个核心修复：
 * 1. 删除对话后不会自动创建新对话
 * 2. localStorage前缀统一，"清空数据"能完整清除
 * 3. 删除按钮在聊天头部可见且可用
 */

import { test, expect } from '@playwright/test'

test.describe('删除对话修复验证', () => {
  test.beforeEach(async ({ page }) => {
    // 登录并进入workspace
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'dev123456')
    await page.click('button[type="submit"]')

    // 等待跳转到workspace
    await page.waitForURL('/workspace')
    await page.waitForTimeout(1000)
  })

  test('删除最后一个对话后列表保持为空', async ({ page }) => {
    // 检查是否有对话，如果没有则创建一个
    const conversationItems = page.locator('[data-testid="conversation-item"]')
    const count = await conversationItems.count()

    if (count === 0) {
      // 创建新对话
      await page.click('button:has-text("新建对话")')
      await page.waitForTimeout(500)
    }

    // 获取所有对话并逐一删除
    let remainingConversations = await page.locator('[data-testid="conversation-item"]').count()

    while (remainingConversations > 0) {
      // 点击第一个对话的删除按钮
      await page.locator('[data-testid="conversation-item"]').first().hover()
      await page.locator('[title="删除对话"]').first().click()

      // 确认删除对话框
      await page.click('button:has-text("确认删除")')
      await page.waitForTimeout(500)

      remainingConversations = await page.locator('[data-testid="conversation-item"]').count()
    }

    // 验证：对话列表应该为空
    const finalCount = await page.locator('[data-testid="conversation-item"]').count()
    expect(finalCount).toBe(0)

    // 等待2秒，验证没有自动创建新对话
    await page.waitForTimeout(2000)
    const afterWaitCount = await page.locator('[data-testid="conversation-item"]').count()
    expect(afterWaitCount).toBe(0)
  })

  test('聊天头部的删除按钮可见且可用', async ({ page }) => {
    // 创建或选择一个对话
    const conversationItems = page.locator('[data-testid="conversation-item"]')
    const count = await conversationItems.count()

    if (count === 0) {
      await page.click('button:has-text("新建对话")')
      await page.waitForTimeout(500)
    } else {
      await conversationItems.first().click()
      await page.waitForTimeout(500)
    }

    // 验证聊天头部的删除按钮存在
    const deleteButton = page.locator('[title="删除对话"]')
    await expect(deleteButton).toBeVisible({ timeout: 5000 })

    // 悬停以显示删除按钮
    await page.locator('.group').first().hover()
    await page.waitForTimeout(300)

    // 点击删除按钮
    await deleteButton.click()

    // 验证确认对话框出现
    await expect(page.locator('text=删除对话')).toBeVisible()
    await expect(page.locator('text=此操作不可撤销')).toBeVisible()
  })

  test('清空数据功能完整清除所有localStorage', async ({ page }) => {
    // 创建一个对话并选择一个模型
    await page.click('button:has-text("新建对话")')
    await page.waitForTimeout(500)

    // 选择一个模型（如果模型选择器可见）
    const modelSelector = page.locator('[data-testid="model-selector"]')
    if (await modelSelector.isVisible()) {
      await modelSelector.click()
      await page.locator('[role="option"]').first().click()
      await page.waitForTimeout(300)
    }

    // 检查localStorage有数据
    const beforeClear = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('zhidian_'))
      return keys.length
    })
    expect(beforeClear).toBeGreaterThan(0)

    // 执行清空数据
    await page.goto('/settings')
    await page.click('button:has-text("清空数据")')
    await page.click('button:has-text("确定")')

    // 等待页面重新加载
    await page.waitForURL('/settings')
    await page.waitForTimeout(1000)

    // 验证所有带zhidian_前缀的键都被清除
    const afterClear = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('zhidian_'))
      return keys.length
    })
    expect(afterClear).toBe(0)

    // 回到workspace，验证没有对话和模型选择
    await page.goto('/workspace')
    await page.waitForTimeout(1000)

    const conversationCount = await page.locator('[data-testid="conversation-item"]').count()
    expect(conversationCount).toBe(0)
  })

  test('localStorage键名使用统一前缀', async ({ page }) => {
    // 创建对话并选择模型
    await page.click('button:has-text("新建对话")')
    await page.waitForTimeout(500)

    // 检查所有localStorage键都有zhidian_前缀
    const invalidKeys = await page.evaluate(() => {
      const allKeys = Object.keys(localStorage)
      // 查找不是以zhidian_开头的应用相关键
      const appRelatedKeys = [
        'lastSelectedModelId',
        'currentConversationId',
        'conversations',
        'user_settings'
      ]
      return allKeys.filter(k =>
        appRelatedKeys.some(appKey => k.includes(appKey)) &&
        !k.startsWith('zhidian_')
      )
    })

    // 验证：不应该有无前缀的应用键
    expect(invalidKeys).toHaveLength(0)

    // 验证：应该有带前缀的键
    const validKeys = await page.evaluate(() => {
      return Object.keys(localStorage).filter(k => k.startsWith('zhidian_'))
    })
    expect(validKeys.length).toBeGreaterThan(0)
  })
})
