#!/usr/bin/env node

/**
 * 项目清理和优化脚本
 * 用于自动化执行项目优化任务
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const config = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  phase: process.argv[2] || 'all'
};

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  }

// 待删除的文件列表
const filesToDelete = [
  'app/api/health/route-original-backup.ts',
  'app/api/users/[id]/model-stats/optimized-route.example.ts',
  'docs/chat/CHAT_IMPLEMENTATION_BACKUP.md',
  'ts-errors.log',
  'scripts/fix-console-damage.js',
  'scripts/verify-phase1.js',
  'backup',
  'backups'
];

// 待移除的依赖
const unusedDependencies = [
  '@emotion/is-prop-valid',
  'three',
  'gsap',
  'tw-animate-css',
  '@testing-library/react-hooks',
  'dotenv',
  'dotenv-cli'
];

// 待整理的脚本
const scriptsToOrganize = {
  'scripts/test-*.js': 'scripts/test/',
  'scripts/db-*.js': 'scripts/db/',
  'scripts/backup-*.js': 'scripts/db/',
  'scripts/restore-*.js': 'scripts/db/',
  'scripts/deploy-*.js': 'scripts/deploy/',
  'scripts/security-*.js': 'scripts/deploy/',
  'scripts/import-*.ts': 'scripts/utils/',
  'scripts/verify-*.ts': 'scripts/utils/'
};

// Phase 1: 清理冗余文件
function cleanupRedundantFiles() {
  log('\n📦 Phase 1: 清理冗余文件', 'blue');
  
  let deletedCount = 0;
  let totalSize = 0;

  filesToDelete.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const size = stats.isDirectory() ? 
        getDirSize(filePath) : 
        stats.size;
      
      if (config.dryRun) {
        log(`  [DRY-RUN] 将删除: ${file} (${formatSize(size)})`, 'yellow');
      } else {
        if (stats.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
        log(`  ✅ 已删除: ${file} (${formatSize(size)})`, 'green');
        deletedCount++;
        totalSize += size;
      }
    } else {
      if (config.verbose) {
        log(`  ⏭️ 跳过: ${file} (文件不存在)`, 'yellow');
      }
    }
  });

  log(`\n  📊 删除统计: ${deletedCount} 个文件/目录, 释放空间: ${formatSize(totalSize)}`, 'green');
}

// Phase 2: 清理未使用的依赖
function cleanupUnusedDependencies() {
  log('\n📦 Phase 2: 清理未使用的依赖', 'blue');
  
  if (config.dryRun) {
    log('  [DRY-RUN] 将移除以下依赖:', 'yellow');
    unusedDependencies.forEach(dep => {
      log(`    - ${dep}`, 'yellow');
    });
  } else {
    try {
      const deps = unusedDependencies.join(' ');
      log('  正在移除依赖...', 'yellow');
      execSync(`pnpm remove ${deps}`, { stdio: 'inherit' });
      log('  ✅ 依赖清理完成', 'green');
    } catch (error) {
      log(`  ❌ 依赖清理失败: ${error.message}`, 'red');
    }
  }
}

// Phase 3: 整理目录结构
function organizeDirectories() {
  log('\n📦 Phase 3: 整理目录结构', 'blue');
  
  // 创建必要的目录
  const directories = [
    'scripts/dev',
    'scripts/test',
    'scripts/db',
    'scripts/deploy',
    'scripts/utils',
    'data/merchants/raw',
    'data/merchants/processed',
    'data/merchants/imports'
  ];

  directories.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      if (config.dryRun) {
        log(`  [DRY-RUN] 将创建目录: ${dir}`, 'yellow');
      } else {
        fs.mkdirSync(dirPath, { recursive: true });
        log(`  ✅ 已创建目录: ${dir}`, 'green');
      }
    }
  });

  // 移动商家数据文件
  const merchantDataDir = path.join(process.cwd(), '商家聚合数据');
  if (fs.existsSync(merchantDataDir)) {
    const targetDir = path.join(process.cwd(), 'data/merchants/raw');
    
    if (config.dryRun) {
      log(`  [DRY-RUN] 将移动商家数据到: data/merchants/raw`, 'yellow');
    } else {
      try {
        const files = fs.readdirSync(merchantDataDir);
        files.forEach(file => {
          const src = path.join(merchantDataDir, file);
          const dest = path.join(targetDir, file);
          fs.renameSync(src, dest);
        });
        fs.rmdirSync(merchantDataDir);
        log(`  ✅ 已移动 ${files.length} 个商家数据文件`, 'green');
      } catch (error) {
        log(`  ❌ 移动商家数据失败: ${error.message}`, 'red');
      }
    }
  }
}

// Phase 4: 代码质量检查
function checkCodeQuality() {
  log('\n📦 Phase 4: 代码质量检查', 'blue');
  
  // 查找console.log
  log('  🔍 检查console.log语句...', 'yellow');
  try {
    const result = execSync(
      'grep -r "console\\.(log|warn|error|debug)" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" app/ components/ hooks/ lib/ 2>/dev/null | wc -l',
      { encoding: 'utf8' }
    ).trim();
    
    if (parseInt(result) > 0) {
      log(`  ⚠️ 发现 ${result} 处console语句，建议使用专门的日志系统`, 'yellow');
    } else {
      log(`  ✅ 未发现console语句`, 'green');
    }
  } catch (error) {
    // grep可能在Windows上不可用
    if (config.verbose) {
      log(`  ⏭️ 跳过console检查 (grep不可用)`, 'yellow');
    }
  }

  // 查找TODO
  log('  🔍 检查TODO注释...', 'yellow');
  try {
    const result = execSync(
      'grep -r "TODO\\|FIXME\\|HACK" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" app/ components/ hooks/ lib/ 2>/dev/null | wc -l',
      { encoding: 'utf8' }
    ).trim();
    
    if (parseInt(result) > 0) {
      log(`  ⚠️ 发现 ${result} 处TODO/FIXME/HACK注释`, 'yellow');
    } else {
      log(`  ✅ 未发现TODO注释`, 'green');
    }
  } catch (error) {
    if (config.verbose) {
      log(`  ⏭️ 跳过TODO检查 (grep不可用)`, 'yellow');
    }
  }
}

// 获取目录大小
function getDirSize(dirPath) {
  let size = 0;
  
  try {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        size += getDirSize(filePath);
      } else {
        size += stats.size;
      }
    });
  } catch (error) {
    // 忽略错误
  }
  
  return size;
}

// 格式化文件大小
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// 生成报告
function generateReport() {
  log('\n📊 优化报告', 'blue');
  
  // 检查package.json大小
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
  );
  
  const depCount = Object.keys(packageJson.dependencies || {}).length;
  const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
  
  log(`  📦 依赖包: ${depCount} 个生产依赖, ${devDepCount} 个开发依赖`, 'green');
  
  // 统计文件数量
  const countFiles = (dir, ext) => {
    try {
      const result = execSync(
        `find ${dir} -name "*.${ext}" 2>/dev/null | wc -l`,
        { encoding: 'utf8' }
      ).trim();
      return parseInt(result);
    } catch {
      return 0;
    }
  };
  
  log(`  📄 TypeScript文件: ${countFiles('.', 'ts') + countFiles('.', 'tsx')} 个`, 'green');
  log(`  📄 JavaScript文件: ${countFiles('.', 'js') + countFiles('.', 'jsx')} 个`, 'green');
  log(`  📄 测试文件: ${countFiles('tests', 'test.ts')} 个`, 'green');
}

// 主函数
function main() {
  log('===========================================', 'blue');
  log('         项目清理和优化工具 v1.0          ', 'blue');
  log('===========================================', 'blue');
  
  if (config.dryRun) {
    log('\n🔍 DRY-RUN 模式：仅显示将执行的操作，不实际执行', 'yellow');
  }
  
  const phases = {
    '1': cleanupRedundantFiles,
    '2': cleanupUnusedDependencies,
    '3': organizeDirectories,
    '4': checkCodeQuality,
    'all': () => {
      cleanupRedundantFiles();
      cleanupUnusedDependencies();
      organizeDirectories();
      checkCodeQuality();
    }
  };
  
  const phase = phases[config.phase];
  
  if (phase) {
    phase();
  } else {
    log(`\n❌ 无效的阶段: ${config.phase}`, 'red');
    log('\n可用选项:', 'yellow');
    log('  node cleanup-optimize.js 1      # 清理冗余文件', 'yellow');
    log('  node cleanup-optimize.js 2      # 清理未使用依赖', 'yellow');
    log('  node cleanup-optimize.js 3      # 整理目录结构', 'yellow');
    log('  node cleanup-optimize.js 4      # 代码质量检查', 'yellow');
    log('  node cleanup-optimize.js all    # 执行所有优化', 'yellow');
    log('\n选项:', 'yellow');
    log('  --dry-run    # 仅显示将执行的操作', 'yellow');
    log('  --verbose    # 显示详细信息', 'yellow');
    process.exit(1);
  }
  
  generateReport();
  
  log('\n✨ 优化完成！', 'green');
  
  if (config.dryRun) {
    log('\n💡 提示: 移除 --dry-run 参数以实际执行优化', 'yellow');
  }
}

// 运行
main();