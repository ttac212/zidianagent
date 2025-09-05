/**
 * 长对话修复回滚脚本
 * 用于在修复方案出现问题时快速恢复到原始状态
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔄 长对话修复回滚脚本\n');

const BACKUP_COMMIT = '03d9fc2'; // 备份提交的Hash
const TARGET_FILE = 'components/chat/smart-chat-center-v2-fixed.tsx';

function rollback() {
  try {
    console.log('📋 回滚选项:');
    console.log('1. Git回滚 - 恢复到备份提交点 (推荐)');
    console.log('2. 手动回滚 - 仅恢复虚拟滚动阈值');
    console.log('3. 检查当前状态');
    
    // 检查Git状态
    console.log('\n📊 当前Git状态:');
    try {
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
      if (gitStatus) {
        console.log('⚠️  有未提交的更改:');
        console.log(gitStatus);
      } else {
        console.log('✅ 工作目录干净');
      }
      
      const currentCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      console.log(`📍 当前提交: ${currentCommit}`);
      console.log(`📍 备份提交: ${BACKUP_COMMIT}`);
      
    } catch (error) {
      console.log('❌ Git检查失败:', error.message);
    }
    
    console.log('\n🛡️  执行回滚操作:');
    console.log('选择回滚方式 (默认执行Git回滚):');
    
    // 执行Git回滚到备份点
    gitRollback();
    
  } catch (error) {
    console.error('❌ 回滚失败:', error.message);
    console.log('\n🆘 手动回滚步骤:');
    console.log('1. 打开文件: components/chat/smart-chat-center-v2-fixed.tsx');
    console.log('2. 找到第229行');
    console.log('3. 将 "state.messages.length > 100" 改回 "state.messages.length > 50"');
    process.exit(1);
  }
}

function gitRollback() {
  try {
    console.log(`🔄 执行Git回滚到提交 ${BACKUP_COMMIT}...`);
    
    // 检查备份提交是否存在
    try {
      execSync(`git show ${BACKUP_COMMIT} --quiet`, { stdio: 'ignore' });
    } catch (error) {
      throw new Error(`备份提交 ${BACKUP_COMMIT} 不存在`);
    }
    
    // 回滚特定文件
    console.log(`📂 恢复文件: ${TARGET_FILE}`);
    execSync(`git checkout ${BACKUP_COMMIT} -- ${TARGET_FILE}`, { stdio: 'inherit' });
    
    console.log('✅ Git回滚成功！');
    console.log(`📁 文件已恢复: ${TARGET_FILE}`);
    
    // 验证回滚结果
    verifyRollback();
    
  } catch (error) {
    throw new Error(`Git回滚失败: ${error.message}`);
  }
}

function verifyRollback() {
  try {
    console.log('\n🔍 验证回滚结果...');
    
    const filePath = path.join(process.cwd(), TARGET_FILE);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 检查是否包含原始阈值
    if (content.includes('state.messages.length > 50')) {
      console.log('✅ 虚拟滚动阈值已恢复为50');
      console.log('✅ 回滚验证通过');
      
      console.log('\n⚠️  注意事项:');
      console.log('- 52条消息的对话将重新使用虚拟滚动');
      console.log('- 可能会重现原始显示问题');
      console.log('- 请重启开发服务器以应用更改');
      
    } else if (content.includes('state.messages.length > 100')) {
      console.log('❌ 回滚验证失败：阈值仍为100');
    } else {
      console.log('⚠️  无法确定当前阈值状态');
    }
    
  } catch (error) {
    console.log('⚠️  回滚验证失败:', error.message);
  }
}

// 执行回滚
rollback();