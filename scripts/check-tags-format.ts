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
        textExtra: true
      }
    })

    contents.forEach((content, index) => {
      }...`)
      // 尝试不同的解析方法
      // 方法1: 直接JSON.parse
      try {
        const parsed1 = JSON.parse(content.tags || '[]')
        }`)
      } catch (error) {
        }
      
      // 方法2: 清理单引号后解析
      try {
        const cleaned = (content.tags || '[]').replace(/'/g, '"')
        const parsed2 = JSON.parse(cleaned)
        }`)
      } catch (error) {
        }
      
      // 方法3: 使用eval (不安全，仅用于调试)
      try {
        const evalResult = eval(content.tags || '[]')
        }`)
      } catch (error) {
        }
      
      })
    
    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

checkTagsFormat()