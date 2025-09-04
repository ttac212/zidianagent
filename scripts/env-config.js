/**
 * 环境变量配置管理工具
 * 用于连接监控功能的开关控制和配置验证
 */

const fs = require('fs');
const path = require('path');

class EnvConfig {
  constructor() {
    this.envFiles = [
      '.env.local',
      '.env.development',
      '.env.production',
      '.env'
    ];
    this.rootDir = path.join(__dirname, '..');
  }

  // 读取环境变量配置
  readEnvConfig() {
    const config = {};
    
    for (const envFile of this.envFiles) {
      const filePath = path.join(this.rootDir, envFile);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key) {
              config[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            }
          }
        });
        
        }
    }
    
    return config;
  }

  // 验证连接监控相关配置
  validateConnectionMonitoringConfig() {
    const config = this.readEnvConfig();
    const issues = [];
    const recommendations = [];

    // 检查必需的连接监控配置
    const connectionMonitoring = config.NEXT_PUBLIC_CONNECTION_MONITORING;
    
    if (!connectionMonitoring) {
      issues.push('❌ NEXT_PUBLIC_CONNECTION_MONITORING 未设置');
      recommendations.push('添加: NEXT_PUBLIC_CONNECTION_MONITORING=enabled');
    } else {
      const validValues = ['enabled', 'disabled', 'debug'];
      if (validValues.includes(connectionMonitoring)) {
        if (connectionMonitoring === 'debug') {
          }
      } else {
        issues.push(`❌ NEXT_PUBLIC_CONNECTION_MONITORING 值无效: ${connectionMonitoring}`);
        recommendations.push(`有效值: ${validValues.join(', ')}`);
      }
    }

    // 检查其他相关配置
    const nextAuthUrl = config.NEXTAUTH_URL;
    if (nextAuthUrl) {
      // 提取端口用于健康检查
      try {
        const url = new URL(nextAuthUrl);
        const port = url.port || (url.protocol === 'https:' ? '443' : '80');
        } catch (error) {
        issues.push(`❌ NEXTAUTH_URL 格式无效: ${nextAuthUrl}`);
      }
    } else {
      issues.push('❌ NEXTAUTH_URL 未设置');
      recommendations.push('添加: NEXTAUTH_URL=http://localhost:3007');
    }

    // 检查数据库配置（影响健康检查）
    const databaseUrl = config.DATABASE_URL;
    if (databaseUrl) {
      }...`);
    } else {
      issues.push('❌ DATABASE_URL 未设置');
    }

    // 汇总结果
    if (issues.length === 0) {
      return { valid: true, issues: [], recommendations: [] };
    } else {
      issues.forEach(issue => );
      
      if (recommendations.length > 0) {
        recommendations.forEach(rec => );
      }
      
      return { valid: false, issues, recommendations };
    }
  }

  // 切换连接监控状态
  toggleConnectionMonitoring(newState) {
    const validStates = ['enabled', 'disabled', 'debug'];
    
    if (!validStates.includes(newState)) {
      }`);
      return false;
    }

    const envLocalPath = path.join(this.rootDir, '.env.local');
    
    if (!fs.existsSync(envLocalPath)) {
      return false;
    }

    let content = fs.readFileSync(envLocalPath, 'utf8');
    
    // 查找并替换配置行
    const regex = /^NEXT_PUBLIC_CONNECTION_MONITORING=.*$/m;
    const newLine = `NEXT_PUBLIC_CONNECTION_MONITORING=${newState}`;
    
    if (regex.test(content)) {
      content = content.replace(regex, newLine);
      } else {
      content += `\n# 连接监控功能开关\n${newLine}\n`;
      }
    
    fs.writeFileSync(envLocalPath, content);
    return true;
  }

  // 创建环境变量模板
  createEnvTemplate() {
    const templatePath = path.join(this.rootDir, '.env.template');
    
    const template = `# 智点AI平台 - 环境变量配置模板
# 复制此文件为 .env.local 并填入真实值

# ==============================
# API 服务配置
# ==============================

# 302.AI API 配置
LLM_API_BASE=https://api.302.ai/v1
LLM_API_KEY=your_api_key_here

# 模型白名单（逗号分隔）
MODEL_ALLOWLIST=claude-opus-4-1-20250805,gemini-2.5-pro

# ==============================
# 数据库配置
# ==============================

# SQLite (开发环境)
DATABASE_URL="file:./prisma/dev.db"

# PostgreSQL (生产环境示例)
# DATABASE_URL="postgresql://user:password@localhost:5432/zhidianai"

# ==============================
# 认证配置
# ==============================

# NextAuth 配置
NEXTAUTH_URL=http://localhost:3007
NEXTAUTH_SECRET=your_strong_random_secret_here

# 开发期临时登录码（生产环境请删除）
DEV_LOGIN_CODE=your_dev_code
NEXT_PUBLIC_DEV_LOGIN_CODE=your_dev_code

# ==============================
# 连接监控配置 (Phase 0 新增)
# ==============================

# 连接监控功能开关
# enabled: 启用连接监控功能（推荐）
# disabled: 完全禁用连接监控功能
# debug: 启用连接监控 + 详细调试日志
NEXT_PUBLIC_CONNECTION_MONITORING=enabled

# ==============================
# 其他配置
# ==============================

# Node.js 环境
NODE_ENV=development

# 日志级别
LOG_LEVEL=info
`;

    fs.writeFileSync(templatePath, template);
    return templatePath;
  }

  // 快速回滚配置
  rollbackConnectionMonitoring() {
    const success = this.toggleConnectionMonitoring('disabled');
    
    if (success) {
      }
    
    return success;
  }
}

// 命令行界面
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'validate';
  
  const envConfig = new EnvConfig();
  
  switch (command) {
    case 'validate':
      envConfig.validateConnectionMonitoringConfig();
      break;
      
    case 'toggle':
      const newState = args[1];
      if (!newState) {
        return;
      }
      envConfig.toggleConnectionMonitoring(newState);
      break;
      
    case 'rollback':
      envConfig.rollbackConnectionMonitoring();
      break;
      
    case 'template':
      envConfig.createEnvTemplate();
      break;
      
    case 'show':
      const config = envConfig.readEnvConfig();
      
      // 只显示连接监控相关的配置
      const relevantKeys = [
        'NEXT_PUBLIC_CONNECTION_MONITORING',
        'NEXTAUTH_URL',
        'DATABASE_URL',
        'NODE_ENV'
      ];
      
      relevantKeys.forEach(key => {
        if (config[key]) {
          // 隐藏敏感信息
          let value = config[key];
          if (key.includes('DATABASE_URL') && value.length > 20) {
            value = value.substring(0, 20) + '...';
          }
          } else {
          `);
        }
      });
      break;
      
    default:
      rollback              快速回滚（禁用连接监控）
  template              创建环境变量模板文件
  show                  显示当前相关配置

示例:
  node env-config.js validate
  node env-config.js toggle enabled
  node env-config.js toggle debug
  node env-config.js rollback
  node env-config.js template
      `);
  }
}

// 如果直接执行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = EnvConfig;