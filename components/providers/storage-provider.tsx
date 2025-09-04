"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { LocalStorage } from "@/lib/storage"

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
        conversations: LocalStorage.getItem("conversations", []),
        userSettings: LocalStorage.getItem("user_settings", {}),
        documents: LocalStorage.getItem("documents", []),
        exportTime: new Date().toISOString(),
      }
      return JSON.stringify(data, null, 2)
    } catch (error) {
      return ""
    }
  }

  const importData = (dataString: string) => {
    try {
      const data = JSON.parse(dataString)

      if (data.conversations) {
        LocalStorage.setItem("conversations", data.conversations)
      }
      if (data.userSettings) {
        LocalStorage.setItem("user_settings", data.userSettings)
      }
      if (data.documents) {
        LocalStorage.setItem("documents", data.documents)
      }

      return true
    } catch (error) {
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
