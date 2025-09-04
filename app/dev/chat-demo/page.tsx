"use client"

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// 懒加载聊天组件
const SimpleChatBox = dynamic(() => import("@/components/chat/simple-chat-box").then(mod => ({ default: mod.SimpleChatBox })), {
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="space-y-4 w-full max-w-md">
        <div className="h-4 bg-muted animate-pulse rounded"></div>
        <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
        <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
      </div>
    </div>
  ),
  ssr: false // 聊天组件不需要SSR
})

export default function ChatDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">对话演示</h1>
        
        {/* 使用简化版对话组件 */}
        <div className="h-[600px] border rounded-lg">
          <Suspense fallback={
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          }>
            <SimpleChatBox />
          </Suspense>
        </div>
      </div>
    </div>
  )
}