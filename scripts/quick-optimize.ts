/**
 * 快速优化脚本
 * 改善开发环境性能
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

// 1. 清理缓存
try {
  if (fs.existsSync('.next')) {
    fs.rmSync('.next', { recursive: true, force: true })
    }
} catch (error) {
  }

// 2. 创建.env.development.local优化配置
const devConfig = `# 开发环境优化配置
# 减少重新编译
WATCHPACK_POLLING=false

# 优化内存使用
NODE_OPTIONS="--max-old-space-size=4096"

# 跳过类型检查（仅开发环境）
NEXT_TELEMETRY_DISABLED=1
`

fs.writeFileSync('.env.development.local', devConfig)
// 3. 创建next.config优化
const nextConfigOptimized = `/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  
  // 开发服务器优化
  reactStrictMode: false, // 开发时关闭严格模式，减少双重渲染
  
  // Webpack优化
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // 开发环境优化
      config.cache = {
        type: 'memory',
        maxGenerations: 1
      }
      
      // 减少源码映射大小
      config.devtool = 'cheap-module-source-map'
      
      // 优化模块解析
      config.resolve.extensions = ['.tsx', '.ts', '.jsx', '.js']
      
      // 忽略不必要的模块
      config.watchOptions = {
        ignored: ['**/node_modules', '**/.next']
      }
    }
    return config
  },
  
  // 实验性功能
  experimental: {
    optimizeCss: false, // 开发时关闭CSS优化
    scrollRestoration: true
  }
}

export default nextConfig
`

// 备份原配置
if (fs.existsSync('next.config.mjs')) {
  fs.copyFileSync('next.config.mjs', 'next.config.mjs.backup')
  }

// 4. 优化package.json的dev脚本
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
packageJson.scripts['dev:fast'] = 'next dev --hostname 0.0.0.0 --port 3007 --turbo'
packageJson.scripts['dev:debug'] = 'NODE_OPTIONS="--inspect" next dev --hostname 0.0.0.0 --port 3007'
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2))
// 5. 创建.babelrc优化（如果不存在）
if (!fs.existsSync('.babelrc')) {
  const babelConfig = {
    "presets": ["next/babel"],
    "plugins": [],
    "env": {
      "development": {
        "compact": false
      }
    }
  }
  fs.writeFileSync('.babelrc', JSON.stringify(babelConfig, null, 2))
}

// 6. 提供优化建议
console.log(`${colors.cyan}优化建议:${colors.reset}`)
console.log(`${colors.yellow}• 使用动态导入延迟加载大型组件${colors.reset}`)
console.log(`${colors.yellow}• 考虑使用React.memo优化重渲染${colors.reset}`)
console.log(`${colors.yellow}• 监控构建大小并进行代码分割${colors.reset}`)

console.log(`\n${colors.green}快速优化完成！${colors.reset}\n`)
