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
      console.log(`\n${index + 1}. 商家: ${content.merchant.name}`)
      console.log(`   内容: ${content.title.substring(0, 50)}...`)
      console.log(`   标签: ${content.tags}`)
      
      // 尝试不同的解析方法
      // 方法1: 直接JSON.parse
      try {
        const parsed1 = JSON.parse(content.tags || '[]')
        console.log(`   方法1成功: ${JSON.stringify(parsed1)}`)
      } catch (error) {
        console.log(`   方法1失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
      
      // 方法2: 清理单引号后解析
      try {
        const cleaned = (content.tags || '[]').replace(/'/g, '"')
        const parsed2 = JSON.parse(cleaned)
        console.log(`   方法2成功: ${JSON.stringify(parsed2)}`)
      } catch (error) {
        console.log(`   方法2失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
      
      // 方法3: 使用eval (不安全，仅用于调试)
      try {
        const evalResult = eval(content.tags || '[]')
        console.log(`   方法3成功: ${JSON.stringify(evalResult)}`)
      } catch (error) {
        console.log(`   方法3失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    })
    
  } catch (error) {
    console.error('检查标签格式时出错:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTagsFormat()