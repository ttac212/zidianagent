/**
 * 健康检查API诊断脚本
 * 用于定位503错误的根本原因
 */

const fs = require('fs');
const path = require('path');

// 1. 检查环境变量配置
const envFiles = ['.env', '.env.local'];
const envConfigs = {};

envFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach(line => {
      if (line.includes('NEXT_PUBLIC_CONNECTION_MONITORING')) {
        const [key, value] = line.split('=');
        if (value) {
          envConfigs[file] = value.trim();
          }`);
        }
      }
      if (line.includes('NEXTAUTH_URL') || line.includes('NEXTAUTH_SECRET')) {
        const [key, value] = line.split('=');
        if (key && value) {
          } = ${value ? '已配置' : '未配置'}`);
        }
      }
    });
  } else {
    }
});

// 2. 分析503错误的可能原因
const reasons = [];

// 检查环境变量不一致
if (envConfigs['.env'] !== envConfigs['.env.local']) {
  reasons.push({
    severity: 'HIGH',
    issue: '环境变量配置不一致',
    detail: `.env 和 .env.local 中的 CONNECTION_MONITORING 值不同`,
    impact: '可能导致间歇性503错误'
  });
}

// 检查是否设置为disabled
Object.entries(envConfigs).forEach(([file, value]) => {
  if (value === 'disabled') {
    reasons.push({
      severity: 'CRITICAL',
      issue: `${file} 中连接监控被禁用`,
      detail: `NEXT_PUBLIC_CONNECTION_MONITORING=disabled 会返回503`,
      impact: '所有健康检查请求都会返回503'
    });
  }
});

// 3. 内存使用检查
const memoryUsage = process.memoryUsage();
const memoryInMB = {
  rss: Math.round(memoryUsage.rss / 1024 / 1024),
  heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
  heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
  external: Math.round(memoryUsage.external / 1024 / 1024)
};

if (memoryInMB.heapUsed > 2048) {
  reasons.push({
    severity: 'HIGH',
    issue: '内存使用超过阈值',
    detail: `当前堆内存使用 ${memoryInMB.heapUsed}MB > 2048MB`,
    impact: '健康检查会判定为不健康并返回503'
  });
}

// 4. 实际测试健康检查逻辑
// 模拟健康检查
function simulateHealthCheck() {
  const checks = [];
  let healthy = true;

  // 1. 进程检查
  const uptimeCheck = process.uptime() > 0;
  if (uptimeCheck) {
    checks.push('✓ Process uptime');
  } else {
    checks.push('✗ Process uptime');
    healthy = false;
  }

  // 2. 内存检查
  const memoryThreshold = 2 * 1024 * 1024 * 1024; // 2GB
  const memoryHealthy = memoryUsage.heapUsed < memoryThreshold;
  
  if (memoryHealthy) {
    checks.push(`✓ Memory usage (${memoryInMB.heapUsed}MB)`);
  } else {
    checks.push(`✗ Memory usage (${memoryInMB.heapUsed}MB > 2048MB)`);
    healthy = false;
  }

  // 3. Node.js环境
  const nodeVersion = process.version;
  if (nodeVersion) {
    checks.push(`✓ Node.js ${nodeVersion}`);
  }

  // 4. 环境变量检查
  const requiredEnvVars = ['NEXTAUTH_URL', 'NEXTAUTH_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length === 0) {
    checks.push('✓ Environment variables');
  } else {
    checks.push(`✗ Missing env vars: ${missingVars.join(', ')}`);
    healthy = false;
    
    reasons.push({
      severity: 'CRITICAL',
      issue: '缺少必需的环境变量',
      detail: `缺少: ${missingVars.join(', ')}`,
      impact: '健康检查失败，返回503'
    });
  }

  checks.forEach(check => );
  '}`);

  return healthy;
}

// 加载环境变量进行测试
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const isHealthy = simulateHealthCheck();

// 5. 诊断结果汇总
if (reasons.length === 0 && isHealthy) {
  } else {
  const criticalIssues = reasons.filter(r => r.severity === 'CRITICAL');
  const highIssues = reasons.filter(r => r.severity === 'HIGH');
  
  if (criticalIssues.length > 0) {
    criticalIssues.forEach((issue, i) => {
      });
  }
  
  if (highIssues.length > 0) {
    highIssues.forEach((issue, i) => {
      });
  }
}

// 6. 修复建议
const suggestions = [
  '1. 确保所有环境变量文件中 NEXT_PUBLIC_CONNECTION_MONITORING=enabled',
  '2. 确保 NEXTAUTH_URL 和 NEXTAUTH_SECRET 已正确配置',
  '3. 如果内存使用过高，考虑:',
  '   - 增加 Node.js 内存限制: NODE_OPTIONS="--max-old-space-size=4096"',
  '   - 优化代码减少内存占用',
  '   - 调整健康检查的内存阈值',
  '4. 添加更详细的日志记录到健康检查API',
  '5. 考虑实现健康检查结果缓存，避免频繁检查'
];

suggestions.forEach(suggestion => );

// 7. 快速修复脚本
