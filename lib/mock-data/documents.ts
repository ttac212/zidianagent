import * as dt from '@/lib/utils/date-toolkit'

/**
 * 简单的模拟文档数据
 * 修复构建错误
 */

export function generateMockDocuments() {
  return [
    {
      id: '1',
      title: '示例文档',
      content: '这是一个示例文档',
      category: 'general',
      createdAt: dt.toISO(),
      updatedAt: dt.toISO()
    }
  ]
}