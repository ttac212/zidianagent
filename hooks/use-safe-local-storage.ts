import { useState, useEffect, useCallback } from 'react'

export function useSafeLocalStorage<T>(
  key: string, 
  defaultValue: T
): [T, (value: T) => void] {
  // 在服务端总是返回默认值
  const [value, setValue] = useState<T>(defaultValue)

  // 仅在客户端环境初始化localStorage读取
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // 确保在客户端环境
    if (typeof window === 'undefined') return
    
    try {
      const item = window.localStorage.getItem(key)
      if (item !== null) {
        const parsed = JSON.parse(item)
        setValue(parsed)
      }
    } catch (_error) {
      }
  }, [key])

  const setStoredValue = useCallback((newValue: T) => {
    setValue(prevValue => {
      // 如果值没有变化，直接返回原值，避免不必要的更新
      if (JSON.stringify(prevValue) === JSON.stringify(newValue)) {
        return prevValue
      }

      // 确保在客户端环境再写入localStorage
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, JSON.stringify(newValue))
        } catch (_error) {
          // 静默处理localStorage错误
        }
      }

      return newValue
    })
  }, [key])

  return [value, setStoredValue]
}