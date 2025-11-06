/**
 * 测试商家详情 API 的 BigInt 序列化修复
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const merchantId = 'cmhd5q5du000pwtcc94pzs7n0'

async function testMerchantDetail() {
  console.log('🔍 测试商家详情查询和序列化\n')

  try {
    // 模拟 API 的查询逻辑
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        category: true,
        contents: {
          orderBy: {
            publishedAt: 'desc'
          },
          take: 3
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

    console.log('✅ 商家查询成功')
    console.log('名称:', merchant.name)
    console.log('内容数:', merchant._count.contents)
    console.log('totalPlayCount 类型:', typeof merchant.totalPlayCount)
    console.log('totalPlayCount 值:', merchant.totalPlayCount)

    // 测试 JSON 序列化
    console.log('\n📦 测试 JSON 序列化...')

    try {
      // 这会失败，因为 BigInt 不能直接序列化
      JSON.stringify(merchant)
      console.log('❌ 直接序列化应该失败但却成功了')
    } catch (error) {
      console.log('✅ 预期失败:', (error as Error).message)
    }

    // 测试转换后的序列化
    console.log('\n🔧 测试 BigInt 转换...')

    function convertBigIntsToStrings<T>(obj: T): T {
      if (obj === null || obj === undefined) {
        return obj
      }

      if (typeof obj === 'bigint') {
        return String(obj) as unknown as T
      }

      if (Array.isArray(obj)) {
        return obj.map(item => convertBigIntsToStrings(item)) as unknown as T
      }

      if (typeof obj === 'object') {
        const converted: any = {}
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            converted[key] = convertBigIntsToStrings(obj[key])
          }
        }
        return converted as T
      }

      return obj
    }

    const converted = convertBigIntsToStrings(merchant)
    const json = JSON.stringify(converted)

    console.log('✅ 转换后序列化成功')
    console.log('JSON 大小:', json.length, '字符')
    console.log('totalPlayCount (转换后):', converted.totalPlayCount, typeof converted.totalPlayCount)

    console.log('\n✅ 所有测试通过！')

  } catch (error) {
    console.error('❌ 测试失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testMerchantDetail()
