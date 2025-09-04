#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚨 紧急恢复受损文件...\n');

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
console.log('🔍 查找所有备份文件...\n');

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
  console.log(`找到 ${backupFiles.length} 个备份文件\n`);
  
  backupFiles.forEach(backupPath => {
    const originalPath = backupPath.replace('.backup', '');
    
    try {
      const backupContent = fs.readFileSync(backupPath, 'utf8');
      fs.writeFileSync(originalPath, backupContent);
      console.log(`✅ 恢复: ${path.relative(process.cwd(), originalPath)}`);
      restoredCount++;
      
      // 删除备份文件
      fs.unlinkSync(backupPath);
    } catch (error) {
      console.error(`❌ 恢复失败: ${path.relative(process.cwd(), originalPath)}`);
      console.error(`   错误: ${error.message}`);
      failedCount++;
    }
  });
} else {
  console.log('⚠️ 没有找到.backup文件\n');
  console.log('尝试手动修复关键文件...\n');
  
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
          console.log(`🔧 手动修复: ${file}`);
          restoredCount++;
        }
      } catch (error) {
        console.error(`❌ 无法修复: ${file}`);
        failedCount++;
      }
    }
  });
}

console.log('\n' + '='.repeat(50));
console.log('📊 恢复报告');
console.log('='.repeat(50));
console.log(`✅ 成功恢复/修复: ${restoredCount} 个文件`);
console.log(`❌ 失败: ${failedCount} 个文件`);

if (restoredCount > 0) {
  console.log('\n✅ 紧急恢复完成！');
  console.log('\n建议下一步：');
  console.log('1. 重启开发服务器: pnpm dev');
  console.log('2. 运行类型检查: pnpm tsc --noEmit');
  console.log('3. 测试核心功能是否正常');
} else {
  console.log('\n⚠️ 无法自动恢复文件');
  console.log('\n建议：');
  console.log('1. 从版本控制恢复（如果有）');
  console.log('2. 手动修复语法错误');
  console.log('3. 从最近的备份恢复整个项目');
}