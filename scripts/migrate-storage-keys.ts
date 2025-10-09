#!/usr/bin/env tsx
/**
 * 迁移旧的 localStorage 键名到新的统一键名系统
 *
 * 旧键名 -> 新键名（通过 STORAGE_KEYS）
 * - lastSelectedModelId -> zhidian_lastSelectedModelId
 * - conversations -> zhidian_conversations
 * - current_conversation_id -> zhidian_current_conversation_id
 * - user_settings -> zhidian_user_settings
 * - 等等...
 */

import { STORAGE_KEYS } from '../lib/storage'

// 旧键名到新键名的映射
const MIGRATION_MAP: Record<string, string> = {
  // 旧的裸键名 -> STORAGE_KEYS 中的键名
  'lastSelectedModelId': STORAGE_KEYS.SELECTED_MODEL,
  'conversations': STORAGE_KEYS.CONVERSATIONS,
  'current_conversation_id': STORAGE_KEYS.CURRENT_CONVERSATION_ID,
  'user_settings': STORAGE_KEYS.USER_SETTINGS,
  'theme': STORAGE_KEYS.THEME,
  'documents': STORAGE_KEYS.DOCUMENTS,
  'recent_models': STORAGE_KEYS.RECENT_MODELS,
  'chat_drafts': STORAGE_KEYS.CHAT_DRAFTS,
}

interface MigrationResult {
  success: number
  failed: number
  skipped: number
  errors: string[]
}

function migrateStorageKeys(): MigrationResult {
  const result: MigrationResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  }

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    result.errors.push('❌ 无法访问 localStorage（非浏览器环境）')
    return result
  }

  console.log('🔄 开始迁移 localStorage 键名...\n')

  for (const [oldKey, newKey] of Object.entries(MIGRATION_MAP)) {
    try {
      const oldValue = localStorage.getItem(oldKey)
      const newValue = localStorage.getItem(`zhidian_${newKey}`)

      // 如果旧键存在，但新键不存在，则迁移
      if (oldValue !== null) {
        if (newValue === null) {
          localStorage.setItem(`zhidian_${newKey}`, oldValue)
          localStorage.removeItem(oldKey)
          console.log(`✅ ${oldKey} -> zhidian_${newKey}`)
          result.success++
        } else {
          console.log(`⏭️  ${oldKey} 已存在新键，跳过迁移`)
          result.skipped++
        }
      } else {
        console.log(`⏭️  ${oldKey} 不存在，跳过`)
        result.skipped++
      }
    } catch (error) {
      const errorMsg = `迁移 ${oldKey} 失败: ${error instanceof Error ? error.message : String(error)}`
      console.error(`❌ ${errorMsg}`)
      result.errors.push(errorMsg)
      result.failed++
    }
  }

  console.log('\n📊 迁移统计:')
  console.log(`   ✅ 成功: ${result.success}`)
  console.log(`   ⏭️  跳过: ${result.skipped}`)
  console.log(`   ❌ 失败: ${result.failed}`)

  if (result.errors.length > 0) {
    console.log('\n错误详情:')
    result.errors.forEach(err => console.log(`   - ${err}`))
  }

  return result
}

// 导出函数供浏览器环境使用
if (typeof window !== 'undefined') {
  (window as any).migrateStorageKeys = migrateStorageKeys
  console.log('💡 在浏览器控制台运行: migrateStorageKeys()')
}

export { migrateStorageKeys }
