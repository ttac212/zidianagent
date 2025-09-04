const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function checkAllInviteCodes() {
  try {
    )
    )
    
    // 获取所有邀请码
    const allCodes = await prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { usedBy: true }
        }
      }
    })
    
    // 分类统计
    const stats = {
      unlimited: [],
      secure: [],
      uuid: [],
      short: [],
      other: []
    }
    
    allCodes.forEach(code => {
      if (code.code.startsWith('UNLIMITED-')) {
        stats.unlimited.push(code)
      } else if (code.code.startsWith('SECURE-')) {
        stats.secure.push(code)
      } else if (code.code.startsWith('SHORT-')) {
        stats.short.push(code)
      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code.code)) {
        stats.uuid.push(code)
      } else {
        stats.other.push(code)
      }
    })
    
    // 打印统计结果
    )
    : ${stats.unlimited.length} 个`)
    : ${stats.secure.length} 个`)
    : ${stats.short.length} 个`)
    // 显示原始邀请码状态
    if (stats.unlimited.length > 0) {
      )
      )
      
      stats.unlimited.forEach((code, index) => {
        const usageInfo = `${code.usedCount}/${code.maxUses}`
        const status = code.isActive ? "✅ 激活" : "❌ 停用"
        .toString().padStart(2, '0')}. ${code.code}`)
        })
    }
    
    // 显示新安全邀请码
    if (stats.secure.length > 0 || stats.uuid.length > 0) {
      )
      )
      
      stats.secure.concat(stats.uuid).forEach((code, index) => {
        const type = code.code.startsWith('SECURE-') ? '超长安全码' : 'UUID'
        .toString().padStart(2, '0')}. ${code.code.substring(0, 40)}...`)
        })
    }
    
    // 使用情况汇总
    const totalActive = allCodes.filter(c => c.isActive).length
    const totalUsed = allCodes.reduce((sum, c) => sum + c.usedCount, 0)
    const totalAvailable = allCodes.reduce((sum, c) => sum + (c.maxUses - c.usedCount), 0)
    
    )
    )
    // 建议
    )
    )
    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 设置原邀请码过期时间（可选）
async function setExpirationForOldCodes(daysFromNow = 30) {
  try {
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + daysFromNow)
    
    const result = await prisma.inviteCode.updateMany({
      where: {
        code: {
          startsWith: 'UNLIMITED-'
        },
        expiresAt: null // 只更新没有设置过期时间的
      },
      data: {
        expiresAt: expirationDate
      }
    })
    
    }`)
    
  } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  
  switch (command) {
    case 'check':
      await checkAllInviteCodes()
      break
      
    case 'expire':
      const days = parseInt(args[1]) || 30
      await setExpirationForOldCodes(days)
      break
      
    default:
      }
}

main().catch((error) => {
  process.exit(1)
})