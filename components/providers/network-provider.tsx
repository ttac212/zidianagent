/**
 * 网络状态提供者
 * 全局管理应用的网络连接状态和服务器健康状态
 */

"use client"

import { createContext, useContext, type ReactNode } from 'react'
import { useNetworkStatus, type NetworkStatusContextType, type NetworkStatusOptions } from '@/hooks/use-network-status'

const NetworkStatusContext = createContext<NetworkStatusContextType | undefined>(undefined)

interface NetworkProviderProps {
  children: ReactNode
  options?: NetworkStatusOptions
}

export function NetworkProvider({ children, options }: NetworkProviderProps) {
  const networkStatus = useNetworkStatus(options)

  return (
    <NetworkStatusContext.Provider value={networkStatus}>
      {children}
    </NetworkStatusContext.Provider>
  )
}

/**
 * 获取网络状态的Hook
 */
export function useNetworkContext(): NetworkStatusContextType {
  const context = useContext(NetworkStatusContext)
  if (context === undefined) {
    throw new Error('useNetworkContext must be used within a NetworkProvider')
  }
  return context
}

/**
 * 网络状态指示器组件
 */
export function NetworkStatusIndicator() {
  const { networkStatus, connectivity } = useNetworkContext()

  if (connectivity === 'good') {
    return null // 网络正常时不显示指示器
  }

  const getStatusConfig = () => {
    switch (connectivity) {
      case 'offline':
        return {
          color: 'bg-red-500',
          text: networkStatus.isOnline ? '服务器离线' : '网络离线',
          icon: '🔴'
        }
      case 'poor':
        return {
          color: 'bg-yellow-500',
          text: `连接较慢 ${networkStatus.rtt ? `(${Math.round(networkStatus.rtt)}ms)` : ''}`,
          icon: '🟡'
        }
      default:
        return {
          color: 'bg-gray-500',
          text: '连接状态未知',
          icon: '⚪'
        }
    }
  }

  const { color, text, icon } = getStatusConfig()

  return (
    <div className={`fixed top-4 left-4 z-[45] px-3 py-2 rounded-full text-white text-sm font-medium ${color} shadow-lg flex items-center gap-2 transition-all duration-300`}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  )
}

/**
 * 网络重连提示组件
 */
export function NetworkRecoveryPrompt() {
  const { isConnected, checkNetworkStatus } = useNetworkContext()

  if (isConnected) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">🔌</span>
          </div>
          
          <h3 className="text-lg font-semibold mb-2">连接中断</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            无法连接到服务器，这可能是由于网络问题或服务器维护造成的。
          </p>
          
          <div className="flex gap-2">
            <button 
              onClick={checkNetworkStatus}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              重新连接
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              刷新页面
            </button>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            系统会自动尝试重新连接...
          </p>
        </div>
      </div>
    </div>
  )
}