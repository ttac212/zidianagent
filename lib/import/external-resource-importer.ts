/**
 * 外部资料导入工具
 * 支持多种格式的外部资料导入到数据库
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { parse as csvParse } from 'csv-parse/sync'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

// 支持的文件类型
export type SupportedFileType = 'csv' | 'json' | 'excel' | 'txt' | 'md'

// 导入配置接口
export interface ImportConfig {
  userId: string                    // 导入用户ID
  filePath: string                 // 文件路径
  fileType: SupportedFileType      // 文件类型
  categoryId?: string              // 分类ID
  source: 'IMPORTED' | 'UPLOADED'  // 导入来源
  importedFrom?: string            // 来源系统名称
  mapping?: ColumnMapping          // 字段映射配置
  options?: ImportOptions          // 导入选项
}

// 字段映射配置
export interface ColumnMapping {
  title: string      // 标题字段名
  content: string    // 内容字段名
  excerpt?: string   // 摘要字段名
  tags?: string      // 标签字段名
  externalId?: string // 外部ID字段名
}

// 导入选项
export interface ImportOptions {
  skipFirstRow?: boolean    // 跳过第一行（CSV/Excel）
  delimiter?: string        // CSV分隔符
  encoding?: string         // 文件编码
  chunkSize?: number        // 批量处理大小
  updateExisting?: boolean  // 是否更新已存在的记录
}

// 导入结果
export interface ImportResult {
  success: boolean
  totalRecords: number
  successCount: number
  errorCount: number
  errors: ImportError[]
  importedDocumentIds: string[]
}

export interface ImportError {
  row: number
  message: string
  data?: any
}

/**
 * 外部资源导入器类
 */
export class ExternalResourceImporter {
  private config: ImportConfig
  private defaultOptions: ImportOptions = {
    skipFirstRow: true,
    delimiter: ',',
    encoding: 'utf-8',
    chunkSize: 100,
    updateExisting: false
  }

  constructor(config: ImportConfig) {
    this.config = {
      ...config,
      options: { ...this.defaultOptions, ...config.options }
    }
  }

