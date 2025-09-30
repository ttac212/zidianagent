/**
 * 验证修复的脚本
 * 检查关键文件中的localStorage键是否使用了统一前缀
 */

const fs = require('fs')
const path = require('path')

const filesToCheck = [
  'hooks/use-model-state.ts',
  'hooks/use-safe-local-storage.ts',
  'app/workspace/page.tsx',
  'lib/storage.ts'
]

console.log('🔍 检查localStorage键前缀统一性...\n')

let hasIssues = false

filesToCheck.forEach(file => {
  const filePath = path.join(process.cwd(), file)
  const content = fs.readFileSync(filePath, 'utf-8')

  console.log(`📄 检查文件: ${file}`)

  // lib/storage.ts是例外，因为它通过LocalStorage类自动添加前缀
  if (file === 'lib/storage.ts') {
    console.log('  ℹ️  storage.ts通过LocalStorage类自动添加前缀')
    console.log('')
    return
  }

  // 检查是否有无前缀的localStorage键
  const unprefixedKeys = [
    'lastSelectedModelId',
    'currentConversationId',
    'conversations',
    'user_settings'
  ]

  unprefixedKeys.forEach(key => {
    // 查找直接使用键名但没有zhidian_前缀的情况
    const directUsageRegex = new RegExp(`['"\`]${key}['"\`]`, 'g')
    const matches = content.match(directUsageRegex)

    if (matches) {
      // 检查是否有zhidian_前缀的版本
      const prefixedRegex = new RegExp(`['"\`]zhidian_${key}['"\`]`, 'g')
      const prefixedMatches = content.match(prefixedRegex)

      if (!prefixedMatches && matches.length > 0) {
        console.log(`  ❌ 发现无前缀的键: ${key}`)
        hasIssues = true
      } else if (prefixedMatches) {
        console.log(`  ✅ 使用统一前缀: zhidian_${key}`)
      }
    }
  })

  console.log('')
})

// 检查workspace是否连接了删除回调
console.log('🔍 检查workspace删除回调连接...\n')

const workspaceFile = path.join(process.cwd(), 'app/workspace/page.tsx')
const workspaceContent = fs.readFileSync(workspaceFile, 'utf-8')

if (workspaceContent.includes('onDeleteConversation={handleOpenDeleteConfirm}')) {
  console.log('  ✅ workspace已连接删除回调\n')
} else {
  console.log('  ❌ workspace未连接删除回调\n')
  hasIssues = true
}

// 检查自动创建对话逻辑是否已禁用
console.log('🔍 检查自动创建对话逻辑...\n')

if (workspaceContent.includes('// 【已禁用】此逻辑导致删除对话后自动创建')) {
  console.log('  ✅ 自动创建对话逻辑已禁用\n')
} else {
  console.log('  ❌ 自动创建对话逻辑仍然启用\n')
  hasIssues = true
}

// 检查SmartChatCenter的类型定义
console.log('🔍 检查SmartChatCenter类型定义...\n')

const chatCenterFile = path.join(process.cwd(), 'components/chat/smart-chat-center.tsx')
const chatCenterContent = fs.readFileSync(chatCenterFile, 'utf-8')

if (chatCenterContent.includes('onDeleteConversation?: (conversation: Conversation) => void')) {
  console.log('  ✅ SmartChatCenter类型定义正确\n')
} else if (chatCenterContent.includes('onDeleteConversation?: (id: string) => void')) {
  console.log('  ❌ SmartChatCenter类型定义需要更新\n')
  hasIssues = true
} else {
  console.log('  ⚠️  未找到onDeleteConversation类型定义\n')
}

console.log('=' .repeat(60))

if (hasIssues) {
  console.log('❌ 发现问题，需要修复')
  process.exit(1)
} else {
  console.log('✅ 所有检查通过！')
  process.exit(0)
}
