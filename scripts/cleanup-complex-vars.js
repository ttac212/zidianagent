#!/usr/bin/env node

/**
 * 第二批复杂未使用变量清理脚本
 * 处理需要手动判断的复杂情况
 */

const fs = require('fs');
const path = require('path');

// 复杂修复规则
const complexFixes = [
  // 清理未使用的变量（完全删除）
  {
    file: 'app/settings/enhanced-page.tsx',
    type: 'remove_unused_var',
    pattern: /const\s+status\s*=.*?;\s*\n/g,
    replacement: ''
  },
  {
    file: 'app/settings/page.tsx',
    type: 'remove_unused_var',
    pattern: /const\s+\[.*?usageError.*?\]\s*=.*?;\s*\n/g,
    replacement: ''
  },
  {
    file: 'components/chat/chat-input.tsx',
    type: 'remove_unused_var',
    pattern: /const\s+getModelName\s*=.*?;\s*\n/g,
    replacement: ''
  },
  {
    file: 'components/chat/smart-chat-center.tsx',
    type: 'remove_unused_var',
    pattern: /const\s+getCurrentModel\s*=.*?;\s*\n/g,
    replacement: ''
  },
  {
    file: 'components/chat/smart-chat-center.tsx',
    type: 'remove_multiple_vars',
    pattern: /const\s+{\s*scrollToBottom,\s*focusInput\s*}\s*=.*?;\s*\n/g,
    replacement: ''
  },
  {
    file: 'components/ui/retry-wrapper.tsx',
    type: 'remove_unused_var',
    pattern: /const\s+handleReset\s*=.*?;\s*\n/g,
    replacement: ''
  },
  {
    file: 'lib/error-handler.ts',
    type: 'remove_unused_var',
    pattern: /const\s+errorInfo\s*=.*?;\s*\n/g,
    replacement: ''
  },
  {
    file: 'lib/metrics.ts',
    type: 'remove_unused_var',
    pattern: /const\s+now\s*=.*?;\s*\n/g,
    replacement: ''
  },

  // 重命名参数为下划线前缀
  {
    file: 'components/chat/chat-input.tsx',
    type: 'rename_event_param',
    pattern: /onKeyDown=\{.*?\(e\)\s*=>/g,
    replacement: match => match.replace('(e)', '(_e)')
  },
  {
    file: 'components/chat/smart-chat-center.tsx',
    type: 'rename_unused_param',
    pattern: /onSelectConversation,/g,
    replacement: '_onSelectConversation,'
  },
  {
    file: 'components/workspace/conversation-search.tsx',
    type: 'rename_unused_params',
    pattern: /filters,\s*onFiltersChange/g,
    replacement: '_filters, _onFiltersChange'
  },

  // 清理未使用的导入
  {
    file: 'components/ui/connection-recovery.tsx',
    type: 'remove_import',
    pattern: /,\s*Wifi/g,
    replacement: ''
  },
  {
    file: 'components/ui/connection-status.tsx',
    type: 'remove_import',
    pattern: /,\s*Wifi/g,
    replacement: ''
  },
  {
    file: 'lib/security/invite-code-security.ts',
    type: 'remove_import',
    pattern: /import\s*{\s*prisma\s*}\s*from.*?\n/g,
    replacement: ''
  },
  {
    file: 'lib/security/message-validator.ts',
    type: 'remove_import',
    pattern: /,\s*MESSAGE_LIMITS/g,
    replacement: ''
  },

  // 修复console.log警告
  {
    file: 'lib/model-validator.ts',
    type: 'fix_console',
    pattern: /console\.log\(/g,
    replacement: 'console.info('
  }
];

console.log('🔧 开始第二批复杂未使用变量清理...\n');

let fixedFiles = 0;
let totalFixes = 0;

complexFixes.forEach((fix, index) => {
  try {
    const filePath = path.join(process.cwd(), fix.file);

    if (!fs.existsSync(filePath)) {
      console.log(`❌ 文件不存在: ${fix.file}`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // 应用修复
    if (typeof fix.pattern === 'function') {
      content = fix.pattern(content, fix.replacement);
    } else {
      content = content.replace(fix.pattern, fix.replacement);
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ [${index + 1}/${complexFixes.length}] 修复: ${fix.file}`);
      console.log(`   类型: ${fix.type}`);
      fixedFiles++;
      totalFixes++;
    } else {
      console.log(`⚠️  [${index + 1}/${complexFixes.length}] 无需修改: ${fix.file}`);
    }

  } catch (error) {
    console.error(`❌ 修复失败 ${fix.file}:`, error.message);
  }
});

console.log(`\n📊 第二批清理完成:`);
console.log(`   修复文件: ${fixedFiles}`);
console.log(`   总修复数: ${totalFixes}`);
console.log('\n🔍 建议运行 pnpm lint 验证剩余警告');