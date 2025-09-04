#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 修复被console.log清理脚本损坏的文件...\n');

// 需要修复的文件列表（根据TypeScript错误）
const filesToCheck = [
  'app/api/chat/route.ts',
  'app/workspace/page.tsx',
  'components/chat/smart-chat-center-v2-fixed.tsx',
  'hooks/api/use-conversations-query.ts',
  'hooks/use-chat-actions-fixed.ts',
  'hooks/use-conversations.ts',
  'hooks/use-model-state.ts',
  'lib/ai/key-manager.ts',
  'lib/model-validator.ts',
  'scripts/check-data.ts',
  'scripts/diagnose-usage-stats.ts',
  'scripts/fix-usage-tracking.ts',
  'scripts/import-local-folder.ts',
  'scripts/import-merchant-data.ts',
  'scripts/pre-test-check.ts',
  'scripts/quick-optimize.ts',
  'scripts/test-merchant-features.ts',
  'scripts/verify-import.ts',
  'tests/api-model-validation.test.ts',
  'tests/connection-monitoring/health-api.test.ts',
  'utils/performance-benchmark.ts'
];

// 使用git恢复这些文件
const { execSync } = require('child_process');

let restoredCount = 0;
let failedCount = 0;

filesToCheck.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  
  try {
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️ 文件不存在: ${file}`);
      return;
    }
    
    // 使用git恢复文件
    console.log(`🔄 恢复: ${file}`);
    execSync(`git checkout -- "${file}"`, { cwd: process.cwd() });
    restoredCount++;
    console.log(`✅ 已恢复: ${file}`);
  } catch (error) {
    // 如果git恢复失败，尝试从备份恢复
    console.log(`⚠️ Git恢复失败，尝试其他方法: ${file}`);
    
    // 读取文件内容
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // 检查是否有明显的损坏模式
    const patterns = [
      // 修复被截断的console.log语句
      { 
        pattern: /(\s+)}\)$/gm,
        replacement: '$1}' 
      },
      // 修复被截断的模板字符串
      { 
        pattern: /- startTime\)\.toFixed\(2\)}ms\)`\)/g,
        replacement: ''
      },
      // 修复其他常见错误
      {
        pattern: /\)\s*\n\s*\)/g,
        replacement: ')'
      }
    ];
    
    let fixed = content;
    patterns.forEach(({ pattern, replacement }) => {
      fixed = fixed.replace(pattern, replacement);
    });
    
    if (fixed !== content) {
      fs.writeFileSync(fullPath, fixed);
      console.log(`🔧 手动修复: ${file}`);
      restoredCount++;
    } else {
      console.error(`❌ 无法修复: ${file}`);
      failedCount++;
    }
  }
});

console.log('\n' + '='.repeat(50));
console.log('📊 修复报告');
console.log('='.repeat(50));
console.log(`✅ 成功恢复: ${restoredCount} 个文件`);
console.log(`❌ 失败: ${failedCount} 个文件`);

if (failedCount > 0) {
  console.log('\n⚠️ 部分文件无法自动修复，建议：');
  console.log('1. 使用 git status 查看所有修改的文件');
  console.log('2. 使用 git diff 查看具体修改内容');
  console.log('3. 使用 git checkout -- . 恢复所有文件到上次提交状态');
  console.log('4. 或从备份目录恢复原始文件');
}

console.log('\n下一步：');
console.log('1. 运行 pnpm tsc --noEmit 检查是否还有语法错误');
console.log('2. 运行 pnpm dev 测试应用是否正常运行');
console.log('3. 重新运行更安全的console.log清理脚本');