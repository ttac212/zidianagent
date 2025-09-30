/**
 * 本地文件夹批量导入脚本
 * 使用方法：pnpm tsx scripts/import-local-folder.ts
 */

import { LocalFolderImporter } from '../lib/import/local-folder-importer'
import { PrismaClient } from '@prisma/client'
import path from 'path'

const prisma = new PrismaClient()

// 配置区域 - 请根据你的实际情况修改
const CONFIG = {
  // 👇 修改为你的实际文件夹路径
  SOURCE_FOLDER: 'D:\\你的数据文件夹',  // 替换为你的实际路径
  
  // 👇 替换为你的实际用户ID (从数据库中查询)
  USER_ID: 'your-user-id-here',
  
  // 其他选项
  PREVIEW_ONLY: false,        // 设为 true 仅预览不导入
  CREATE_CATEGORIES: true,    // 是否为每个子文件夹创建分类
  RECURSIVE: true,           // 是否递归扫描子文件夹
  MAX_DEPTH: 5              // 最大递归深度
}

async function main() {
  try {
    // 验证用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: CONFIG.USER_ID }
    })

    if (!user) {
      return
    }

    // 创建导入器实例
    const importer = new LocalFolderImporter({
      userId: CONFIG.USER_ID,
      sourceFolderPath: CONFIG.SOURCE_FOLDER,
      recursive: CONFIG.RECURSIVE,
      maxDepth: CONFIG.MAX_DEPTH,
      createFolderCategories: CONFIG.CREATE_CATEGORIES,
      importedFrom: `本地文件夹导入: ${path.basename(CONFIG.SOURCE_FOLDER)}`,
      
      // 文件过滤 (可选)
      // filePattern: /\.(csv|json|txt|md)$/i,  // 只导入特定格式
      
      // 排除模式 (可选)
      excludePatterns: [
        /node_modules/,
        /\.git/,
        /\.svn/,
        /temp/,
        /tmp/,
        /cache/,
        /\.DS_Store/,
        /thumbs\.db/i
      ]
    })

    if (CONFIG.PREVIEW_ONLY) {
      // 仅预览模式
      const preview = await importer.preview()
      
      preview.importPlan.forEach((plan: any, index: number) => {
        if (plan.categoryName) {
          }
        })
      
    } else {
      // 正式导入模式
      const result = await importer.importAll()
      
      console.info(`导入完成! 成功: ${result.successCount}, 失败: ${result.errorCount}, 成功率: ${result.successCount > 0 ? ((result.successCount / (result.successCount + result.errorCount)) * 100).toFixed(1) : 0}%)`)
      
      if (result.categoryMapping.size > 0) {
        for (const [folder, categoryId] of result.categoryMapping) {
          // DocumentCategory 模型不存在，跳过分类查询
          // const category = await prisma.documentCategory.findUnique({
          //   where: { id: categoryId }
          // })
          console.info(`  文件夹 "${folder}" 映射到分类: ID=${categoryId}`)
        }
      }
      
      // 显示错误详情
      if (result.errorCount > 0) {
        result.results.forEach((fileResult, index) => {
          if (!fileResult.success && fileResult.errors.length > 0) {
            console.info(`  文件 ${index + 1} 导入失败:`)
            fileResult.errors.forEach((error: any) => {
              console.info(`    ${typeof error === 'string' ? error : error.message || JSON.stringify(error)}`)
            })
          }
        })
      }
    }

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.error('错误: 指定的文件夹不存在')
      } else if (error.message.includes('permission')) {
        console.error('错误: 权限不足，无法访问文件夹')
      } else {
        console.error('导入过程中出错:', error.message)
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main()
}

export { main as importLocalFolderScript }