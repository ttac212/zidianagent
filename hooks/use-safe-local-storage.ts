import { useState, useEffect, useCallback } from 'react'
import { LocalStorage } from '@/lib/storage'

/**
 * 安全的 localStorage hook，使用统一的存储管理器
 * @deprecated 建议直接使用 LocalStorage.getItem/setItem 或者使用 STORAGE_KEYS 中定义的键
 */
export function useSafeLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  // 在服务端总是返回默认值
  const [value, setValue] = useState<T>(defaultValue)

  // 仅在客户端环境初始化localStorage读取
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // 使用统一的 LocalStorage 工具类读取
    const storedValue = LocalStorage.getItem(key, defaultValue)
    setValue(storedValue)
  }, [key, defaultValue])

  const setStoredValue = useCallback((newValue: T) => {
    setValue(prevValue => {
      // 如果值没有变化，直接返回原值，避免不必要的更新
      if (JSON.stringify(prevValue) === JSON.stringify(newValue)) {
        return prevValue
      }

      // 使用统一的 LocalStorage 工具类写入
      LocalStorage.setItem(key, newValue)

      return newValue
    })
  }, [key])

  return [value, setStoredValue]
}