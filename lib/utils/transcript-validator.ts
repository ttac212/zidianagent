/**
 * 转录文本验证工具
 *
 * 用途：检测转录文本是否有效，识别错误信息
 */

/**
 * 转录状态枚举
 */
export enum TranscriptStatus {
  VALID = 'valid',           // 有效的转录文本
  MISSING = 'missing',       // 缺失转录
  INVALID = 'invalid',       // 无效（包含错误信息）
  TOO_SHORT = 'too_short'    // 过短（可能不完整）
}

/**
 * 转录检测结果
 */
export interface TranscriptValidation {
  status: TranscriptStatus
  isValid: boolean
  reason?: string
  needsTranscription: boolean
}

/**
 * 错误文本特征（用于识别转录失败）
 */
const ERROR_PATTERNS = [
  // 常见错误提示
  '对不起，我无法处理',
  '系统错误',
  '转录失败',
  '无法获取',
  '请稍后重试',

  // 英文错误
  'error',
  'failed',
  'unable to process',
  'sorry',

  // ASR服务特定错误
  '音频内容',
  '文字方面的帮助',
  '如果您有其他问题'
]

/**
 * 最小有效长度（字符数）
 */
const MIN_VALID_LENGTH = 10

/**
 * 验证单个转录文本
 *
 * @param transcript 转录文本
 * @returns 验证结果
 */
export function validateTranscript(transcript: string | null | undefined): TranscriptValidation {
  // 1. 检查是否缺失
  if (!transcript) {
    return {
      status: TranscriptStatus.MISSING,
      isValid: false,
      reason: '转录文本缺失',
      needsTranscription: true
    }
  }

  // 2. 检查长度
  const trimmed = transcript.trim()
  if (trimmed.length < MIN_VALID_LENGTH) {
    return {
      status: TranscriptStatus.TOO_SHORT,
      isValid: false,
      reason: `转录文本过短（${trimmed.length}字符，最少需要${MIN_VALID_LENGTH}字符）`,
      needsTranscription: true
    }
  }

  // 3. 检查是否包含错误关键词
  const lowerCaseText = trimmed.toLowerCase()
  for (const pattern of ERROR_PATTERNS) {
    if (lowerCaseText.includes(pattern.toLowerCase())) {
      return {
        status: TranscriptStatus.INVALID,
        isValid: false,
        reason: `转录文本包含错误信息（匹配到"${pattern}"）`,
        needsTranscription: true
      }
    }
  }

  // 4. 全部通过，视为有效
  return {
    status: TranscriptStatus.VALID,
    isValid: true,
    needsTranscription: false
  }
}

/**
 * 批量验证转录状态
 *
 * @param contents 内容列表（需包含 id, transcript 字段）
 * @returns 验证结果汇总
 */
export function validateTranscriptsBatch(contents: Array<{ id: string; transcript: string | null; title?: string }>) {
  const results = contents.map(content => ({
    id: content.id,
    title: content.title || '',
    validation: validateTranscript(content.transcript)
  }))

  const needsTranscription = results.filter(r => r.validation.needsTranscription)
  const validCount = results.filter(r => r.validation.isValid).length
  const missingCount = results.filter(r => r.validation.status === TranscriptStatus.MISSING).length
  const invalidCount = results.filter(r => r.validation.status === TranscriptStatus.INVALID).length
  const tooShortCount = results.filter(r => r.validation.status === TranscriptStatus.TOO_SHORT).length

  return {
    total: contents.length,
    validCount,
    missingCount,
    invalidCount,
    tooShortCount,
    needsTranscriptionCount: needsTranscription.length,
    missingPercentage: (needsTranscription.length / contents.length) * 100,
    needsTranscription: needsTranscription.map(r => ({
      id: r.id,
      title: r.title,
      reason: r.validation.reason || '未知原因'
    })),
    allValid: needsTranscription.length === 0
  }
}

/**
 * 判断是否应该阻止档案生成（缺失比例过高）
 *
 * @param validationResult 批量验证结果
 * @param threshold 阈值百分比（默认30%）
 * @returns 是否应该先转录
 */
export function shouldTranscribeBeforeProfile(
  validationResult: ReturnType<typeof validateTranscriptsBatch>,
  threshold: number = 30
): boolean {
  return validationResult.missingPercentage >= threshold
}
