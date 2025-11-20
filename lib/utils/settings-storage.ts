/**
 * 聊天设置持久化工具
 * 使用localStorage保存用户偏好设置
 */

import type { ChatSettings } from '@/types/chat'

const STORAGE_KEY = 'chatSettings'

// 默认设置
const DEFAULT_SETTINGS: Partial<ChatSettings> = {
  reasoning_effort: undefined,
  reasoning: { enabled: false }
}

/**
 * 加载保存的设置
 */
export function loadChatSettings(): Partial<ChatSettings> {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return DEFAULT_SETTINGS
    }

    const parsed = JSON.parse(stored)
    return {
      ...DEFAULT_SETTINGS,
      ...parsed
    }
  } catch (error) {
    console.error('[SettingsStorage] Failed to load settings:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * 保存设置
 */
export function saveChatSettings(settings: Partial<ChatSettings>): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    // 只保存需要持久化的字段
    const toSave = {
      reasoning_effort: settings.reasoning_effort,
      reasoning: settings.reasoning
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (error) {
    console.error('[SettingsStorage] Failed to save settings:', error)
  }
}

/**
 * 清除设置
 */
export function clearChatSettings(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('[SettingsStorage] Failed to clear settings:', error)
  }
}
