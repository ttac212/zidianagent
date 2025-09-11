#!/usr/bin/env node

/**
 * 自动移除开发配置脚本
 * 用于清理生产环境中的开发配置
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, type = 'info') {
  const symbols = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`
  };
  }

// 需要从环境文件中移除的配置
const DEV_CONFIGS_TO_REMOVE = [
  'DEV_LOGIN_CODE',
  'NEXT_PUBLIC_DEV_LOGIN_CODE',
  'DEBUG',
  'DEV_MODE',
  'SKIP_AUTH',
  'BYPASS_SECURITY'
];

// 处理环境文件
function cleanEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    log(`文件不存在: ${filePath}`, 'warning');
    return;
  }

  log(`正在处理: ${filePath}`, 'info');
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const cleanedLines = [];
  let removedCount = 0;

  lines.forEach(line => {
    const trimmedLine = line.trim();
    let shouldRemove = false;

    // 检查是否包含需要移除的配置
    for (const config of DEV_CONFIGS_TO_REMOVE) {
      if (trimmedLine.startsWith(config + '=') || trimmedLine.startsWith(config + ' =')) {
        shouldRemove = true;
        removedCount++;
        log(`  移除: ${config}`, 'warning');
        break;
      }
    }

    if (!shouldRemove) {
      cleanedLines.push(line);
    }
  });

  if (removedCount > 0) {
    // 备份原文件
    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    log(`  已备份到: ${backupPath}`, 'success');

    // 写入清理后的内容
    fs.writeFileSync(filePath, cleanedLines.join('\n'));
    log(`  已移除 ${removedCount} 个开发配置`, 'success');
  } else {
    log(`  没有需要移除的开发配置`, 'info');
  }
}

// 检查并更新next.config.mjs
function cleanNextConfig() {
  const configPath = path.join(process.cwd(), 'next.config.mjs');
  
  if (!fs.existsSync(configPath)) {
    log('next.config.mjs 不存在', 'error');
    return;
  }

  log('检查 next.config.mjs 配置...', 'info');
  
  let content = fs.readFileSync(configPath, 'utf-8');
  let modified = false;

  // 移除忽略构建错误的配置
  const patterns = [
    { 
      pattern: /eslint:\s*{\s*ignoreDuringBuilds:\s*true\s*}/g,
      replacement: 'eslint: { ignoreDuringBuilds: false }',
      message: '修复ESLint构建检查'
    },
    {
      pattern: /typescript:\s*{\s*ignoreBuildErrors:\s*true\s*}/g,
      replacement: 'typescript: { ignoreBuildErrors: false }',
      message: '修复TypeScript构建检查'
    }
  ];

  patterns.forEach(({ pattern, replacement, message }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
      log(`  ${message}`, 'success');
    }
  });

  if (modified) {
    // 备份原文件
    const backupPath = `${configPath}.backup.${Date.now()}`;
    fs.copyFileSync(configPath, backupPath);
    log(`  已备份到: ${backupPath}`, 'success');

    // 写入修改后的内容
    fs.writeFileSync(configPath, content);
    log('  next.config.mjs 已更新', 'success');
  } else {
    log('  next.config.mjs 无需修改', 'info');
  }
}

// 主函数
function main() {
  }${colors.reset}`);
  }${colors.reset}\n`);

  const isDryRun = process.argv.includes('--dry-run');
  const isForce = process.argv.includes('--force');

  if (isDryRun) {
    log('运行模式: 演练（不会实际修改文件）', 'info');
  }

  if (!isForce && !isDryRun) {
    process.exit(1);
  }

  // 处理所有环境文件
  const envFiles = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.development'
  ];

  envFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (!isDryRun) {
      cleanEnvFile(filePath);
    } else {
      if (fs.existsSync(filePath)) {
        log(`将处理: ${filePath}`, 'info');
      }
    }
  });

  // 清理 next.config.mjs
  if (!isDryRun) {
    cleanNextConfig();
  } else {
    log('将检查: next.config.mjs', 'info');
  }

  }${colors.reset}`);
  if (isDryRun) {
    } else {
    }
  }${colors.reset}\n`);
}

// 运行
main();