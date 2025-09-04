/**
 * 外部资料导入脚本
 * 使用方法：pnpm tsx scripts/import-external-resources.ts
 */

import { importExternalResources, importFromUrl } from '../lib/import/external-resource-importer'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // 示例1: 从CSV文件导入
    const csvResult = await importExternalResources({
      userId: 'your-user-id', // 替换为实际用户ID
      filePath: './data/external-resources.csv',
      fileType: 'csv',
      source: 'IMPORTED',
      importedFrom: '外部CSV文件',
      mapping: {
        title: '标题',      // CSV列名
        content: '内容',    // CSV列名
        excerpt: '摘要',    // CSV列名（可选）
        tags: '标签',       // CSV列名（可选）
        externalId: 'ID'   // CSV列名（可选）
      },
      options: {
        skipFirstRow: true,
        updateExisting: true
      }
    })

    // 示例2: 从JSON文件导入
    const jsonResult = await importExternalResources({
      userId: 'your-user-id', // 替换为实际用户ID
      filePath: './data/external-resources.json',
      fileType: 'json',
      source: 'IMPORTED',
      importedFrom: '外部JSON文件',
      mapping: {
        title: 'title',
        content: 'content',
        excerpt: 'summary',
        tags: 'tags',
        externalId: 'id'
      }
    })

    // 示例3: 从URL导入
    const urlResult = await importFromUrl(
      'your-user-id', // 替换为实际用户ID
      'https://example.com/api/articles',
      undefined, // categoryId
      'External API'
    )

    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main()
}

export { main as importScript }