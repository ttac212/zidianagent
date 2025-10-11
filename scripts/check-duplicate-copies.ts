/**
 * 检查 creative_copies 表是否存在 (batchId, sequence) 重复记录
 */

import { prisma } from '../lib/prisma'

async function main() {
  const dupes = await prisma.$queryRaw<Array<{ batchId: string; sequence: number; cnt: bigint }>>`
    SELECT batchId, sequence, COUNT(*) as cnt 
    FROM creative_copies 
    GROUP BY batchId, sequence 
    HAVING cnt > 1
  `

  if (dupes.length > 0) {
    console.error('❌ 发现重复记录:')
    dupes.forEach(d => {
      console.error(`  批次 ${d.batchId} 序号 ${d.sequence}: ${d.cnt} 条`)
    })
    process.exit(1)
  } else {
    console.log('✅ 无重复记录，可以安全添加唯一约束')
    process.exit(0)
  }
}

main()
  .catch(e => {
    console.error('检查失败:', e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
