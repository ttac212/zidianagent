const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 要清理的模式
const PATTERNS_TO_REMOVE = [
  /console\.(log|warn|error|debug|info|trace)\([^)]*\);?\s*\n?/g,
  /\/\/\s*DEBUG:.*\n/g,
  /\/\/\s*TODO:.*test.*\n/g,
  /\/\/\s*FIXME:.*temp.*\n/g
];

// 排除的目录
const EXCLUDE_DIRS = [
  'node_modules/**',
  '.next/**',
  'backup/**',
  'dist/**',
  'build/**',
  '.git/**',
  'scripts/cleanup-console-logs.js' // 排除自己
];

let totalRemoved = 0;
let filesModified = 0;
const modifiedFiles = [];

function cleanFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let fileRemovals = 0;
    
    PATTERNS_TO_REMOVE.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        fileRemovals += matches.length;
        content = content.replace(pattern, '');
      }
    });
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      filesModified++;
      totalRemoved += fileRemovals;
      modifiedFiles.push({ file: filePath, removed: fileRemovals });
      console.log(`✓ 清理 ${filePath}: 移除 ${fileRemovals} 个调试语句`);
    }
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}: ${error.message}`);
  }
}

console.log('🧹 开始清理console.log和调试代码...\n');

// 查找所有TypeScript和JavaScript文件
const patterns = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx'
];

let allFiles = [];
patterns.forEach(pattern => {
  const files = glob.sync(pattern, { 
    ignore: EXCLUDE_DIRS,
    nodir: true
  });
  allFiles = allFiles.concat(files);
});

// 去重
allFiles = [...new Set(allFiles)];

console.log(`📂 找到 ${allFiles.length} 个文件待检查\n`);

// 处理每个文件
allFiles.forEach(cleanFile);

// 输出统计
console.log('\n' + '='.repeat(50));
console.log('📊 清理统计报告:');
console.log('='.repeat(50));
console.log(`✅ 总共移除: ${totalRemoved} 个调试语句`);
console.log(`📝 修改文件: ${filesModified} 个`);
console.log(`📁 检查文件: ${allFiles.length} 个`);

if (modifiedFiles.length > 0) {
  console.log('\n🔝 修改最多的文件 TOP 10:');
  modifiedFiles
    .sort((a, b) => b.removed - a.removed)
    .slice(0, 10)
    .forEach((item, index) => {
      console.log(`${index + 1}. ${item.file}: ${item.removed} 个`);
    });
}

// 保存清理报告
const report = {
  timestamp: new Date().toISOString(),
  totalRemoved,
  filesModified,
  totalFilesChecked: allFiles.length,
  modifiedFiles: modifiedFiles.sort((a, b) => b.removed - a.removed)
};

fs.writeFileSync(
  'cleanup-report.json',
  JSON.stringify(report, null, 2)
);

console.log('\n📄 详细报告已保存到 cleanup-report.json');
console.log('✅ 清理完成！');