/**
 * 本地文件夹数据导入工具
 * 专门用于扫描和导入本地文件夹中的数据
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { importExternalResources, ImportConfig, ImportResult } from './external-resource-importer'

const prisma = new PrismaClient()

// 本地导入配置
export interface LocalImportConfig {
  userId: string                    // 导入用户ID
  sourceFolderPath: string         // 源文件夹路径
  categoryId?: string              // 分类ID
  importedFrom?: string            // 来源说明
  filePattern?: RegExp             // 文件过滤正则
  recursive?: boolean              // 是否递归扫描子文件夹
  maxDepth?: number               // 最大递归深度
  excludePatterns?: RegExp[]      // 排除的文件/文件夹模式
  createFolderCategories?: boolean // 是否为每个子文件夹创建分类
}

// 扫描结果
export interface ScanResult {
  totalFiles: number
  supportedFiles: FileInfo[]
  unsupportedFiles: string[]
  folderStructure: FolderInfo[]
}

export interface FileInfo {
  filePath: string
  fileName: string
  fileType: string
  fileSize: number
  relativePath: string
  folderName: string
  lastModified: Date
}

export interface FolderInfo {
  folderPath: string
  folderName: string
  fileCount: number
  hasSubfolders: boolean
  files: FileInfo[]
}

// 批量导入结果
export interface BatchImportResult {
  success: boolean
  totalFiles: number
  processedFiles: number
  successCount: number
  errorCount: number
  results: ImportResult[]
  categoryMapping: Map<string, string>
}

/**
 * 本地文件夹导入器
 */
export class LocalFolderImporter {
  private config: LocalImportConfig
  private supportedExtensions = ['.csv', '.json', '.xlsx', '.xls', '.txt', '.md', '.pdf', '.doc', '.docx']

  constructor(config: LocalImportConfig) {
    this.config = {
      recursive: true,
      maxDepth: 5,
      excludePatterns: [/node_modules/, /\.git/, /\.svn/, /temp/, /tmp/],
      createFolderCategories: true,
      ...config
    }
  }

  /**
   * 扫描文件夹
   */
  async scanFolder(): Promise<ScanResult> {
    if (!fs.existsSync(this.config.sourceFolderPath)) {
      throw new Error(`文件夹不存在: ${this.config.sourceFolderPath}`)
    }

    const result: ScanResult = {
      totalFiles: 0,
      supportedFiles: [],
      unsupportedFiles: [],
      folderStructure: []
    }

    await this.scanDirectory(this.config.sourceFolderPath, '', 0, result)

    return result
  }

  /**
   * 批量导入所有文件
   */
  async importAll(): Promise<BatchImportResult> {
    const scanResult = await this.scanFolder()
    
    if (scanResult.supportedFiles.length === 0) {
      return {
        success: true,
        totalFiles: scanResult.totalFiles,
        processedFiles: 0,
        successCount: 0,
        errorCount: 0,
        results: [],
        categoryMapping: new Map()
      }
    }

    const batchResult: BatchImportResult = {
      success: true,
      totalFiles: scanResult.totalFiles,
      processedFiles: 0,
      successCount: 0,
      errorCount: 0,
      results: [],
      categoryMapping: new Map()
    }

    // 创建文件夹分类映射
    if (this.config.createFolderCategories) {
      await this.createFolderCategories(scanResult.folderStructure, batchResult.categoryMapping)
    }

    // 按文件夹分组导入
    const filesByFolder = this.groupFilesByFolder(scanResult.supportedFiles)
    
    for (const [folderPath, files] of filesByFolder) {
      console.log(`正在处理文件夹: ${folderPath}, 文件数: ${files.length}`)
      
      const categoryId = batchResult.categoryMapping.get(folderPath) || this.config.categoryId

      for (const file of files) {
        try {
          const importConfig = this.createImportConfig(file, categoryId)
          const result = await importExternalResources(importConfig)
          
          batchResult.results.push(result)
          batchResult.processedFiles++
          
          if (result.success) {
            batchResult.successCount += result.successCount
            } else {
            batchResult.errorCount += result.errorCount
            }
          
          // 避免过快处理
          await this.delay(100)
          
        } catch (error) {
          batchResult.errorCount++
          }
      }
    }

    batchResult.success = batchResult.errorCount === 0
    
    return batchResult
  }

