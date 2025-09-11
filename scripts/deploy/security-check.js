#!/usr/bin/env node

/**
 * 环境变量安全检查脚本
 * 用于验证生产环境配置的安全性
 */

const fs = require('fs');
const path = require('path');

// 简单的dotenv解析器
function parseEnvFile(content) {
  const env = {};
  const lines = content.split('\n');
  
  lines.forEach(line => {
    // 跳过注释和空行
    if (line.trim().startsWith('#') || !line.trim()) return;
    
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // 移除引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      env[key] = value;
    }
  });
  
  return env;
}

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// 危险的环境变量（生产环境不应该存在）
const DANGEROUS_ENV_VARS = [
  'DEV_LOGIN_CODE',
  'NEXT_PUBLIC_DEV_LOGIN_CODE',
  'DEBUG',
  'DEV_MODE',
  'SKIP_AUTH',
  'BYPASS_SECURITY'
];

// 必需的环境变量（生产环境必须存在）
const REQUIRED_ENV_VARS = [
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'DATABASE_URL',
  'LLM_API_BASE'
];

// 敏感变量模式（不应该有默认值或弱值）
const SENSITIVE_PATTERNS = [
  { pattern: /NEXTAUTH_SECRET/, minLength: 32, message: 'NEXTAUTH_SECRET应至少32个字符' },
  { pattern: /_API_KEY/, minLength: 20, message: 'API密钥应至少20个字符' },
  { pattern: /SECRET/, minLength: 16, message: '密钥应至少16个字符' }
];

// 弱密码列表
const WEAK_VALUES = [
  'password', 'admin', '123456', 'secret', 'test', 'demo',
  'example', 'changeme', 'default', 'sample'
];

class SecurityChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  log(message, type = 'info') {
    const prefix = {
      error: `${colors.red}✗ 错误${colors.reset}`,
      warning: `${colors.yellow}⚠ 警告${colors.reset}`,
      success: `${colors.green}✓ 通过${colors.reset}`,
      info: `${colors.blue}ℹ 信息${colors.reset}`
    };
    }

  loadEnvironment() {
    const envFiles = ['.env', '.env.local', '.env.production'];
    const env = {};
    
    envFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseEnvFile(content);
        Object.assign(env, parsed);
        this.log(`已加载 ${file}`, 'info');
      }
    });

    // 合并实际环境变量
    Object.assign(env, process.env);
    return env;
  }

  checkDangerousVariables(env) {
    DANGEROUS_ENV_VARS.forEach(varName => {
      if (env[varName]) {
        this.errors.push(`发现危险的开发环境变量: ${varName}`);
        this.log(`发现危险的开发环境变量: ${varName}`, 'error');
      }
    });
  }

  checkRequiredVariables(env) {
    REQUIRED_ENV_VARS.forEach(varName => {
      if (!env[varName]) {
        this.errors.push(`缺少必需的环境变量: ${varName}`);
        this.log(`缺少必需的环境变量: ${varName}`, 'error');
      } else {
        this.passed.push(`必需变量已设置: ${varName}`);
      }
    });
  }

  checkSensitiveVariables(env) {
    Object.entries(env).forEach(([key, value]) => {
      // 检查长度
      SENSITIVE_PATTERNS.forEach(({ pattern, minLength, message }) => {
        if (pattern.test(key) && value && value.length < minLength) {
          this.warnings.push(`${key}: ${message}`);
          this.log(`${key}: ${message}`, 'warning');
        }
      });

      // 检查弱密码
      if (value && WEAK_VALUES.includes(value.toLowerCase())) {
        this.errors.push(`发现弱密码值: ${key}="${value}"`);
        this.log(`发现弱密码值: ${key}`, 'error');
      }

      // 检查硬编码的localhost
      if (key.includes('URL') && value && value.includes('localhost')) {
        this.warnings.push(`发现localhost URL: ${key}="${value}"`);
        this.log(`发现localhost URL: ${key}`, 'warning');
      }
    });
  }

  checkApiKeys(env) {
    const apiKeyPattern = /_API_KEY|_KEY|_TOKEN|_SECRET/;
    Object.entries(env).forEach(([key, value]) => {
      if (apiKeyPattern.test(key) && value) {
        // 检查是否是示例值
        if (value.startsWith('sk-') && value.length < 30) {
          this.warnings.push(`API密钥可能是示例值: ${key}`);
          this.log(`API密钥可能是示例值: ${key}`, 'warning');
        }
        
        // 检查是否包含空格或特殊字符
        if (value.includes(' ') || value.includes('\n')) {
          this.errors.push(`API密钥包含无效字符: ${key}`);
          this.log(`API密钥包含无效字符: ${key}`, 'error');
        }
      }
    });
  }

  generateReport() {
    );
    + '\n');

    if (this.errors.length > 0) {
      ${colors.reset}`);
      this.errors.forEach(err => );
      }

    if (this.warnings.length > 0) {
      ${colors.reset}`);
      this.warnings.forEach(warn => );
      }

    if (this.passed.length > 0) {
      ${colors.reset}`);
      this.passed.forEach(pass => );
      }

    const score = this.calculateScore();
    );
    }${score}/100${colors.reset}`);
    + '\n');

    return this.errors.length === 0;
  }

  calculateScore() {
    const baseScore = 100;
    const errorPenalty = this.errors.length * 15;
    const warningPenalty = this.warnings.length * 5;
    return Math.max(0, baseScore - errorPenalty - warningPenalty);
  }

  getScoreColor(score) {
    if (score >= 80) return colors.green;
    if (score >= 60) return colors.yellow;
    return colors.red;
  }

  run() {
    const isProduction = process.argv.includes('--production');
    
    const env = this.loadEnvironment();
    
    this.checkDangerousVariables(env);
    this.checkRequiredVariables(env);
    this.checkSensitiveVariables(env);
    this.checkApiKeys(env);

    const passed = this.generateReport();

    if (isProduction && !passed) {
      process.exit(1);
    }

    if (passed) {
      process.exit(0);
    } else {
      process.exit(isProduction ? 1 : 0);
    }
  }
}

// 运行检查
const checker = new SecurityChecker();
checker.run();