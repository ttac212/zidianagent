#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要恢复的关键文件（基于TypeScript错误）
const filesToRestore = [
  'app/api/chat/route.ts',
  'app/workspace/page.tsx',
  'components/chat/smart-chat-center-v2-fixed.tsx',
  'hooks/use-chat-actions-fixed.ts',
  'hooks/use-conversations.ts',
  'hooks/use-model-state.ts',
  'hooks/api/use-conversations-query.ts',
  'lib/ai/key-manager.ts',
  'lib/model-validator.ts'
];

let restoredCount = 0;
let failedCount = 0;

// 查找所有.backup文件并恢复
function findBackupFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && !['node_modules', '.next', '.git'].includes(item.name)) {
      files.push(...findBackupFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.backup')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

const backupFiles = findBackupFiles(process.cwd());

if (backupFiles.length > 0) {
  backupFiles.forEach(backupPath => {
    const originalPath = backupPath.replace('.backup', '');
    
    try {
      const backupContent = fs.readFileSync(backupPath, 'utf8');
      fs.writeFileSync(originalPath, backupContent);
      , originalPath)}`);
      restoredCount++;
      
      // 删除备份文件
      fs.unlinkSync(backupPath);
    } catch (error) {
      , originalPath)}`);
      failedCount++;
    }
  });
} else {
  // 手动修复最关键的语法错误
  filesToRestore.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    
    if (fs.existsSync(fullPath)) {
      try {
        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = false;
        
        // 修复常见的语法错误模式
        const fixes = [
          // 修复被截断的字符串
          { pattern: /}"[`\)]+$/gm, replacement: '}' },
          { pattern: /\)"\s*\)/g, replacement: ')' },
          { pattern: /}`\)/g, replacement: '}' },
          // 修复缺失的大括号
          { pattern: /catch\s*\(error\)\s*{\s*}/g, replacement: 'catch (error) {\n        // 错误处理\n      }' },
          // 修复模板字符串
          { pattern: /`\$\{([^}]+)\}([^`]*)`([^`])/g, replacement: '`${$1}$2`$3' }
        ];
        
        fixes.forEach(({ pattern, replacement }) => {
          const newContent = content.replace(pattern, replacement);
          if (newContent !== content) {
            content = newContent;
            modified = true;
          }
        });
        
        if (modified) {
          fs.writeFileSync(fullPath, content);
          restoredCount++;
        }
      } catch (error) {
        failedCount++;
      }
    }
  });
}

);
);
if (restoredCount > 0) {
  } else {
  }