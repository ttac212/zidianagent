/**
 * 批量处理所有商家视频数据
 *
 * 使用方法：
 * npx tsx scripts/batch-enhance-all.ts
 */

import { PrismaClient } from '@prisma/client'
import { enhanceMerchantVideos } from './enhance-merchant-videos'

const prisma = new PrismaClient()

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║      批量增强所有商家视频数据                    ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  try {
    // 获取所有活跃商家
    const merchants = await prisma.merchant.findMany({
      where: { status: 'ACTIVE' },
      include: {
        _count: {
          select: {
            contents: true,
          },
        },
      },
      orderBy: {
        totalDiggCount: 'desc', // 按总点赞数排序，优先处理热门商家
      },
    })

    console.log(`📊 共有 ${merchants.length} 个活跃商家\n`)

    if (merchants.length === 0) {
      console.log('没有商家需要处理')
      return
    }

    // 显示商家列表
    console.log('商家列表:')
    merchants.forEach((m, index) => {
      console.log(
        `  ${index + 1}. ${m.name} - ${m._count.contents}个视频，总点赞${m.totalDiggCount.toLocaleString()}`
      )
    })

    console.log('\n开始处理...\n')
    console.log('─'.repeat(50))

    // 逐个处理商家
    for (let i = 0; i < merchants.length; i++) {
      const merchant = merchants[i]

      console.log(`\n[${i + 1}/${merchants.length}] 处理商家: ${merchant.name}`)
      console.log(`═`.repeat(50))

      // 调用增强脚本处理该商家
      // 这里我们需要导出enhanceVideo功能或直接调用
      // 为了简化，我们直接调用命令
      const { spawn } = require('child_process')

      await new Promise((resolve, reject) => {
        const child = spawn('npx', ['tsx', 'scripts/enhance-merchant-videos.ts', merchant.id], {
          stdio: 'inherit',
          shell: true,
        })

        child.on('close', (code: number) => {
          if (code === 0) {
            resolve(code)
          } else {
            console.warn(`⚠️  商家 ${merchant.name} 处理异常 (退出码: ${code})`)
            resolve(code) // 继续处理下一个商家
          }
        })

        child.on('error', (error: Error) => {
          console.error(`❌ 商家 ${merchant.name} 处理失败:`, error.message)
          resolve(1)
        })
      })

      // 商家间延迟5秒
      if (i < merchants.length - 1) {
        console.log('\n⏳ 等待5秒后继续...')
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }

    console.log('\n\n╔══════════════════════════════════════════════════╗')
    console.log('║              全部处理完成                        ║')
    console.log('╚══════════════════════════════════════════════════╝\n')

    // 最终统计
    const totalVideos = await prisma.merchantContent.count()
    const enhancedVideos = await prisma.merchantContent.count({
      where: { playCount: { gt: 0 } },
    })
    const suspiciousVideos = await prisma.merchantContent.count({
      where: { isSuspicious: true },
    })
    const totalComments = await prisma.merchantContentComment.count()

    console.log('📊 最终统计:')
    console.log(`  - 总视频数: ${totalVideos}`)
    console.log(`  - 已增强: ${enhancedVideos} (${((enhancedVideos / totalVideos) * 100).toFixed(1)}%)`)
    console.log(`  - 疑似刷量: ${suspiciousVideos}`)
    console.log(`  - 评论总数: ${totalComments}`)

    console.log('\n✅ 所有商家数据增强完成！')
    console.log('💡 下一步: 运行 npx tsx scripts/regenerate-all-profiles.ts 重新生成档案\n')
  } catch (error: any) {
    console.error('\n❌ 批量处理失败:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
