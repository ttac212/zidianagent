/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true }, // 临时忽略少数非关键ESLint警告
  typescript: { ignoreBuildErrors: false },
  images: { unoptimized: true },
  
  // 生产环境自动清理console语句
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']  // 保留重要的错误和警告日志
    } : false,
  },
  
  // 允许在开发环境从指定来源（如同一局域网的设备）访问开发服务器
  // 参考: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: ["192.168.0.3"],
  
  // Turbopack 配置（当使用 --turbo 时生效）
  // Turbopack 自动优化，无需额外配置
  
  // Webpack 配置（仅在不使用 --turbo 时生效）
  // 注意：使用 Turbopack 时此配置会被忽略
  webpack: (config, { dev }) => {
    if (dev) {
      // 使用内存缓存而非完全禁用，提升开发体验
      config.cache = {
        type: 'memory'
      }
    }
    return config
  },
}

export default nextConfig
