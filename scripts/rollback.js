/**
 * 连接监控功能快速回滚脚本
 * 在出现问题时快速禁用或移除连接监控功能
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class RollbackManager {
  constructor() {
    this.rootDir = path.join(__dirname, '..');
    this.backupDir = path.join(this.rootDir, '.rollback-backups');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  }

  // 确保备份目录存在
  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      }
  }

  // 创建文件备份
  createBackup(filePath, reason = '') {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    this.ensureBackupDir();
    
    const fileName = path.basename(filePath);
    const backupFileName = `${fileName}.${this.timestamp}.backup`;
    const backupPath = path.join(this.backupDir, backupFileName);
    
    fs.copyFileSync(filePath, backupPath);
    if (reason) {
      }
    
    return backupPath;
  }

  // 快速禁用连接监控功能
  disableConnectionMonitoring() {
    // 1. 备份并修改环境变量
    const envLocalPath = path.join(this.rootDir, '.env.local');
    this.createBackup(envLocalPath, '修改连接监控开关前备份');
    
    if (fs.existsSync(envLocalPath)) {
      let content = fs.readFileSync(envLocalPath, 'utf8');
      
      // 禁用连接监控
      const regex = /^NEXT_PUBLIC_CONNECTION_MONITORING=.*$/m;
      if (regex.test(content)) {
        content = content.replace(regex, 'NEXT_PUBLIC_CONNECTION_MONITORING=disabled');
        fs.writeFileSync(envLocalPath, content);
        } else {
        content += '\nNEXT_PUBLIC_CONNECTION_MONITORING=disabled\n';
        fs.writeFileSync(envLocalPath, content);
      }
    }

    }

  // 移除连接监控相关文件
  removeConnectionMonitoringFiles() {
    const filesToRemove = [
      'app/api/health/route.ts',
      'hooks/use-connection-monitor.ts', 
      'components/ui/connection-status.tsx',
    ];

    const backupPaths = [];

    filesToRemove.forEach(relativeFilePath => {
      const fullPath = path.join(this.rootDir, relativeFilePath);
      
      if (fs.existsSync(fullPath)) {
        const backupPath = this.createBackup(fullPath, '删除前备份');
        if (backupPath) {
          backupPaths.push(backupPath);
          fs.unlinkSync(fullPath);
          }
      } else {
        }
    });

    return backupPaths;
  }

  // 还原备份文件
  restoreBackup(backupFileName) {
    const backupPath = path.join(this.backupDir, backupFileName);
    
    if (!fs.existsSync(backupPath)) {
      return false;
    }

    // 解析原始文件路径
    const originalFileName = backupFileName.split('.')[0];
    let targetPath;

    // 根据文件名确定目标路径
    if (originalFileName === '.env') {
      targetPath = path.join(this.rootDir, '.env.local');
    } else if (originalFileName === 'route') {
      targetPath = path.join(this.rootDir, 'app/api/health/route.ts');
    } else if (originalFileName === 'use-connection-monitor') {
      targetPath = path.join(this.rootDir, 'hooks/use-connection-monitor.ts');
    } else if (originalFileName === 'connection-status') {
      targetPath = path.join(this.rootDir, 'components/ui/connection-status.tsx');
    } else {
      return false;
    }

    // 确保目标目录存在
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.copyFileSync(backupPath, targetPath);
    }`);
    
    return true;
  }

  // 列出可用的备份
  listBackups() {
    this.ensureBackupDir();
    
    const backups = fs.readdirSync(this.backupDir).filter(f => f.endsWith('.backup'));
    
    if (backups.length === 0) {
      return [];
    }

    backups.forEach((backup, index) => {
      const stats = fs.statSync(path.join(this.backupDir, backup));
      const size = (stats.size / 1024).toFixed(1);
      })`);
    });
    
    return backups;
  }

  // 清理备份文件
  cleanupOldBackups(keepDays = 7) {
    this.ensureBackupDir();
    
    const backups = fs.readdirSync(this.backupDir).filter(f => f.endsWith('.backup'));
    const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    backups.forEach(backup => {
      const backupPath = path.join(this.backupDir, backup);
      const stats = fs.statSync(backupPath);
      
      if (stats.mtime.getTime() < cutoffTime) {
        fs.unlinkSync(backupPath);
        cleanedCount++;
      }
    });

    return cleanedCount;
  }

  // 完整回滚流程
  fullRollback() {
    // 步骤1: 禁用功能
    this.disableConnectionMonitoring();

    // 步骤2: 移除文件
    const backupPaths = this.removeConnectionMonitoringFiles();

    }

  // 温和回滚 - 仅禁用功能不删除文件
  gentleRollback() {
    this.disableConnectionMonitoring();
    
    }

  // 验证回滚状态
  verifyRollbackStatus() {
    // 检查环境变量
    const envLocalPath = path.join(this.rootDir, '.env.local');
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, 'utf8');
      const match = content.match(/^NEXT_PUBLIC_CONNECTION_MONITORING=(.*)$/m);
      
      if (match) {
        const status = match[1].trim();
        if (status === 'disabled') {
          } else {
          }
      } else {
        }
    } else {
      }

    // 检查关键文件
    const criticalFiles = [
      'app/api/health/route.ts',
      'hooks/use-connection-monitor.ts',
      'components/ui/connection-status.tsx',
    ];

    criticalFiles.forEach(filePath => {
      const fullPath = path.join(this.rootDir, filePath);
      const exists = fs.existsSync(fullPath);
      });

    // 检查备份文件
    const backups = this.listBackups();
    }
}

// 命令行界面
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  const rollback = new RollbackManager();
  
  switch (command) {
    case 'disable':
      rollback.gentleRollback();
      break;
      
    case 'full':
      rollback.fullRollback();
      break;
      
    case 'restore':
      const backupName = args[1];
      if (!backupName) {
        return;
      }
      rollback.restoreBackup(backupName);
      break;
      
    case 'list':
      rollback.listBackups();
      break;
      
    case 'cleanup':
      const days = parseInt(args[1]) || 7;
      rollback.cleanupOldBackups(days);
      break;
      
    case 'verify':
      rollback.verifyRollbackStatus();
      break;
      
    case 'help':
    default:
      verify                验证当前回滚状态
  help                  显示此帮助信息

示例:
  node rollback.js disable           # 仅禁用连接监控功能
  node rollback.js full              # 完整回滚并备份文件  
  node rollback.js list              # 查看备份文件
  node rollback.js restore env.local.2024-08-31.backup
  node rollback.js cleanup 3         # 清理3天前的备份
  node rollback.js verify            # 检查回滚状态

紧急回滚快捷方式:
  npm run rollback                   # 执行温和回滚
      `);
      break;
  }
}

// 如果直接执行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = RollbackManager;