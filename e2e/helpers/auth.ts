import { Page } from '@playwright/test'

/**
 * 处理测试用户登录
 * 使用邀请码登录流程
 */
export async function loginAsTestUser(page: Page) {
  // 访问登录页面
  await page.goto('/login')
  
  // 等待页面加载
  await page.waitForLoadState('networkidle')
  
  // 使用邀请码登录（根据页面实际情况调整选择器）
  const inviteCodeInput = page.locator('input[type="text"], input[placeholder*="邀请码"]').first()
  
  if (await inviteCodeInput.isVisible()) {
    // 使用测试邀请码（这个可能需要从环境变量或测试数据中获取）
    await inviteCodeInput.fill('TEST-INVITE-CODE')
    
    // 点击登录按钮
    const loginButton = page.locator('button:has-text("登录"), button:has-text("Login"), button:has-text("使用邀请码登录")').first()
    await loginButton.click()
    
    // 等待登录完成并重定向
    await page.waitForURL('/workspace', { timeout: 10000 })
  } else {
    // 如果找不到邀请码输入框，尝试其他登录方式
    throw new Error('无法找到登录表单')
  }
}

/**
 * 检查是否已登录
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // 尝试访问受保护的页面
  const response = await page.goto('/workspace', { waitUntil: 'domcontentloaded' })
  
  // 如果被重定向到登录页，说明未登录
  return !page.url().includes('/login')
}

/**
 * 确保用户已登录
 */
export async function ensureAuthenticated(page: Page) {
  if (!(await isAuthenticated(page))) {
    await loginAsTestUser(page)
  }
}