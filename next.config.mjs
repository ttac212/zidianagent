/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true }, // 暂时忽略构建时ESLint警告，代码清理阶段
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
  // 优化开发缓存配置
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
