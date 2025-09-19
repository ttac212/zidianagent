/**
 * 内部测试前置检查脚本
 * 确保系统准备就绪
 */

import { prisma } from '../lib/prisma'
import fs from 'fs/promises'
import path from 'path'

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

const log = {
  success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg: string) => console.log(`\n${colors.cyan}📋 ${msg}${colors.reset}`)
}

// 检查结果统计
let totalChecks = 0
let passedChecks = 0
let warnings = 0

async function checkEnvVariables() {
  log.section('环境变量检查')
  
  const required = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'LLM_API_BASE',
    'MODEL_ALLOWLIST'
  ]
  
  const recommended = [
    'LLM_CLAUDE_API_KEY',
    'LLM_GEMINI_API_KEY',
    'LLM_API_KEY',
    'DEV_LOGIN_CODE'
  ]
  
  // 检查必需变量
  for (const key of required) {
    totalChecks++
    if (process.env[key]) {
      log.success(`${key} 已配置`)
      passedChecks++
    } else {
      log.error(`${key} 未配置（必需）`)
    }
  }
  
  // 检查推荐变量
  for (const key of recommended) {
    if (process.env[key]) {
      log.success(`${key} 已配置`)
    } else {
      log.warning(`${key} 未配置（推荐）`)
      warnings++
    }
  }
  
  // 验证MODEL_ALLOWLIST格式
  if (process.env.MODEL_ALLOWLIST) {
    const models = process.env.MODEL_ALLOWLIST.split(',').map(s => s.trim())
    log.info(`已配置 ${models.length} 个模型: ${models.join(', ')}`)
  }
}

async function checkDatabase() {
  log.section('数据库连接检查')
  
  totalChecks++
  try {
    // 测试数据库连接
    await prisma.$connect()
    log.success('数据库连接成功')
    passedChecks++
    
    // 检查表结构
    const userCount = await prisma.user.count()
    const conversationCount = await prisma.conversation.count()
    const inviteCodeCount = await prisma.inviteCode.count()
    
    log.info(`用户数: ${userCount}`)
    log.info(`对话数: ${conversationCount}`)
    log.info(`邀请码数: ${inviteCodeCount}`)
    
    // 检查是否有管理员
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    })
    
    if (adminCount === 0) {
      log.warning('没有管理员账号，建议创建至少一个')
      warnings++
    } else {
      log.success(`已有 ${adminCount} 个管理员账号`)
    }
    
    // 检查有效邀请码
    const activeInvites = await prisma.inviteCode.count({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })
    
    if (activeInvites === 0) {
      log.warning('没有有效的邀请码，新用户无法注册')
      warnings++
    } else {
      log.success(`有 ${activeInvites} 个有效邀请码`)
    }
    
  } catch (error) {
    log.error(`数据库连接失败: ${error}`)
  } finally {
    await prisma.$disconnect()
  }
}

async function checkAPIKeys() {
  log.section('API Key 检查')
  
  // 检查302.AI连接
  totalChecks++
  const apiBase = process.env.LLM_API_BASE || 'https://api.302.ai/v1'
  
  try {
    const response = await fetch(`${apiBase}/models`, {
      headers: {
        'Authorization': `Bearer ${process.env.LLM_API_KEY || process.env.LLM_CLAUDE_API_KEY || ''}`
      }
    })
    
    if (response.ok) {
      log.success('302.AI API 连接成功')
      passedChecks++
      
      const data = await response.json()
      if (data.data && Array.isArray(data.data)) {
        log.info(`可用模型数: ${data.data.length}`)
      }
    } else {
      log.error(`302.AI API 连接失败: HTTP ${response.status}`)
      
      if (response.status === 401) {
        log.error('API Key 无效或未配置')
      }
    }
  } catch (error) {
    log.error(`无法连接到 302.AI: ${error}`)
  }
}

