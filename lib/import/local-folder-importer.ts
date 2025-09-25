/**
 * 本地文件夹导入器 - 占位实现
 * 注意：Document 和 DocumentCategory 模型尚未在数据库中实现
 */

import { ImportConfig, ImportResult } from './external-resource-importer'

export interface LocalImportConfig {
  userId: string
  folderPath?: string
  sourceFolderPath?: string  // 兼容别名
  recursive?: boolean
  maxDepth?: number
  excludePatterns?: RegExp[]
  createFolderCategories?: boolean
  importedFrom?: string
  filePattern?: RegExp
}

export interface ScanResult {
  totalFiles: number
  supportedFiles: any[]
  unsupportedFiles: any[]
  errors: string[]
}

export interface BatchImportResult {
  success: boolean
  totalFiles: number
  processedFiles: number
  successCount: number
  errorCount: number
  results: ImportResult[]
  categoryMapping: Map<string, string>
}

export class LocalFolderImporter {
  constructor(_config: LocalImportConfig) {
    // 占位实现
  }

  async scanFolder(): Promise<ScanResult> {
    throw new Error('文档导入功能尚未实现：Document 和 DocumentCategory 模型不存在')
  }

  async import(): Promise<BatchImportResult> {
    throw new Error('文档导入功能尚未实现：Document 和 DocumentCategory 模型不存在')
  }

  async importAll(): Promise<BatchImportResult> {
    throw new Error('文档导入功能尚未实现：Document 和 DocumentCategory 模型不存在')
  }

  async importByFileType(_fileType: string): Promise<BatchImportResult> {
    throw new Error('文档导入功能尚未实现：Document 和 DocumentCategory 模型不存在')
  }

  async preview(): Promise<any> {
    throw new Error('文档导入功能尚未实现：Document 和 DocumentCategory 模型不存在')
  }
}

// 导出兼容性函数
export async function importFromLocalFolder(_config: LocalImportConfig): Promise<BatchImportResult> {
  throw new Error('文档导入功能尚未实现：Document 和 DocumentCategory 模型不存在')
}

export async function importLocalFolder(_config: LocalImportConfig): Promise<BatchImportResult> {
  throw new Error('文档导入功能尚未实现：Document 和 DocumentCategory 模型不存在')
}

export async function previewLocalFolder(_config: LocalImportConfig): Promise<any> {
  throw new Error('文档导入功能尚未实现：Document 和 DocumentCategory 模型不存在')
}

export default LocalFolderImporter