import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixMerchantSyncData() {
  try {
    console.log('开始修复商家自动同步数据...\n')

    // 获取所有启用自动同步的商家
    const merchants = await prisma.merchant.findMany({
      where: { monitoringEnabled: true },
      select: {
        id: true,
        name: true,
        monitoringEnabled: true,
        syncIntervalSeconds: true,
        lastCollectedAt: true,
        nextSyncAt: true,
      },
    })

    console.log(`找到 ${merchants.length} 个启用自动同步的商家\n`)

    let fixedCount = 0
    const now = new Date()

    for (const merchant of merchants) {
      const { id, name, syncIntervalSeconds, lastCollectedAt, nextSyncAt } = merchant

      // 计算正确的nextSyncAt
      let correctNextSyncAt

      if (lastCollectedAt) {
        // 基于最后同步时间计算
        correctNextSyncAt = new Date(
          new Date(lastCollectedAt).getTime() + syncIntervalSeconds * 1000
        )

        // 如果计算出的时间已过期，使用当前时间（立即执行）
        if (correctNextSyncAt < now) {
          correctNextSyncAt = now
        }
      } else {
        // 没有最后同步时间，立即执行
        correctNextSyncAt = now
      }

      // 检查是否需要修复
      const needsFix =
        !nextSyncAt ||
        Math.abs(correctNextSyncAt.getTime() - new Date(nextSyncAt).getTime()) > 60000 // 差值超过1分钟

      if (needsFix) {
        console.log(`修复商家: ${name}`)
        console.log(`  旧的 nextSyncAt: ${nextSyncAt ? new Date(nextSyncAt).toLocaleString('zh-CN') : '空'}`)
        console.log(`  新的 nextSyncAt: ${correctNextSyncAt.toLocaleString('zh-CN')}`)

        await prisma.merchant.update({
          where: { id },
          data: { nextSyncAt: correctNextSyncAt },
        })

        fixedCount++
        console.log(`  ✅ 已修复\n`)
      } else {
        console.log(`跳过商家: ${name} (数据正确)\n`)
      }
    }

    // 清空所有禁用监控的商家的nextSyncAt
    const disabledResult = await prisma.merchant.updateMany({
      where: {
        monitoringEnabled: false,
        nextSyncAt: { not: null },
      },
      data: { nextSyncAt: null },
    })

    console.log(`\n修复完成！`)
    console.log(`  已修复启用监控的商家: ${fixedCount} 个`)
    console.log(`  已清空禁用监控的商家: ${disabledResult.count} 个`)
  } catch (error) {
    console.error('修复失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixMerchantSyncData()
