/**
 * 外部资源导入API端点
 * POST /api/import/external-resources
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { importExternalResources } from '../../../../lib/import/external-resource-importer'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      )
    }

    // 解析表单数据
    const formData = await request.formData()
    const file = formData.get('file') as File
    const categoryId = formData.get('categoryId') as string
    const importedFrom = formData.get('importedFrom') as string
    const fileType = formData.get('fileType') as string
    const mapping = formData.get('mapping') as string

    if (!file) {
      return NextResponse.json(
        { error: '未找到上传文件' },
        { status: 400 }
      )
    }

    // 验证文件大小 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: '文件大小不能超过50MB' },
        { status: 400 }
      )
    }

    // 验证文件类型
    const allowedTypes = ['csv', 'json', 'txt', 'md']
    const detectedType = fileType || getFileTypeFromName(file.name)
    
    if (!allowedTypes.includes(detectedType)) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${detectedType}` },
        { status: 400 }
      )
    }

    // 创建临时目录
    const tempDir = path.join(process.cwd(), 'temp')
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    // 保存临时文件
    const tempFilePath = path.join(tempDir, `import-${Date.now()}-${file.name}`)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(tempFilePath, buffer)

    try {
      // 解析字段映射
      let parsedMapping
      try {
        parsedMapping = mapping ? JSON.parse(mapping) : getDefaultMapping(detectedType)
      } catch {
        return NextResponse.json(
          { error: '字段映射配置格式错误' },
          { status: 400 }
        )
      }

      // 执行导入
      const result = await importExternalResources({
        userId: session.user.id,
        filePath: tempFilePath,
        fileType: detectedType as any,
        categoryId: categoryId || undefined,
        source: 'UPLOADED',
        importedFrom: importedFrom || file.name,
        mapping: parsedMapping,
        options: {
          skipFirstRow: detectedType === 'csv' || detectedType === 'excel',
          updateExisting: true,
          chunkSize: 50
        }
      })

      return NextResponse.json({
        success: true,
        data: result
      })

    } finally {
      // 清理临时文件
      try {
        const fs = await import('fs')
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath)
        }
      } catch (error) {
        void error
        }
    }

  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '导入失败',
        success: false
      },
      { status: 500 }
    )
  }
}

/**
 * 从文件名推断文件类型
 */
function getFileTypeFromName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  
  switch (ext) {
    case '.csv':
      return 'csv'
    case '.json':
      return 'json'
    case '.xlsx':
    case '.xls':
      return 'excel'
    case '.md':
      return 'md'
    case '.txt':
    default:
      return 'txt'
  }
}

/**
 * 获取默认字段映射
 */
function getDefaultMapping(fileType: string) {
  switch (fileType) {
    case 'csv':
    case 'excel':
      return {
        title: '标题',
        content: '内容',
        excerpt: '摘要',
        tags: '标签',
        externalId: 'ID'
      }
    
    case 'json':
      return {
        title: 'title',
        content: 'content',
        excerpt: 'excerpt',
        tags: 'tags',
        externalId: 'id'
      }
    
    default:
      return {
        title: 'title',
        content: 'content'
      }
  }
}

// 支持的HTTP方法
export const runtime = 'nodejs'