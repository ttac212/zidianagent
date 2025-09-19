/**
 * 检查标签数据格式
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTagsFormat() {
  try {
    // 获取一些包含标签的内容
    const contents = await prisma.merchantContent.findMany({
      where: {
        tags: {
          not: '[]'
        }
      },
      take: 5,
      select: {
        id: true,
        title: true,
        tags: true,
        textExtra: true,
        merchant: {
          select: {
            name: true
          }
        }
      }
    })

    contents.forEach((content, index) => {
      console.log(`\n=== 内容 ${index + 1}: ${content.title.slice(0, 30)}...`)
      // 尝试不同的解析方法
      // 方法1: 直接JSON.parse
      try {
        const parsed1 = JSON.parse(content.tags || '[]')
        console.log(`  JSON.parse成功: ${JSON.stringify(parsed1)}`)
      } catch (error) {
        console.log(`  JSON.parse失败: ${(error as Error).message}`)
      }
      
      // 方法2: 清理单引号后解析
      try {
        const cleaned = (content.tags || '[]').replace(/'/g, '"')
        const parsed2 = JSON.parse(cleaned)
        console.log(`  清理后解析成功: ${JSON.stringify(parsed2)}`)
      } catch (error) {
        console.log(`  清理后解析失败: ${(error as Error).message}`)
      }
      
      // 方法3: 使用eval (不安全，仅用于调试)
      try {
        const evalResult = eval(content.tags || '[]')
        console.log(`  eval解析成功: ${JSON.stringify(evalResult)}`)
      } catch (error) {
        console.log(`  eval解析失败: ${(error as Error).message}`)
      }
    })
    
  } catch (error) {
    console.error('检查标签格式时出错:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTagsFormat()