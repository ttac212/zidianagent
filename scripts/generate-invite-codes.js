const { PrismaClient, UserRole } = require("@prisma/client")
const prisma = new PrismaClient()

// 生成随机邀请码
function generateInviteCode(prefix = "VIP") {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = prefix + "-"
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-"
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

async function createUnlimitedInviteCodes() {
  const numberOfCodes = 20  // 生成20个邀请码
  const maxUsesPerCode = 20 // 每个邀请码可使用20次
  const createdCodes = []

  )

  try {
    for (let i = 1; i <= numberOfCodes; i++) {
      const code = generateInviteCode("UNLIMITED")
      
      const inviteCode = await prisma.inviteCode.create({
        data: {
          code: code,
          description: `无限制邀请码 #${i} - 不限制Token使用量`,
          maxUses: maxUsesPerCode,
          usedCount: 0,
          isActive: true,
          expiresAt: null, // 永不过期
          defaultRole: UserRole.USER,
          monthlyTokenLimit: 999999999, // 设置为极大值，实际限制在中转平台控制
          createdBy: null,
        },
      })

      createdCodes.push(inviteCode)
      )
    }

    // 导出为JSON文件
    const exportData = createdCodes.map(code => ({
      邀请码: code.code,
      描述: code.description,
      可用次数: code.maxUses,
      已使用: code.usedCount,
      状态: code.isActive ? "激活" : "未激活",
      创建时间: code.createdAt.toLocaleString("zh-CN"),
    }))

    const fs = require("fs")
    const filename = `invite-codes-unlimited-${Date.now()}.json`
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2), "utf-8")
    
    )
    )
    
    // 打印所有邀请码的简洁列表
    createdCodes.forEach((code, index) => {
      .toString().padStart(2, "0")}. ${code.code}`)
    })
    
    )
    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 查看所有邀请码状态
async function listAllInviteCodes() {
  try {
    const inviteCodes = await prisma.inviteCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        usedBy: {
          select: {
            email: true,
            displayName: true,
            createdAt: true,
          },
        },
      },
    })

    )
    
    inviteCodes.forEach((code, index) => {
      : "永不过期"}`)
      
      if (code.usedBy.length > 0) {
        code.usedBy.forEach(user => {
          - ${user.createdAt.toLocaleString("zh-CN")}`)
        })
      }
      
      )
    })
    
    // 统计信息
    const activeCount = inviteCodes.filter(c => c.isActive).length
    const totalUses = inviteCodes.reduce((sum, c) => sum + c.usedCount, 0)
    const totalMaxUses = inviteCodes.reduce((sum, c) => sum + c.maxUses, 0)
    
    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 删除指定邀请码
async function deleteInviteCode(code) {
  try {
    const deleted = await prisma.inviteCode.delete({
      where: { code },
    })
    
    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 停用/激活邀请码
async function toggleInviteCode(code, activate = true) {
  try {
    const updated = await prisma.inviteCode.update({
      where: { code },
      data: { isActive: activate },
    })
    
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
    case "generate":
      await createUnlimitedInviteCodes()
      break
      
    case "list":
      await listAllInviteCodes()
      break
      
    case "delete":
      const codeToDelete = args[1]
      if (!codeToDelete) {
        break
      }
      await deleteInviteCode(codeToDelete)
      break
      
    case "disable":
      const codeToDisable = args[1]
      if (!codeToDisable) {
        break
      }
      await toggleInviteCode(codeToDisable, false)
      break
      
    case "enable":
      const codeToEnable = args[1]
      if (!codeToEnable) {
        break
      }
      await toggleInviteCode(codeToEnable, true)
      break
      
    default:
      }
}

// 执行主函数
main().catch((error) => {
  process.exit(1)
})