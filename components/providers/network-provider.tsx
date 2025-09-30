/**
 * 简化的网络状态提供者
 * 只在真正需要时才显示网络状态
 */

"use client"

import { createContext, useContext, type ReactNode } from 'react'

// 最简单的网络状态
interface NetworkStatus {
  isOnline: boolean
}

const NetworkStatusContext = createContext<NetworkStatus>({ isOnline: true })

interface NetworkProviderProps {
  children: ReactNode
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  // 只依赖浏览器原生API，不做任何轮询
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

  return (
    <NetworkStatusContext.Provider value={{ isOnline }}>
      {children}
    </NetworkStatusContext.Provider>
  )
}

export function useNetworkContext() {
  return useContext(NetworkStatusContext)
}

// 删除所有花哨的指示器和弹窗