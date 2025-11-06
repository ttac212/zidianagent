import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const merchantId = 'cmhd5q5du000pwtcc94pzs7n0'

async function main() {
  console.log('=== 查询商家:', merchantId, '===\n')

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        category: true,
        contents: {
          orderBy: {
            publishedAt: 'desc'
          },
          take: 5
        },
        _count: {
          select: { contents: true }
        }
      }
    })

    if (!merchant) {
      console.log('❌ 商家不存在')
      return
    }

    console.log('✅ 商家存在')
    console.log('名称:', merchant.name)
    console.log('UID:', merchant.uid)
    console.log('分类:', merchant.category?.name || '未分类')
    console.log('内容总数:', merchant._count.contents)
    console.log('状态:', merchant.status)

    console.log('\n=== 检查内容字段 ===')
    merchant.contents.forEach((content, i) => {
      console.log(`\n内容 ${i + 1}:`, content.title.substring(0, 40))
      console.log('  tags 类型:', typeof content.tags)
      console.log('  tags 值:', content.tags?.substring(0, 100))
      console.log('  textExtra 类型:', typeof content.textExtra)
      console.log('  textExtra 值:', content.textExtra?.substring(0, 100))

      // 尝试解析
      try {
        const parsedTags = JSON.parse(content.tags)
        console.log('  ✅ tags 解析成功:', Array.isArray(parsedTags) ? `${parsedTags.length}个标签` : typeof parsedTags)
      } catch (e) {
        console.log('  ❌ tags 解析失败:', (e as Error).message)
      }

      try {
        const parsedTextExtra = JSON.parse(content.textExtra)
        console.log('  ✅ textExtra 解析成功:', Array.isArray(parsedTextExtra) ? `${parsedTextExtra.length}项` : typeof parsedTextExtra)
      } catch (e) {
        console.log('  ❌ textExtra 解析失败:', (e as Error).message)
      }
    })

  } catch (error) {
    console.error('❌ 数据库查询错误:', error)
  }

  await prisma.$disconnect()
}

main()