  /**
   * 按文件类型分别导入
   */
  async importByFileType(fileType: string): Promise<BatchImportResult> {
    const scanResult = await this.scanFolder()
    const filteredFiles = scanResult.supportedFiles.filter(f => f.fileType === fileType)
    
    // 使用过滤后的文件创建临时配置
    const tempConfig = { ...this.config }
    const originalScan = this.scanFolder
    this.scanFolder = async () => ({
      ...scanResult,
      supportedFiles: filteredFiles
    })
    
    const result = await this.importAll()
    this.scanFolder = originalScan
    
    return result
  }

  /**
   * 预览导入（不实际导入，只显示会导入什么）
   */
  async preview(): Promise<{
    scanResult: ScanResult
    importPlan: Array<{
      file: FileInfo
      categoryName?: string
      estimatedRecords: number
    }>
  }> {
    const scanResult = await this.scanFolder()
    const importPlan = []

    for (const file of scanResult.supportedFiles) {
      const estimatedRecords = await this.estimateRecords(file)
      const categoryName = this.config.createFolderCategories 
        ? this.getFolderName(file.relativePath)
        : undefined

      importPlan.push({
        file,
        categoryName,
        estimatedRecords
      })
    }

    return { scanResult, importPlan }
  }

  /**
   * 递归扫描目录
   */
  private async scanDirectory(
    dirPath: string,
    relativePath: string,
    depth: number,
    result: ScanResult
  ): Promise<void> {
    if (depth > (this.config.maxDepth || 5)) {
      return
    }

    // 检查是否应该排除这个目录
    if (this.shouldExclude(dirPath)) {
      return
    }

    const items = fs.readdirSync(dirPath)
    const folderInfo: FolderInfo = {
      folderPath: dirPath,
      folderName: path.basename(dirPath),
      fileCount: 0,
      hasSubfolders: false,
      files: []
    }

    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const itemRelativePath = path.join(relativePath, item)
      const stat = fs.statSync(itemPath)

      if (stat.isDirectory()) {
        folderInfo.hasSubfolders = true
        if (this.config.recursive) {
          await this.scanDirectory(itemPath, itemRelativePath, depth + 1, result)
        }
      } else if (stat.isFile()) {
        result.totalFiles++
        
        const fileInfo = this.createFileInfo(itemPath, itemRelativePath, stat)
        
        if (this.isSupportedFile(fileInfo)) {
          result.supportedFiles.push(fileInfo)
          folderInfo.files.push(fileInfo)
          folderInfo.fileCount++
        } else {
          result.unsupportedFiles.push(itemPath)
        }
      }
    }

