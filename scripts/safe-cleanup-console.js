#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 要清理的文件模式
const FILE_PATTERNS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx'
];

// 排除的目录
const EXCLUDE_DIRS = [
  'node_modules/**',
  '.next/**',
  'backup/**',
  'dist/**',
  'build/**',
  '.git/**'
];

// 更安全的清理模式 - 只清理完整的console语句行
const SAFE_PATTERNS = [
  // 独立的console.log语句（整行）
  /^\s*console\.(log|warn|error|debug|info|trace)\([^)]*\);\s*$/gm,
  
  // 带有简单字符串的console语句
  /^\s*console\.(log|warn|error|debug|info|trace)\(['"`][^'"`]*['"`]\);\s*$/gm,
  
  // DEBUG注释行
  /^\s*\/\/\s*DEBUG:.*$/gm,
  
  // TODO test注释行
  /^\s*\/\/\s*TODO:.*test.*$/gm,
  
  // 临时调试代码注释
  /^\s*\/\/\s*TEMP:.*$/gm,
  /^\s*\/\/\s*FIXME:.*temp.*$/gm
];

let totalRemoved = 0;
let filesModified = 0;
const modifiedFiles = [];
const skippedFiles = [];

function cleanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let cleaned = content;
    let fileRemovals = 0;
    
    // 应用安全模式
    SAFE_PATTERNS.forEach(pattern => {
      const matches = cleaned.match(pattern);
      if (matches) {
        fileRemovals += matches.length;
        cleaned = cleaned.replace(pattern, '');
      }
    });
    
    // 清理多余的空行（超过2个连续空行减少到2个）
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // 只有当确实有改动且改动是安全的时才写入
    if (fileRemovals > 0 && cleaned !== content) {
      // 验证清理后的代码没有破坏结构
      const bracesBefore = (content.match(/[{}]/g) || []).length;
      const bracesAfter = (cleaned.match(/[{}]/g) || []).length;
      const parensBefore = (content.match(/[()]/g) || []).length;
      const parensAfter = (cleaned.match(/[()]/g) || []).length;
      
      // 如果括号数量不匹配，跳过这个文件
      if (bracesBefore !== bracesAfter || parensBefore !== parensAfter) {
        skippedFiles.push(filePath);
        return;
      }
      
      // 备份原文件
      const backupPath = filePath + '.backup';
      fs.writeFileSync(backupPath, content);
      
      // 写入清理后的内容
      fs.writeFileSync(filePath, cleaned);
      filesModified++;
      totalRemoved += fileRemovals;
      modifiedFiles.push({ file: filePath, removed: fileRemovals });
      }
  } catch (error) {
    }
}

// 恢复所有损坏的文件
function restoreAllFiles() {
  const allFiles = [];
  FILE_PATTERNS.forEach(pattern => {
    const files = glob.sync(pattern, { 
      ignore: EXCLUDE_DIRS,
      nodir: true
    });
    allFiles.push(...files);
  });
  
  // 恢复所有.backup文件
  allFiles.forEach(file => {
    const backupPath = file + '.backup';
    if (fs.existsSync(backupPath)) {
      const backupContent = fs.readFileSync(backupPath, 'utf8');
      fs.writeFileSync(file, backupContent);
      }
  });
}

// 主执行流程
// 先恢复可能被损坏的文件
restoreAllFiles();

// 查找所有文件
const allFiles = [];
FILE_PATTERNS.forEach(pattern => {
  const files = glob.sync(pattern, { 
    ignore: EXCLUDE_DIRS,
    nodir: true
  });
  allFiles.push(...files);
});

// 去重
const uniqueFiles = [...new Set(allFiles)];

// 处理每个文件
uniqueFiles.forEach(cleanFile);

// 输出报告
);
);
if (modifiedFiles.length > 0) {
  modifiedFiles
    .sort((a, b) => b.removed - a.removed)
    .slice(0, 10)
    .forEach((item, index) => {
      });
}

if (skippedFiles.length > 0) {
  skippedFiles.slice(0, 10).forEach(file => {
    });
}

// 保存报告
const report = {
  timestamp: new Date().toISOString(),
  totalRemoved,
  filesModified,
  skippedFiles: skippedFiles.length,
  totalFilesChecked: uniqueFiles.length,
  modifiedFiles: modifiedFiles.sort((a, b) => b.removed - a.removed)
};

fs.writeFileSync(
  'safe-cleanup-report.json',
  JSON.stringify(report, null, 2)
);