  /**
   * 执行导入
   */
  async import(): Promise<ImportResult> {
    try {
      const fileContent = await this.readFile()
      const records = await this.parseFile(fileContent)
      return await this.importRecords(records)
    } catch (error) {
      return {
        success: false,
        totalRecords: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ row: 0, message: error instanceof Error ? error.message : '导入失败' }],
        importedDocumentIds: []
      }
    }
  }

  /**
   * 读取文件内容
   */
  private async readFile(): Promise<string | Buffer> {
    if (!fs.existsSync(this.config.filePath)) {
      throw new Error(`文件不存在: ${this.config.filePath}`)
    }

    const stats = fs.statSync(this.config.filePath)
    if (stats.size > 50 * 1024 * 1024) { // 50MB 限制
      throw new Error('文件大小超过50MB限制')
    }

    return fs.readFileSync(this.config.filePath)
  }

  /**
   * 解析文件内容
   */
  private async parseFile(content: string | Buffer): Promise<any[]> {
    switch (this.config.fileType) {
      case 'csv':
        return this.parseCsv(content.toString())
      case 'json':
        return this.parseJson(content.toString())
      case 'excel':
        return this.parseExcel(content as Buffer)
      case 'txt':
      case 'md':
        return this.parseText(content.toString())
      default:
        throw new Error(`不支持的文件类型: ${this.config.fileType}`)
    }
  }

  /**
   * 解析CSV文件
   */
  private parseCsv(content: string): any[] {
    try {
      const records = csvParse(content, {
        delimiter: this.config.options?.delimiter || ',',
        skip_empty_lines: true,
        trim: true,
        columns: !this.config.options?.skipFirstRow
      })

      if (this.config.options?.skipFirstRow && records.length > 0) {
        return records.slice(1)
      }

      return records
    } catch (error) {
      throw new Error(`CSV解析失败: ${error}`)
    }
  }

  /**
   * 解析JSON文件
   */
  private parseJson(content: string): any[] {
    try {
      const data = JSON.parse(content)
      return Array.isArray(data) ? data : [data]
    } catch (error) {
      throw new Error(`JSON解析失败: ${error}`)
    }
  }

  /**
   * 解析Excel文件
   */
  private parseExcel(buffer: Buffer): any[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      const records = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: ''
      })

      return records
    } catch (error) {
      throw new Error(`Excel解析失败: ${error}`)
    }
  }

  /**
   * 解析文本文件
   */
  private parseText(content: string): any[] {
    // 简单的文本文件处理，每行作为一个记录
    const lines = content.split('\n').filter(line => line.trim())
    return lines.map((line, index) => ({
      title: `导入文档 ${index + 1}`,
      content: line.trim()
    }))
  }

  /**
   * 导入记录到数据库
   */
  private async importRecords(records: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      totalRecords: records.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      importedDocumentIds: []
    }

    const chunkSize = this.config.options?.chunkSize || 100
    const chunks = this.chunkArray(records, chunkSize)

    for (const chunk of chunks) {
      await this.processChunk(chunk, result)
    }

    result.success = result.errorCount === 0
    return result
  }

  /**
   * 处理数据块
   */
  private async processChunk(chunk: any[], result: ImportResult): Promise<void> {
    for (let i = 0; i < chunk.length; i++) {
      try {
        const record = chunk[i]
        const document = await this.createDocument(record)
        
        result.successCount++
        result.importedDocumentIds.push(document.id)
      } catch (error) {
        result.errorCount++
        result.errors.push({
          row: result.successCount + result.errorCount,
          message: error instanceof Error ? error.message : '创建文档失败',
          data: chunk[i]
        })
      }
    }
  }

  /**
   * 创建文档记录
   */
  private async createDocument(record: any) {
    const mapping = this.config.mapping
    if (!mapping) {
      throw new Error('缺少字段映射配置')
    }

    const title = record[mapping.title] || '未命名文档'
    const content = record[mapping.content] || ''
    const excerpt = mapping.excerpt ? record[mapping.excerpt] : this.generateExcerpt(content)
    const tags = mapping.tags ? this.parseTags(record[mapping.tags]) : '[]'
    const externalId = mapping.externalId ? record[mapping.externalId] : null

    // 检查是否已存在相同的外部ID记录
    if (externalId && this.config.options?.updateExisting) {
      const existing = await prisma.document.findFirst({
        where: {
          externalId: externalId.toString(),
          source: this.config.source
        }
      })

      if (existing) {
        return await prisma.document.update({
          where: { id: existing.id },
          data: {
            title,
            content,
            excerpt,
            tags,
            lastSyncAt: new Date(),
            syncStatus: 'SYNCED',
            updatedAt: new Date()
          }
        })
      }
    }

    return await prisma.document.create({
      data: {
        title,
        content,
        excerpt,
        tags,
        source: this.config.source,
        externalId: externalId?.toString(),
        importedFrom: this.config.importedFrom,
        categoryId: this.config.categoryId,
        userId: this.config.userId,
        syncStatus: 'SYNCED',
        lastSyncAt: new Date(),
        wordCount: this.calculateWordCount(content),
        readTime: this.calculateReadTime(content)
      }
    })
  }

  /**
   * 生成摘要
   */
  private generateExcerpt(content: string, maxLength: number = 200): string {
    if (!content) return ''
    return content.length > maxLength 
      ? content.substring(0, maxLength) + '...' 
      : content
  }

  /**
   * 解析标签
   */
  private parseTags(tagsStr: string): string {
    if (!tagsStr) return '[]'
    
    try {
      // 尝试解析JSON格式
      if (tagsStr.startsWith('[') || tagsStr.startsWith('{')) {
        return JSON.stringify(JSON.parse(tagsStr))
      }
      
      // 分割逗号分隔的标签
      const tags = tagsStr.split(',').map(tag => tag.trim()).filter(Boolean)
      return JSON.stringify(tags)
    } catch {
      return JSON.stringify([tagsStr])
    }
  }

  /**
   * 计算字数
   */
  private calculateWordCount(content: string): number {
    return content.replace(/\s+/g, ' ').trim().split(' ').length
  }

  /**
   * 计算阅读时间（分钟）
   */
  private calculateReadTime(content: string): number {
    const wordsPerMinute = 200
    const wordCount = this.calculateWordCount(content)
    return Math.ceil(wordCount / wordsPerMinute)
  }

  /**
   * 数组分块
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }
}

/**
 * 便捷导入函数
 */
export async function importExternalResources(config: ImportConfig): Promise<ImportResult> {
  const importer = new ExternalResourceImporter(config)
  return await importer.import()
}

/**
 * 从URL导入资源
 */
export async function importFromUrl(
  userId: string,
  url: string,
  categoryId?: string,
  importedFrom?: string
): Promise<ImportResult> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    const content = await response.text()
    
    // 创建临时文件
    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const tempFile = path.join(tempDir, `import-${Date.now()}.txt`)
    fs.writeFileSync(tempFile, content)

    try {
      const result = await importExternalResources({
        userId,
        filePath: tempFile,
        fileType: 'txt',
        categoryId,
        source: 'IMPORTED',
        importedFrom: importedFrom || url,
        mapping: {
          title: 'title',
          content: 'content'
        }
      })

      return result
    } finally {
      // 清理临时文件
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  } catch (error) {
    return {
      success: false,
      totalRecords: 0,
      successCount: 0,
      errorCount: 1,
      errors: [{ row: 0, message: error instanceof Error ? error.message : '导入失败' }],
      importedDocumentIds: []
    }
  }
}

export default ExternalResourceImporter