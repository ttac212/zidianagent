const { PrismaClient, UserRole } = require("@prisma/client")
const crypto = require('crypto')
const prisma = new PrismaClient()

// 安全配置
const SECURITY_CONFIG = {
  CODE_LENGTH: 24,                // 邀请码长度
  CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%',
  USE_CHECKSUM: true,             // 使用校验和
  SECRET: process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production'
}

/**
 * 生成安全的邀请码
 */
function generateSecureInviteCode(prefix = 'SEC') {
  const charset = SECURITY_CONFIG.CHARSET
  const length = SECURITY_CONFIG.CODE_LENGTH
  let code = ''
  
  // 使用加密安全的随机数
  const randomBytes = crypto.randomBytes(length)
  
  for (let i = 0; i < length; i++) {
    code += charset[randomBytes[i] % charset.length]
  }
  
  // 添加校验和防止暴力猜测
  if (SECURITY_CONFIG.USE_CHECKSUM) {
    const checksum = crypto
      .createHash('sha256')
      .update(code + SECURITY_CONFIG.SECRET)
      .digest('hex')
      .substring(0, 4)
      .toUpperCase()
    
    return `${prefix}-${code}-${checksum}`
  }
  
  return `${prefix}-${code}`
}

/**
 * 生成UUID格式的邀请码（更难猜测）
 */
function generateUUIDInviteCode() {
  return crypto.randomUUID()
}

/**
 * 生成短链接风格的邀请码（配合验证机制使用）
 */
function generateShortInviteCode(length = 8) {
  // 短码配合其他验证机制使用（如邮箱验证、手机验证）
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  
  const randomBytes = crypto.randomBytes(length)
  for (let i = 0; i < length; i++) {
    code += charset[randomBytes[i] % charset.length]
  }
  
  return code
}

async function createSecureInviteCodes() {
  )
  )
  
  const plans = [
    {
      name: "方案1：超长安全邀请码",
      description: "24位随机字符 + 校验和，极难暴力破解",
      generator: generateSecureInviteCode,
      count: 5,
      prefix: "SECURE"
    },
    {
      name: "方案2：UUID格式邀请码",
      description: "标准UUID格式，全球唯一标识符",
      generator: generateUUIDInviteCode,
      count: 5,
      prefix: null
    },
    {
      name: "方案3：短码 + 二次验证",
      description: "8位短码，需配合邮箱/手机验证",
      generator: () => generateShortInviteCode(8),
      count: 5,
      prefix: "SHORT"
    }
  ]
  
  const allCodes = []
  
  try {
    for (const plan of plans) {
      )
      
      for (let i = 1; i <= plan.count; i++) {
        const code = plan.prefix 
          ? (plan.generator === generateUUIDInviteCode ? plan.generator() : plan.generator(plan.prefix))
          : plan.generator()
        
        const inviteCode = await prisma.inviteCode.create({
          data: {
            code: code,
            description: `${plan.name} #${i}`,
            maxUses: 20,
            usedCount: 0,
            isActive: true,
            expiresAt: null,
            defaultRole: UserRole.USER,
            monthlyTokenLimit: 999999999,
            createdBy: null,
          },
        })
        
        allCodes.push({
          方案: plan.name,
          邀请码: inviteCode.code,
          描述: inviteCode.description,
          安全级别: plan.name.includes("超长") ? "极高" : plan.name.includes("UUID") ? "高" : "中（需二次验证）"
        })
        
        }
    }
    
    // 导出所有邀请码
    const fs = require("fs")
    const filename = `secure-invite-codes-${Date.now()}.json`
    fs.writeFileSync(filename, JSON.stringify(allCodes, null, 2), "utf-8")
    
    )
    // 打印安全建议
    )
    )
    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 验证邀请码格式
function validateInviteCodeFormat(code) {
  // UUID格式
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)) {
    return { valid: true, type: 'UUID' }
  }
  
  // 安全格式（带校验和）
  const parts = code.split('-')
  if (parts.length === 3 && parts[0] === 'SECURE') {
    const mainCode = parts[1]
    const checksum = parts[2]
    
    const expectedChecksum = crypto
      .createHash('sha256')
      .update(mainCode + SECURITY_CONFIG.SECRET)
      .digest('hex')
      .substring(0, 4)
      .toUpperCase()
    
    return { 
      valid: checksum === expectedChecksum, 
      type: 'SECURE' 
    }
  }
  
  // 短码格式
  if (/^SHORT-[A-Z0-9]{8}$/.test(code)) {
    return { valid: true, type: 'SHORT', needsSecondaryVerification: true }
  }
  
  return { valid: false }
}

// 主函数
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case "generate":
      await createSecureInviteCodes()
      break
      
    case "validate":
      const code = args[1]
      if (!code) {
        break
      }
      const result = validateInviteCodeFormat(code)
      break
      
    default:
      )
      }
}

// 执行主函数
main().catch((error) => {
  process.exit(1)
})