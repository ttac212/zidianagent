/**
 * 外部资料导入工具 - 占位实现
 * 注意：Document 模型尚未在数据库中实现
 */

export type SupportedFileType = 'csv' | 'json' | 'excel' | 'txt' | 'md'

export interface ImportConfig {
  userId: string
  filePath: string
  fileType: SupportedFileType
  categoryId?: string
  source: 'IMPORTED' | 'UPLOADED'
  importedFrom?: string
  mapping?: any
  options?: any
}

export interface ImportResult {
  success: boolean
  imported: number
  failed: number
  errors: string[]
  documents?: any[]
  successCount?: number  // 兼容 local-folder-importer
  errorCount?: number    // 兼容 local-folder-importer
}

export class ExternalResourceImporter {
  constructor(_config: ImportConfig) {
    throw new Error('文档导入功能尚未实现：Document 模型不存在于数据库架构中')
  }

  async import(): Promise<ImportResult> {
    throw new Error('文档导入功能尚未实现')
  }

  async validateFile(): Promise<boolean> {
    return false
  }

  static getSupportedTypes(): SupportedFileType[] {
    return ['csv', 'json', 'excel', 'txt', 'md']
  }
}

// 导出兼容性函数
export async function importExternalResources(_config: ImportConfig): Promise<ImportResult> {
  throw new Error('文档导入功能尚未实现：Document 模型不存在于数据库架构中')
}

export async function importFromUrl(_userId: string, _url: string, _categoryId?: string, _source?: string): Promise<ImportResult> {
  throw new Error('文档导入功能尚未实现：Document 模型不存在于数据库架构中')
}

export default ExternalResourceImporter