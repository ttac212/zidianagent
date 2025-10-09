/**
 * 统一模型状态管理Hook
 * 解决模型选择与使用不一致的问题
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { ALLOWED_MODELS, DEFAULT_MODEL } from '@/lib/ai/models'
import * as dt from '@/lib/utils/date-toolkit'
import { LocalStorage, STORAGE_KEYS } from '@/lib/storage'

interface ModelState {
  selectedModel: string
  isInitialized: boolean
  lastSyncTime: number
}

interface UseModelStateReturn {
  selectedModel: string
  setSelectedModel: (modelId: string) => void
  getCurrentModel: () => string
  isInitialized: boolean
  validateModel: (modelId: string) => boolean
  syncWithStorage: () => void
}

const STORAGE_KEY = STORAGE_KEYS.SELECTED_MODEL

/**
 * 统一模型状态管理Hook
 * 确保UI选择的模型与实际使用的模型完全一致
 */
export function useModelState(initialModel?: string): UseModelStateReturn {
  const [state, setState] = useState<ModelState>({
    selectedModel: DEFAULT_MODEL,
    isInitialized: false,
    lastSyncTime: 0,
  })
  
  // 使用ref确保异步操作中获取到最新的模型值
  const currentModelRef = useRef<string>(DEFAULT_MODEL)
  
  // 验证模型是否在白名单中
  const validateModel = useCallback((modelId: string): boolean => {
    const allowedIds = ALLOWED_MODELS.map(m => m.id)
    return allowedIds.includes(modelId)
  }, [])
  
  // 从localStorage同步模型状态
  const syncWithStorage = useCallback(() => {
    // 确保在客户端环境
    if (!LocalStorage.isAvailable()) return

    try {
      const savedModel = LocalStorage.getItem<string>(STORAGE_KEY, '')
      if (savedModel && validateModel(savedModel)) {
        const newModel = savedModel
        setState(prev => ({
          ...prev,
          selectedModel: newModel,
          isInitialized: true,
          lastSyncTime: dt.timestamp()
        }))
        currentModelRef.current = newModel
        } else if (initialModel && validateModel(initialModel)) {
        const newModel = initialModel
        setState(prev => ({
          ...prev,
          selectedModel: newModel,
          isInitialized: true,
          lastSyncTime: dt.timestamp()
        }))
        currentModelRef.current = newModel
        LocalStorage.setItem(STORAGE_KEY, newModel)
        } else {
        // 使用默认模型
        const allowedIds = ALLOWED_MODELS.map(m => m.id)
        const defaultModel = allowedIds.length > 0 ? allowedIds[0] : DEFAULT_MODEL
        setState(prev => ({
          ...prev,
          selectedModel: defaultModel,
          isInitialized: true,
          lastSyncTime: dt.timestamp()
        }))
        currentModelRef.current = defaultModel
        LocalStorage.setItem(STORAGE_KEY, defaultModel)
        }
    } catch (_error) {
      // 降级到默认模型
      const allowedIds = ALLOWED_MODELS.map(m => m.id)
      const fallbackModel = allowedIds.length > 0 ? allowedIds[0] : DEFAULT_MODEL
      setState(prev => ({
        ...prev,
        selectedModel: fallbackModel,
        isInitialized: true,
        lastSyncTime: dt.timestamp()
      }))
      currentModelRef.current = fallbackModel
    }
  }, [initialModel, validateModel])
  
  // 设置选中的模型
  const setSelectedModel = useCallback((modelId: string) => {
    if (!validateModel(modelId)) {
      return
    }

    setState(prev => ({
      ...prev,
      selectedModel: modelId,
      lastSyncTime: dt.timestamp()
    }))
    currentModelRef.current = modelId

    // 持久化到localStorage
    LocalStorage.setItem(STORAGE_KEY, modelId)
  }, [validateModel])
  
  // 获取当前模型（确保返回最新值）
  const getCurrentModel = useCallback((): string => {
    const current = currentModelRef.current
    return current
  }, [])
  
  // 初始化时同步状态
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!state.isInitialized) {
      syncWithStorage()
    }
  }, [state.isInitialized, syncWithStorage])
  
  // 监听localStorage变化（跨标签页同步）
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newModel = e.newValue
        if (validateModel(newModel) && newModel !== currentModelRef.current) {
          setState(prev => ({
            ...prev,
            selectedModel: newModel,
            lastSyncTime: dt.timestamp()
          }))
          currentModelRef.current = newModel
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [validateModel])
  
  return {
    selectedModel: state.selectedModel,
    setSelectedModel,
    getCurrentModel,
    isInitialized: state.isInitialized,
    validateModel,
    syncWithStorage,
  }
}

/**
 * 模型一致性验证工具
 * 用于调试和验证模型选择的一致性
 */
export function useModelConsistencyCheck(componentName: string) {
  const checkConsistency = useCallback((
    uiModel: string,
    stateModel: string,
    requestModel: string
  ) => {
    const isConsistent = uiModel === stateModel && stateModel === requestModel
    
    if (!isConsistent) {
      // Model state inconsistency detected - should be logged to monitoring system
    }
    
    return isConsistent
  }, [componentName])
  
  return { checkConsistency }
}