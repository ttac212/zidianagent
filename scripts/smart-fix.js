#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 已知被损坏的文件和修复模式
const filesToFix = [
  {
    file: 'app/api/chat/route.ts',
    fixes: [
      // 修复第170行附近的错误
      { line: 170, pattern: /^\s*\)\s*$/m, replacement: '' },
      // 修复catch块
      { pattern: /} catch \(error\) {\s*}/g, replacement: '} catch (error) {\n      // 错误处理\n    }' }
    ]
  },
  {
    file: 'app/workspace/page.tsx', 
    fixes: [
      // 修复模板字符串
      { line: 181, pattern: /`\$\{([^}]+)\}([^`]*)`([^`])/g, replacement: '`${$1}$2`$3' },
      // 修复意外的引号
      { pattern: /}"\s*`\)/g, replacement: '}' },
      { pattern: /\)"\s*\)/g, replacement: ')' }
    ]
  },
  {
    file: 'components/chat/smart-chat-center-v2-fixed.tsx',
    fixes: [
      { pattern: /}\)\)\)\s*$/gm, replacement: '}))' },
      { pattern: /,\s*,/g, replacement: ',' }
    ]
  },
  {
    file: 'hooks/use-chat-actions-fixed.ts',
    fixes: [
      { pattern: /^\s*\)\s*$/gm, replacement: '' },
      { pattern: /}\s*:\s*$/gm, replacement: '}' }
    ]
  },
  {
    file: 'hooks/use-conversations.ts',
    fixes: [
      { pattern: /}\s*\?\./g, replacement: '}?.' },
      { pattern: /}\s*catch/g, replacement: '} catch' }
    ]
  }
];

let totalFixed = 0;
let totalFailed = 0;

// 修复函数
function fixFile(fileInfo) {
  const fullPath = path.join(process.cwd(), fileInfo.file);
  
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    let fixCount = 0;
    
    // 应用修复
    fileInfo.fixes.forEach(fix => {
      if (fix.line) {
        // 针对特定行的修复
        const lines = content.split('\n');
        if (lines[fix.line - 1] && fix.pattern.test(lines[fix.line - 1])) {
          lines[fix.line - 1] = lines[fix.line - 1].replace(fix.pattern, fix.replacement);
          content = lines.join('\n');
          fixCount++;
        }
      } else {
        // 全文修复
        const matches = content.match(fix.pattern);
        if (matches) {
          content = content.replace(fix.pattern, fix.replacement);
          fixCount += matches.length;
        }
      }
    });
    
    // 额外的通用修复
    // 1. 删除单独的右括号行
    content = content.replace(/^\s*\)\s*$/gm, '');
    
    // 2. 修复空的catch块
    content = content.replace(/catch\s*\(error\)\s*{\s*}/g, 'catch (error) {\n    // 错误处理\n  }');
    
    // 3. 删除多余的分号
    content = content.replace(/;{2,}/g, ';');
    
    // 4. 修复破损的模板字符串
    content = content.replace(/}`\)/g, '}');
    content = content.replace(/}"`\)/g, '}');
    
    if (content !== originalContent) {
      // 备份原文件
      fs.writeFileSync(fullPath + '.damaged', originalContent);
      
      // 写入修复后的内容
      fs.writeFileSync(fullPath, content);
      totalFixed++;
      return true;
    } else {
      return false;
    }
  } catch (error) {
    totalFailed++;
    return false;
  }
}

// 执行修复
filesToFix.forEach(fileInfo => {
  fixFile(fileInfo);
});

// 额外检查其他可能被损坏的文件
const additionalFiles = [
  'hooks/use-model-state.ts',
  'hooks/api/use-conversations-query.ts',
  'lib/ai/key-manager.ts',
  'lib/model-validator.ts'
];

additionalFiles.forEach(file => {
  fixFile({
    file,
    fixes: [
      { pattern: /^\s*\)\s*$/gm, replacement: '' },
      { pattern: /}`\)/g, replacement: '}' },
      { pattern: /}"`\)/g, replacement: '}' },
      { pattern: /catch\s*\(error\)\s*{\s*}/g, replacement: 'catch (error) {\n    // 错误处理\n  }' }
    ]
  });
});

);
);
