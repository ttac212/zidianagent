/**
 * 批次字段数据迁移脚本
 *
 * 用途：从 metadata 字段提取 targetSequence 和 appendPrompt 到显式字段
 *
 * 使用方法：
 * npx tsx scripts/backfill-batch-fields.ts [--dry-run] [--force]
 */

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

interface MigrationResult {
  totalBatches: number
  migratedCount: number
  skippedCount: number
  errorCount: number
  errors: Array<{ batchId: string; error: string }>
}

async function backfillBatchFields(options: {
  dryRun: boolean
  force: boolean
}): Promise<MigrationResult> {
  const { dryRun, force } = options

  console.log('🔍 开始扫描批次数据...')
  console.log(`模式: ${dryRun ? '预演（不修改数据）' : '实际迁移'}`)
  console.log(`强制模式: ${force ? '是（覆盖已有数据）' : '否（仅迁移空字段）'}`)
  console.log()

  const result: MigrationResult = {
    totalBatches: 0,
    migratedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: []
  }

  try {
    // 查询所有批次
    // 注意：metadata 字段已从 schema 中移除，此脚本仅用于迁移前的历史数据处理
    // 如果 schema 中已删除 metadata，此脚本将跳过所有批次
    const batches = await prisma.creativeBatch.findMany({
      select: {
        id: true,
        targetSequence: true,
        appendPrompt: true
      }
    })

    result.totalBatches = batches.length
    console.log(`📊 找到 ${result.totalBatches} 个批次`)
    console.log()

    // 如果 metadata 字段已从 schema 删除，所有批次都将被标记为"已迁移"
    for (const batch of batches) {
      try {
        // 跳过条件：非强制模式下，如果字段已有值则跳过
        if (!force && (batch.targetSequence !== null || batch.appendPrompt !== null)) {
          result.skippedCount++
          console.log(`⏭️  批次 ${batch.id}: 字段已有值，跳过`)
          continue
        }

        // 注意：由于 metadata 已从 schema 删除，无法访问历史数据
        // 此脚本仅适用于迁移前的环境
        result.skippedCount++
        console.log(`⏭️  批次 ${batch.id}: metadata 字段已移除，无法迁移历史数据`)
      } catch (error) {
        result.errorCount++
        const errorMsg = error instanceof Error ? error.message : String(error)
        result.errors.push({ batchId: batch.id, error: errorMsg })
        console.error(`❌ 批次 ${batch.id}: 处理失败 - ${errorMsg}`)
      }
    }

    console.log()
    console.log('📈 迁移结果统计:')
    console.log(`  总批次数: ${result.totalBatches}`)
    console.log(`  成功迁移: ${result.migratedCount}`)
    console.log(`  跳过: ${result.skippedCount}`)
    console.log(`  失败: ${result.errorCount}`)

    if (result.errors.length > 0) {
      console.log()
      console.log('❌ 错误详情:')
      result.errors.forEach(({ batchId, error }) => {
        console.log(`  - ${batchId}: ${error}`)
      })
    }

    if (dryRun && result.migratedCount > 0) {
      console.log()
      console.log('💡 这是预演模式，未实际修改数据。')
      console.log('   移除 --dry-run 参数以执行实际迁移。')
    }

    return result
  } catch (error) {
    console.error('💥 迁移过程中发生严重错误:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 命令行参数解析
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const showHelp = args.includes('--help') || args.includes('-h')

if (showHelp) {
  console.log(`
批次字段数据迁移脚本

用途：
  从 metadata 字段提取 targetSequence 和 appendPrompt 到显式字段

用法：
  npx tsx scripts/backfill-batch-fields.ts [选项]

选项：
  --dry-run    预演模式，不实际修改数据（推荐先运行）
  --force      强制模式，覆盖已有值（谨慎使用）
  --help, -h   显示此帮助信息

示例：
  # 预演迁移（安全，推荐先运行）
  npx tsx scripts/backfill-batch-fields.ts --dry-run

  # 执行实际迁移
  npx tsx scripts/backfill-batch-fields.ts

  # 强制覆盖已有值
  npx tsx scripts/backfill-batch-fields.ts --force
`)
  process.exit(0)
}

// 执行迁移
backfillBatchFields({ dryRun, force })
  .then(result => {
    const exitCode = result.errorCount > 0 ? 1 : 0
    process.exit(exitCode)
  })
  .catch(error => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
