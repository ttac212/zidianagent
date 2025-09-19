import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  // 全局设置
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  // 完全并行运行测试（支持高并发）
  fullyParallel: true,
  // CI 环境中禁止 .only
  forbidOnly: !!process.env.CI,
  // 减少重试次数以提高测试速度
  retries: process.env.CI ? 1 : 0,
  // 动态并发数配置，支持极限压力测试
  workers: process.env.CI ? 4 : process.env.CONCURRENT_WORKERS ? Math.min(parseInt(process.env.CONCURRENT_WORKERS), 100) : 8,
  // 增强报告格式，包含性能指标
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // 全局测试配置
  use: {
    // 基础 URL
    baseURL: 'http://localhost:3007',
    
    // 失败时记录追踪
    trace: 'on-first-retry',
    
    // 失败时截图
    screenshot: 'only-on-failure',
    
    // 视频录制（可选）
    video: 'retain-on-failure',
    
    // 默认超时时间
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
  },

  // 测试项目配置 - 性能测试时只使用 Chromium 减少资源消耗
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // 性能测试暂时禁用其他浏览器以减少并发压力
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // 开发服务器配置
  webServer: {
    command: 'cross-env PLAYWRIGHT_TEST=true pnpm dev:fast',
    url: 'http://localhost:3007',
    reuseExistingServer: true, // 使用现有服务器
    timeout: 120 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PLAYWRIGHT_TEST: 'true',
      NEXT_PUBLIC_DEV_LOGIN_CODE: 'dev-123456',
    },
  },
})