import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
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

  console.log('\n=== 启用自动同步的商家 ===\n')

  for (const m of merchants) {
    console.log(`商家: ${m.name}`)
    console.log(`  ID: ${m.id}`)
    console.log(`  监控启用: ${m.monitoringEnabled}`)

    const intervalHours = m.syncIntervalSeconds / 3600
    console.log(`  同步间隔: ${m.syncIntervalSeconds} 秒 (${intervalHours} 小时)`)
    console.log(`  最后同步: ${m.lastCollectedAt ? new Date(m.lastCollectedAt).toLocaleString('zh-CN') : '暂无'}`)
    console.log(`  下次同步: ${m.nextSyncAt ? new Date(m.nextSyncAt).toLocaleString('zh-CN') : '暂无'}`)

    if (m.lastCollectedAt && m.nextSyncAt) {
      const lastSync = new Date(m.lastCollectedAt)
      const nextSync = new Date(m.nextSyncAt)
      const diffSeconds = (nextSync - lastSync) / 1000
      const diffHours = diffSeconds / 3600

      console.log(`  实际间隔: ${diffSeconds} 秒 (${diffHours.toFixed(2)} 小时)`)
      console.log(`  是否匹配: ${diffSeconds === m.syncIntervalSeconds ? '✅ 是' : '❌ 否'}`)

      if (diffSeconds !== m.syncIntervalSeconds) {
        console.log(`  ⚠️  配置间隔: ${intervalHours} 小时`)
        console.log(`  ⚠️  实际间隔: ${diffHours.toFixed(2)} 小时`)
        console.log(`  ⚠️  差值: ${(diffSeconds - m.syncIntervalSeconds) / 60} 分钟`)
      }
    }
    console.log('')
  }

  if (merchants.length === 0) {
    console.log('没有启用自动同步的商家')
  }
} catch (error) {
  console.error('错误:', error.message)
} finally {
  await prisma.$disconnect()
}
