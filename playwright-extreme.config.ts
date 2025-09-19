import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright 极限压力测试配置
 * 专门为300并发压力测试优化
 */
export default defineConfig({
  testDir: './e2e',
  
  // 极限测试全局设置
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  
  // 完全并行运行，最大化并发
  fullyParallel: true,
  
  // 禁止 .only 防止意外限制测试范围
  forbidOnly: !!process.env.CI,
  
  // 极限测试不重试，快速失败
  retries: 0,
  
  // 极限并发配置
  workers: process.env.CONCURRENT_WORKERS ? Math.min(parseInt(process.env.CONCURRENT_WORKERS), 100) : 50,
  
  // 专用报告格式，减少I/O开销
  reporter: [
    ['list', { printSteps: false }], // 简化列表输出
    ['json', { outputFile: 'test-results/extreme-stress-results.json' }]
  ],
  
  // 极限测试专用配置
  use: {
    // 基础 URL
    baseURL: 'http://localhost:3007',
    
    // 禁用追踪和截图以提高性能
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    
    // 最小化超时时间
    actionTimeout: 8 * 1000,
    navigationTimeout: 15 * 1000,
    
    // 性能优化设置
    launchOptions: {
      args: [
        '--disable-dev-shm-usage',      // 减少共享内存使用
        '--disable-extensions',         // 禁用扩展
        '--disable-plugins',            // 禁用插件
        '--disable-images',             // 禁用图片加载
        '--disable-javascript',         // 某些测试可能不需要JS
        '--disable-web-security',       // 跨域访问
        '--no-sandbox',                 // 沙盒模式
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--memory-pressure-off',        // 关闭内存压力检测
        '--max_old_space_size=4096'     // 增加V8内存限制
      ],
      // 禁用GPU加速以减少资源占用
      ignoreDefaultArgs: ['--enable-automation']
    },
    
    // 额外的极限测试headers
    extraHTTPHeaders: {
      'X-E2E-Test': 'true',
      'X-Extreme-Stress': 'true',
      'Cache-Control': 'no-cache'
    }
  },

  // 只使用Chromium进行极限测试，减少资源消耗
  projects: [
    {
      name: 'extreme-chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // 极限测试专用浏览器配置
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-plugins', 
            '--disable-web-security',
            '--no-sandbox',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--memory-pressure-off',
            '--max_old_space_size=2048',
            '--js-flags="--max-old-space-size=2048"'
          ]
        }
      },
    },
  ],

  // 开发服务器配置 - 极限优化
  webServer: {
    command: 'cross-env PLAYWRIGHT_TEST=true E2E_TEST_MODE=true NODE_OPTIONS="--max-old-space-size=8192" pnpm dev:fast',
    url: 'http://localhost:3007',
    reuseExistingServer: true, // 重用现有服务器
    timeout: 180 * 1000, // 3分钟启动超时
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PLAYWRIGHT_TEST: 'true',
      E2E_TEST_MODE: 'true',
      NEXT_PUBLIC_DEV_LOGIN_CODE: 'dev-123456',
      // 极限测试环境变量
      NODE_ENV: 'test',
      DISABLE_RATE_LIMIT: 'true', // 如果可能，禁用速率限制
      EXTREME_STRESS_MODE: 'true'
    },
  },

  // 极限测试专用期望配置
  expect: {
    // 降低期望超时以快速失败
    timeout: 3000,
    // 截图比较容差
    threshold: 0.3,
    // 动画处理
    toHaveScreenshot: { threshold: 0.3, animations: 'disabled' },
    toMatchSnapshot: { threshold: 0.3 }
  },

  // 全局测试超时
  globalTimeout: 30 * 60 * 1000, // 30分钟全局超时

  // 文件并行限制（避免文件系统压力）
  maxFailures: process.env.CI ? 10 : 50,

  // 元数据
  metadata: {
    testType: 'extreme-stress',
    concurrentUsers: process.env.CONCURRENT_WORKERS || '300',
    optimizations: [
      'disabled-tracing',
      'disabled-screenshots', 
      'disabled-videos',
      'minimal-browser-args',
      'chromium-only',
      'reuse-server'
    ]
  }
})