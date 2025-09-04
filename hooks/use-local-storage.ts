"use client"

import { useState } from "react"
import { LocalStorage } from "@/lib/storage"

export function useLocalStorage<T>(key: string, initialValue: T) {
  // 获取初始值
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue
    }
    return LocalStorage.getItem(key, initialValue)
  })

  // 返回包装后的版本，会持久化到localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // 允许value是一个函数，这样我们就有了与useState相同的API
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)

      if (typeof window !== "undefined") {
        LocalStorage.setItem(key, valueToStore)
      }
    } catch (error) {
      }
  }

  return [storedValue, setValue] as const
}
