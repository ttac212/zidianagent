/**
 * 健壮的标签解析工具
 * 处理各种可能的标签数据格式
 */

/**
 * 安全解析标签数据
 * @param tagString - 标签字符串数据
 * @returns 解析后的标签数组
 */
export function parseTagsSafely(tagString: string | null | undefined): string[] {
  if (!tagString || tagString.trim() === '') {
    return []
  }

  try {
    // 尝试直接JSON解析
    return JSON.parse(tagString)
  } catch (error) {
    try {
      // 方法2: 将Python风格的数组转换为JSON格式
      let cleaned = tagString.trim()
      
      // 如果是数组格式，处理单引号
      if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
        // 替换单引号为双引号，但要小心字符串内部的单引号
        cleaned = cleaned.replace(/'/g, '"')
        return JSON.parse(cleaned)
      }
      
      // 方法3: 处理逗号分隔的字符串
      if (cleaned.includes(',') && !cleaned.startsWith('[')) {
        return cleaned.split(',').map(tag => tag.trim().replace(/['"]/g, ''))
      }
      
      // 方法4: 单个标签
      if (!cleaned.startsWith('[')) {
        return [cleaned.replace(/['"]/g, '')]
      }
      
      return []
    } catch (secondError) {
      return []
    }
  }
}

/**
 * 清理和标准化标签
 * @param tags - 标签数组
 * @returns 清理后的标签数组
 */
export function cleanTags(tags: string[]): string[] {
  return tags
    .filter(tag => typeof tag === 'string' && tag.trim() !== '')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0 && tag.length <= 50) // 过滤过长的标签
    .slice(0, 20) // 限制标签数量
}

/**
 * 解析和清理标签的组合函数
 * @param tagString - 标签字符串数据
 * @returns 清理后的标签数组
 */
export function parseAndCleanTags(tagString: string | null | undefined): string[] {
  const parsed = parseTagsSafely(tagString)
  return cleanTags(parsed)
}