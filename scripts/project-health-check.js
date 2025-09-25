#!/usr/bin/env node

/**
 * 项目健康度检查脚本
 * 用于定期评估项目的技术债务和潜在风险
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// 健康检查结果
const healthReport = {
  timestamp: new Date().toISOString(),
  checks: {},
  score: 0,
  issues: [],
  suggestions: []
};

// 工具函数
function log(message, color = 'reset') {
  const colorCode = colors[color] ?? colors.reset ?? ''
  const resetCode = colors.reset ?? ''
  console.log(`${colorCode}${message}${resetCode}`)
}

function runCommand(command, silent = false) {
  try {
    const result = execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return result.trim();
  } catch (error) {
    return null;
  }
}

// 检查函数
async function checkSecurityIssues() {
  log('\n🔒 检查安全问题...', 'cyan');
  
  const issues = [];
  
  // 检查.env文件是否在git中
  const gitFiles = runCommand('git ls-files', true) || '';
  if (gitFiles.includes('.env')) {
    issues.push({
      severity: 'critical',
      message: '.env文件被跟踪在Git中！',
      fix: 'git rm --cached .env && echo ".env" >> .gitignore'
    });
  }
  
  // 检查硬编码的API密钥
  const suspiciousPatterns = [
    /sk-[a-zA-Z0-9]{48}/g,  // API密钥模式
    /password\s*[:=]\s*["'][^"']+["']/gi,  // 硬编码密码
    /token\s*[:=]\s*["'][^"']+["']/gi  // 硬编码token
  ];
  
  const jsFiles = findFiles('.', ['.js', '.ts', '.tsx'], ['node_modules', '.next', 'dist']);
  
  jsFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    suspiciousPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        issues.push({
          severity: 'high',
          message: `可能的敏感信息泄露: ${file}`,
          fix: '将敏感信息移至环境变量'
        });
      }
    });
  });
  
  healthReport.checks.security = {
    passed: issues.length === 0,
    issues: issues,
    score: issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 20)
  };
  
  return issues.length === 0;
}

async function checkCodeQuality() {
  log('\n📊 检查代码质量...', 'cyan');
  
  const issues = [];
  
  // 统计TODO/FIXME/HACK
  const todoCount = countPatternInFiles(/TODO|FIXME|HACK/gi);
  if (todoCount > 20) {
    issues.push({
      severity: 'medium',
      message: `发现 ${todoCount} 个待处理标记(TODO/FIXME/HACK)`,
      fix: '定期清理技术债务'
    });
  }
  
  // 检查大文件
  const largeFiles = findLargeFiles('.', 500);
  largeFiles.forEach(file => {
    issues.push({
      severity: 'low',
      message: `文件过大: ${file.path} (${file.lines}行)`,
      fix: '考虑拆分为更小的模块'
    });
  });
  
  // 检查循环依赖（简化版）
  const circularDeps = checkCircularDependencies();
  if (circularDeps.length > 0) {
    issues.push({
      severity: 'high',
      message: `发现循环依赖: ${circularDeps.join(', ')}`,
      fix: '重构代码结构，解除循环依赖'
    });
  }
  
  healthReport.checks.codeQuality = {
    passed: issues.length === 0,
    issues: issues,
    score: Math.max(0, 100 - issues.length * 10)
  };
  
  return issues.length === 0;
}

async function checkPerformance() {
  log('\n⚡ 检查性能指标...', 'cyan');
  
  const issues = [];
  
  // 检查包大小
  if (fs.existsSync('.next')) {
    const buildSize = getDirectorySize('.next');
    if (buildSize > 50 * 1024 * 1024) { // 50MB
      issues.push({
        severity: 'medium',
        message: `构建产物过大: ${(buildSize / 1024 / 1024).toFixed(2)}MB`,
        fix: '优化打包策略，实施代码分割'
      });
    }
  }
  
  // 检查未优化的图片
  const imageFiles = findFiles('./public', ['.jpg', '.jpeg', '.png'], []);
  const largeImages = imageFiles.filter(file => {
    const stats = fs.statSync(file);
    return stats.size > 500 * 1024; // 500KB
  });
  
  if (largeImages.length > 0) {
    issues.push({
      severity: 'low',
      message: `发现 ${largeImages.length} 个未优化的大图片`,
      fix: '使用图片压缩工具或Next.js Image组件'
    });
  }
  
  healthReport.checks.performance = {
    passed: issues.length === 0,
    issues: issues,
    score: Math.max(0, 100 - issues.length * 15)
  };
  
  return issues.length === 0;
}

async function checkDependencies() {
  log('\n📦 检查依赖项...', 'cyan');
  
  const issues = [];
  
  // 检查过时的依赖
  const outdated = runCommand('npm outdated --json', true);
  if (outdated) {
    try {
      const deps = JSON.parse(outdated);
      const majorUpdates = Object.keys(deps).filter(dep => {
        const current = deps[dep].current;
        const latest = deps[dep].latest;
        return current && latest && current.split('.')[0] !== latest.split('.')[0];
      });
      
      if (majorUpdates.length > 5) {
        issues.push({
          severity: 'medium',
          message: `${majorUpdates.length} 个依赖有主版本更新`,
          fix: '定期更新依赖，避免技术债务累积'
        });
      }
    } catch (e) {
      // JSON解析失败，忽略
    }
  }
  
  // 检查安全漏洞
  const audit = runCommand('npm audit --json', true);
  if (audit) {
    try {
      const auditData = JSON.parse(audit);
      if (auditData.metadata && auditData.metadata.vulnerabilities) {
        const vulns = auditData.metadata.vulnerabilities;
        if (vulns.critical > 0 || vulns.high > 0) {
          issues.push({
            severity: 'critical',
            message: `发现安全漏洞: ${vulns.critical}个严重, ${vulns.high}个高危`,
            fix: '运行 npm audit fix 修复漏洞'
          });
        }
      }
    } catch (e) {
      // JSON解析失败，忽略
    }
  }
  
  healthReport.checks.dependencies = {
    passed: issues.length === 0,
    issues: issues,
    score: issues.length === 0 ? 100 : Math.max(0, 100 - issues.filter(i => i.severity === 'critical').length * 50)
  };
  
  return issues.length === 0;
}

async function checkTesting() {
  log('\n🧪 检查测试覆盖...', 'cyan');
  
  const issues = [];
  
  // 检查测试文件数量
  const testFiles = findFiles('.', ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'], ['node_modules']);
  const srcFiles = findFiles('./app', ['.ts', '.tsx'], ['node_modules', '.test.', '.spec.']);
  
  const testRatio = testFiles.length / Math.max(srcFiles.length, 1);
  if (testRatio < 0.3) {
    issues.push({
      severity: 'high',
      message: `测试覆盖率低: ${(testRatio * 100).toFixed(1)}%的文件有测试`,
      fix: '增加单元测试和集成测试'
    });
  }
  
  healthReport.checks.testing = {
    passed: issues.length === 0,
    issues: issues,
    score: Math.min(100, testRatio * 100)
  };
  
  return issues.length === 0;
}

// 辅助函数
function findFiles(dir, extensions, exclude = []) {
  const files = [];
  
  function walk(currentDir) {
    if (exclude.some(ex => currentDir.includes(ex))) return;
    
    try {
      const items = fs.readdirSync(currentDir);
      items.forEach(item => {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (extensions.some(ext => fullPath.endsWith(ext))) {
          files.push(fullPath);
        }
      });
    } catch (e) {
      // 忽略无法访问的目录
    }
  }
  
  walk(dir);
  return files;
}

function countPatternInFiles(pattern) {
  let count = 0;
  const files = findFiles('.', ['.js', '.ts', '.tsx'], ['node_modules', '.next']);
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(pattern);
    if (matches) count += matches.length;
  });
  
  return count;
}

function findLargeFiles(dir, maxLines) {
  const largeFiles = [];
  const files = findFiles(dir, ['.js', '.ts', '.tsx'], ['node_modules', '.next']);
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n').length;
    if (lines > maxLines) {
      largeFiles.push({ path: file, lines });
    }
  });
  
  return largeFiles;
}

function checkCircularDependencies() {
  // 简化版循环依赖检查
  const deps = [];
  
  // 这里应该使用更复杂的AST分析
  // 暂时返回空数组
  return deps;
}

function getDirectorySize(dir) {
  let size = 0;
  
  function walk(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      items.forEach(item => {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          size += stat.size;
        }
      });
    } catch (e) {
      // 忽略
    }
  }
  
  walk(dir);
  return size;
}

// 生成报告
function generateReport() {
  log('\n📋 生成健康报告...', 'cyan');
  
  // 计算总分
  const checks = Object.values(healthReport.checks);
  const totalScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
  healthReport.score = Math.round(totalScore);
  
  // 收集所有问题
  healthReport.issues = checks.flatMap(check => check.issues || []);
  
  // 生成建议
  if (healthReport.score < 60) {
    healthReport.suggestions.push('项目健康度较低，建议立即处理严重问题');
  } else if (healthReport.score < 80) {
    healthReport.suggestions.push('项目健康度中等，建议制定改进计划');
  } else {
    healthReport.suggestions.push('项目健康度良好，继续保持');
  }
  
  // 显示报告
  );
  log(`   项目健康度报告 - ${new Date().toLocaleDateString()}`, 'bold');
  );
  
  // 显示总分
  const scoreColor = healthReport.score >= 80 ? 'green' : healthReport.score >= 60 ? 'yellow' : 'red';
  log(`\n总体健康度: ${healthReport.score}/100`, scoreColor);
  
  // 显示各项检查结果
  Object.entries(healthReport.checks).forEach(([name, result]) => {
    const status = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`  ${status} ${name}: ${result.score}/100`, color);
  });
  
  // 显示问题列表
  if (healthReport.issues.length > 0) {
    const criticalIssues = healthReport.issues.filter(i => i.severity === 'critical');
    const highIssues = healthReport.issues.filter(i => i.severity === 'high');
    const mediumIssues = healthReport.issues.filter(i => i.severity === 'medium');
    const lowIssues = healthReport.issues.filter(i => i.severity === 'low');
    
    if (criticalIssues.length > 0) {
      log('\n  🔴 严重问题:', 'red');
      criticalIssues.forEach(issue => {
        });
    }
    
    if (highIssues.length > 0) {
      log('\n  🟠 高优先级问题:', 'yellow');
      highIssues.forEach(issue => {
        });
    }
    
    if (mediumIssues.length > 0) {
      log('\n  🟡 中等优先级问题:', 'yellow');
      mediumIssues.forEach(issue => {
        });
    }
    
    if (lowIssues.length > 0) {
      log('\n  🟢 低优先级问题:', 'green');
      lowIssues.forEach(issue => {
        });
    }
  }
  
  // 显示建议
  healthReport.suggestions.forEach(suggestion => {
    });
  
  // 保存报告
  const reportPath = path.join('reports', `health-report-${Date.now()}.json`);
  if (!fs.existsSync('reports')) {
    fs.mkdirSync('reports');
  }
  fs.writeFileSync(reportPath, JSON.stringify(healthReport, null, 2));
  log(`\n报告已保存至: ${reportPath}`, 'green');
  
  );
  
  // 返回退出码
  return healthReport.score >= 60 ? 0 : 1;
}

// 主函数
async function main() {
  log('🏥 开始项目健康检查...', 'bold');
  
  try {
    await checkSecurityIssues();
    await checkCodeQuality();
    await checkPerformance();
    await checkDependencies();
    await checkTesting();
    
    const exitCode = generateReport();
    
    if (exitCode !== 0) {
      log('\n⚠️  项目存在需要关注的问题，请及时处理！', 'yellow');
    } else {
      log('\n✨ 项目健康状态良好！', 'green');
    }
    
    process.exit(exitCode);
  } catch (error) {
    log(`\n❌ 健康检查失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 运行检查
if (require.main === module) {
  main();
}

module.exports = { checkSecurityIssues, checkCodeQuality, checkPerformance };