async function checkFileSystem() {
  log.section('文件系统检查')
  
  const criticalPaths = [
    'components/chat/smart-chat-center-v2-fixed.tsx',
    'app/api/chat/route.ts',
    'prisma/schema.prisma',
    'lib/ai/key-manager.ts',
    'lib/utils/retry.ts'
  ]
  
  for (const filePath of criticalPaths) {
    totalChecks++
    try {
      await fs.access(path.join(process.cwd(), filePath))
      log.success(`核心文件存在: ${filePath}`)
      passedChecks++
    } catch {
      log.error(`核心文件缺失: ${filePath}`)
    }
  }
  
  // 检查是否有.env文件
  try {
    await fs.access(path.join(process.cwd(), '.env'))
    log.success('.env 文件存在')
  } catch {
    log.error('.env 文件不存在')
  }
  
  // 检查是否有.env.local文件
  try {
    await fs.access(path.join(process.cwd(), '.env.local'))
    log.info('检测到 .env.local 文件（会覆盖 .env 设置）')
  } catch {
    // 这不是错误，只是信息
  }
}

async function checkNodeVersion() {
  log.section('运行环境检查')
  
  totalChecks++
  const nodeVersion = process.version
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1))
  
  if (majorVersion >= 18) {
    log.success(`Node.js 版本: ${nodeVersion}`)
    passedChecks++
  } else {
    log.error(`Node.js 版本过低: ${nodeVersion}（需要 18+）`)
  }
  
  // 检查包管理器
  const isPnpm = process.env.npm_config_user_agent?.includes('pnpm')
  const isNpm = process.env.npm_config_user_agent?.includes('npm')
  const isYarn = process.env.npm_config_user_agent?.includes('yarn')
  
  if (isPnpm) {
    log.success('使用 pnpm（推荐）')
  } else if (isNpm) {
    log.info('使用 npm')
  } else if (isYarn) {
    log.info('使用 yarn')
  }
}

async function checkServices() {
  log.section('服务状态检查')
  
  // 检查开发服务器是否运行
  try {
    const response = await fetch('http://localhost:3007/api/chat', {
      method: 'GET'
    })
    
    if (response.ok) {
      log.success('开发服务器正在运行（端口 3007）')
    } else {
      log.warning('开发服务器响应异常')
      warnings++
    }
  } catch (error) {
    log.warning('开发服务器未运行，请运行: pnpm dev')
    warnings++
  }
}

async function generateTestData() {
  log.section('测试数据准备建议')
  
  log.info('1. 生成邀请码:')
  log.info('   node scripts/generate-invite-codes.js generate')
  
  log.info('2. 导入商家数据:')
  log.info('   pnpm import:merchants')
  
  log.info('3. 运行数据库种子:')
  log.info('   pnpm db:seed')
  
  log.info('4. 打开数据库管理界面:')
  log.info('   pnpm db:studio')
}

async function runAllChecks() {
  await checkNodeVersion()
  await checkEnvVariables()
  await checkDatabase()
  await checkAPIKeys()
  await checkFileSystem()
  await checkServices()
  await generateTestData()
  
  // 总结
  log.section('检查总结')
  
  const passRate = totalChecks > 0 ? (passedChecks / totalChecks * 100).toFixed(1) : 0
  
  log.info(`检查完成: ${passedChecks}/${totalChecks} 通过 (${passRate}%)`)
  
  if (warnings > 0) {
    log.warning(`警告数量: ${warnings}`)
  }
  
  if (passedChecks === totalChecks && warnings === 0) {
    log.success('所有检查通过！系统已准备就绪')
  } else if (passedChecks === totalChecks) {
    log.warning('基础检查通过，但有警告项')
  } else {
    log.error('存在未通过的检查项，请修复后再测试')
  }
  
  process.exit(passedChecks < totalChecks ? 1 : 0)
}

// 运行检查
if (require.main === module) {
  runAllChecks()
    .catch(console.error)
    .finally(() => process.exit(0))
}

export { runAllChecks }