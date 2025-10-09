"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { LocalStorage, STORAGE_KEYS } from "@/lib/storage"
import * as dt from '@/lib/utils/date-toolkit'

interface StorageContextType {
  isStorageAvailable: boolean
  clearAllData: () => void
  exportData: () => string
  importData: (data: string) => boolean
}

const StorageContext = createContext<StorageContextType | undefined>(undefined)

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [isStorageAvailable, setIsStorageAvailable] = useState(false)

  useEffect(() => {
    setIsStorageAvailable(LocalStorage.isAvailable())
  }, [])

  const clearAllData = () => {
    if (confirm("确定要清空所有本地数据吗？此操作不可恢复。")) {
      LocalStorage.clear()
      window.location.reload()
    }
  }

  const exportData = () => {
    try {
      const data = {
        // 使用统一的 STORAGE_KEYS 导出所有数据
        conversations: LocalStorage.getItem(STORAGE_KEYS.CONVERSATIONS, []),
        currentConversationId: LocalStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, null),
        userSettings: LocalStorage.getItem(STORAGE_KEYS.USER_SETTINGS, {}),
        theme: LocalStorage.getItem(STORAGE_KEYS.THEME, null),
        documents: LocalStorage.getItem(STORAGE_KEYS.DOCUMENTS, []),
        recentModels: LocalStorage.getItem(STORAGE_KEYS.RECENT_MODELS, []),
        chatDrafts: LocalStorage.getItem(STORAGE_KEYS.CHAT_DRAFTS, {}),
        selectedModel: LocalStorage.getItem(STORAGE_KEYS.SELECTED_MODEL, null),
        exportTime: dt.toISO(),
        version: '1.0', // 添加版本号便于将来迁移
      }
      return JSON.stringify(data, null, 2)
    } catch (_error) {
      return ""
    }
  }

  const importData = (dataString: string) => {
    try {
      const data = JSON.parse(dataString)

      // 使用统一的 STORAGE_KEYS 导入所有数据
      if (data.conversations) {
        LocalStorage.setItem(STORAGE_KEYS.CONVERSATIONS, data.conversations)
      }
      if (data.currentConversationId) {
        LocalStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, data.currentConversationId)
      }
      if (data.userSettings) {
        LocalStorage.setItem(STORAGE_KEYS.USER_SETTINGS, data.userSettings)
      }
      if (data.theme) {
        LocalStorage.setItem(STORAGE_KEYS.THEME, data.theme)
      }
      if (data.documents) {
        LocalStorage.setItem(STORAGE_KEYS.DOCUMENTS, data.documents)
      }
      if (data.recentModels) {
        LocalStorage.setItem(STORAGE_KEYS.RECENT_MODELS, data.recentModels)
      }
      if (data.chatDrafts) {
        LocalStorage.setItem(STORAGE_KEYS.CHAT_DRAFTS, data.chatDrafts)
      }
      if (data.selectedModel) {
        LocalStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, data.selectedModel)
      }

      return true
    } catch (_error) {
      return false
    }
  }

  return (
    <StorageContext.Provider
      value={{
        isStorageAvailable,
        clearAllData,
        exportData,
        importData,
      }}
    >
      {children}
    </StorageContext.Provider>
  )
}

export function useStorage() {
  const context = useContext(StorageContext)
  if (context === undefined) {
    throw new Error("useStorage must be used within a StorageProvider")
  }
  return context
}
