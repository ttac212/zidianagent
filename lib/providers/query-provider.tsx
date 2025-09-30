'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

/**
 * React Query 提供者组件
 * 为整个应用提供数据获取、缓存和状态管理能力
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // 使用 useState 确保 QueryClient 在组件生命周期内保持单例
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // 数据保持新鲜的时间 (1分钟) - 缩短时间确保数据更新及时
        staleTime: 1000 * 60,
        // 垃圾回收时间，缓存在内存中的时间 (5分钟)
        gcTime: 1000 * 60 * 5,
        // 重试次数（减少重试避免过多请求）
        retry: 1,
        // 窗口重新获得焦点时不自动重新获取数据
        refetchOnWindowFocus: false,
        // 网络重连时自动重新获取数据 - 修复为true确保网络恢复后获取最新数据
        refetchOnReconnect: true,
        // 挂载时如果数据过期则重新获取 - 修复为true确保显示最新数据
        refetchOnMount: true,
      },
      mutations: {
        // mutation 失败时重试1次
        retry: 1,
        // 重试延迟（指数退避）
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      }
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}