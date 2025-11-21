// 本地存储工具类
export class LocalStorage {
  private static prefix = "zhidian_"

  // 检查是否在客户端环境
  private static isClient(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
  }

  static setItem<T>(key: string, value: T): void {
    if (!this.isClient()) return
    
    try {
      const serializedValue = JSON.stringify(value)
      window.localStorage.setItem(this.prefix + key, serializedValue)
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      }
  }

  static getItem<T>(key: string, defaultValue: T): T {
    if (!this.isClient()) return defaultValue
    
    try {
      const item = window.localStorage.getItem(this.prefix + key)
      if (item === null) return defaultValue
      return JSON.parse(item) as T
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      return defaultValue
    }
  }

  static removeItem(key: string): void {
    if (!this.isClient()) return
    
    try {
      window.localStorage.removeItem(this.prefix + key)
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      }
  }

  static clear(): void {
    if (!this.isClient()) return
    
    try {
      const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(this.prefix))
      keys.forEach((key) => window.localStorage.removeItem(key))
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      }
  }

  // 检查本地存储是否可用
  static isAvailable(): boolean {
    if (!this.isClient()) return false
    
    try {
      const testKey = "__test__"
      window.localStorage.setItem(testKey, "test")
      window.localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }
}

/**
 * 存储键名常量
 *
 * 数据结构说明：
 * - CONVERSATIONS: Conversation[] - 对话列表纯数组（用于离线快速加载，不含 pagination）
 * - CURRENT_CONVERSATION_ID: string - 当前选中的对话ID
 * - USER_SETTINGS: object - 用户偏好设置
 * - THEME: 'light' | 'dark' | 'system' - 主题设置
 * - DOCUMENTS: Document[] - 文档列表
 * - RECENT_MODELS: string[] - 最近使用的模型ID列表
 * - CHAT_DRAFTS: Record<conversationId, string> - 对话草稿映射
 * - SELECTED_MODEL: string - 最后选中的模型ID
 */
export const STORAGE_KEYS = {
  CONVERSATIONS: "conversations",
  CURRENT_CONVERSATION_ID: "current_conversation_id",
  USER_SETTINGS: "user_settings",
  THEME: "theme",
  DOCUMENTS: "documents",
  RECENT_MODELS: "recent_models",
  CHAT_DRAFTS: "chat_drafts",
  SELECTED_MODEL: "lastSelectedModelId",
} as const

// 导出导入函数用于数据迁移和备份
export function exportAllData(): Record<string, unknown> {
  if (!LocalStorage.isAvailable()) return {}

  const data: Record<string, unknown> = {}
  Object.values(STORAGE_KEYS).forEach(key => {
    try {
      const value = LocalStorage.getItem(key, null)
      if (value !== null) {
        data[key] = value
      }
    } catch {
      // 忽略单个key的错误
    }
  })
  return data
}

export function importAllData(data: Record<string, unknown>): void {
  if (!LocalStorage.isAvailable()) return

  Object.entries(data).forEach(([key, value]) => {
    try {
      LocalStorage.setItem(key, value)
    } catch {
      // 忽略单个key的错误
    }
  })
}

export function clearAllAppData(): void {
  LocalStorage.clear()
}