    if (folderInfo.fileCount > 0 || folderInfo.hasSubfolders) {
      result.folderStructure.push(folderInfo)
    }
  }

  /**
   * 创建文件信息对象
   */
  private createFileInfo(filePath: string, relativePath: string, stat: fs.Stats): FileInfo {
    const ext = path.extname(filePath).toLowerCase()
    
    return {
      filePath,
      fileName: path.basename(filePath),
      fileType: this.getFileType(ext),
      fileSize: stat.size,
      relativePath,
      folderName: path.dirname(relativePath) || '根目录',
      lastModified: stat.mtime
    }
  }

  /**
   * 判断文件类型
   */
  private getFileType(extension: string): string {
    const typeMap: Record<string, string> = {
      '.csv': 'csv',
      '.json': 'json',
      '.xlsx': 'excel',
      '.xls': 'excel',
      '.txt': 'txt',
      '.md': 'md',
      '.pdf': 'pdf',
      '.doc': 'doc',
      '.docx': 'docx'
    }
    return typeMap[extension] || 'unknown'
  }

  /**
   * 检查是否为支持的文件
   */
  private isSupportedFile(file: FileInfo): boolean {
    const ext = path.extname(file.filePath).toLowerCase()
    const isSupported = this.supportedExtensions.includes(ext)
    
    if (this.config.filePattern) {
      return isSupported && this.config.filePattern.test(file.fileName)
    }
    
    return isSupported
  }

  /**
   * 检查是否应该排除
   */
  private shouldExclude(itemPath: string): boolean {
    if (!this.config.excludePatterns) return false
    
    return this.config.excludePatterns.some(pattern => 
      pattern.test(itemPath) || pattern.test(path.basename(itemPath))
    )
  }

  /**
   * 按文件夹分组文件
   */
  private groupFilesByFolder(files: FileInfo[]): Map<string, FileInfo[]> {
    const groups = new Map<string, FileInfo[]>()
    
    for (const file of files) {
      const folderPath = path.dirname(file.filePath)
      if (!groups.has(folderPath)) {
        groups.set(folderPath, [])
      }
      groups.get(folderPath)!.push(file)
    }
    
    return groups
  }

  /**
   * 创建文件夹分类
   */
  private async createFolderCategories(
    folders: FolderInfo[],
    categoryMapping: Map<string, string>
  ): Promise<void> {
    for (const folder of folders) {
      if (folder.fileCount === 0) continue

      const categoryName = this.getFolderName(folder.folderPath)
      
      try {
        // 检查分类是否已存在
        let category = await prisma.documentCategory.findUnique({
          where: { name: categoryName }
        })

        // 如果不存在则创建
        if (!category) {
          category = await prisma.documentCategory.create({
            data: {
              name: categoryName,
              description: `从 ${folder.folderPath} 导入`,
              color: this.generateFolderColor(categoryName)
            }
          })
        }

        categoryMapping.set(folder.folderPath, category.id)
      } catch (error) {
        }
    }
  }

  /**
   * 获取文件夹名称
   */
  private getFolderName(folderPath: string): string {
    const baseName = path.basename(folderPath)
    const relativePath = path.relative(this.config.sourceFolderPath, folderPath)
    
    return relativePath || baseName || '根目录'
  }

  /**
   * 生成文件夹颜色
   */
  private generateFolderColor(folderName: string): string {
    const colors = [
      '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
      '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308',
      '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4'
    ]
    
    const hash = folderName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    return colors[Math.abs(hash) % colors.length]
  }

  /**
   * 创建导入配置
   */
  private createImportConfig(file: FileInfo, categoryId?: string): ImportConfig {
    return {
      userId: this.config.userId,
      filePath: file.filePath,
      fileType: file.fileType as any,
      categoryId,
      source: 'IMPORTED',
      importedFrom: this.config.importedFrom || `本地文件夹: ${this.config.sourceFolderPath}`,
      mapping: this.getDefaultMapping(file.fileType),
      options: {
        skipFirstRow: ['csv', 'excel'].includes(file.fileType),
        updateExisting: true,
        chunkSize: 50
      }
    }
  }

  /**
   * 获取默认字段映射
   */
  private getDefaultMapping(fileType: string) {
    switch (fileType) {
      case 'csv':
      case 'excel':
        return {
          title: '标题',
          content: '内容',
          excerpt: '摘要',
          tags: '标签'
        }
      case 'json':
        return {
          title: 'title',
          content: 'content',
          excerpt: 'excerpt',
          tags: 'tags'
        }
      default:
        return {
          title: 'title',
          content: 'content'
        }
    }
  }

  /**
   * 估算记录数量
   */
  private async estimateRecords(file: FileInfo): Promise<number> {
    try {
      switch (file.fileType) {
        case 'csv':
          const csvContent = fs.readFileSync(file.filePath, 'utf8')
          return Math.max(0, csvContent.split('\n').length - 1)
        
        case 'json':
          const jsonContent = fs.readFileSync(file.filePath, 'utf8')
          const data = JSON.parse(jsonContent)
          return Array.isArray(data) ? data.length : 1
        
        case 'txt':
        case 'md':
          const textContent = fs.readFileSync(file.filePath, 'utf8')
          return Math.max(1, textContent.split('\n\n').length)
        
        default:
          return 1
      }
    } catch {
      return 1
    }
  }

  /**
   * 延时函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * 便捷函数：快速导入本地文件夹
 */
export async function importLocalFolder(
  userId: string,
  sourceFolderPath: string,
  options?: Partial<LocalImportConfig>
): Promise<BatchImportResult> {
  const importer = new LocalFolderImporter({
    userId,
    sourceFolderPath,
    ...options
  })
  
  return await importer.importAll()
}

/**
 * 便捷函数：预览本地文件夹
 */
export async function previewLocalFolder(
  userId: string,
  sourceFolderPath: string,
  options?: Partial<LocalImportConfig>
) {
  const importer = new LocalFolderImporter({
    userId,
    sourceFolderPath,
    ...options
  })
  
  return await importer.preview()
}

export default LocalFolderImporter