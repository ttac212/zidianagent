/**
 * 转录相关错误类型
 */

/**
 * 需要转录错误
 *
 * 当检测到内容缺少有效转录文本时抛出此错误
 * API层捕获后应返回202状态码和转录需求信息
 */
export class TranscriptionRequiredError extends Error {
  public readonly code = 'TRANSCRIPTION_REQUIRED'
  public readonly statusCode = 202 // Accepted - 需要先完成转录
  public readonly contentsToTranscribe: Array<{
    id: string
    title: string
    reason: string
  }>
  public readonly total: number
  public readonly missingCount: number
  public readonly missingPercentage: number

  constructor(data: {
    total: number
    missingCount: number
    missingPercentage: number
    contentsToTranscribe: Array<{
      id: string
      title: string
      reason: string
    }>
  }) {
    super(
      `档案生成需要先转录 ${data.missingCount}/${data.total} 条内容（${data.missingPercentage.toFixed(1)}%）`
    )
    this.name = 'TranscriptionRequiredError'
    this.total = data.total
    this.missingCount = data.missingCount
    this.missingPercentage = data.missingPercentage
    this.contentsToTranscribe = data.contentsToTranscribe

    // 设置原型链（TypeScript类继承Error需要）
    Object.setPrototypeOf(this, TranscriptionRequiredError.prototype)
  }

  /**
   * 转换为API响应格式
   */
  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      data: {
        total: this.total,
        missingCount: this.missingCount,
        missingPercentage: this.missingPercentage,
        contentsToTranscribe: this.contentsToTranscribe
      }
    }
  }
}

/**
 * 检查错误是否为TranscriptionRequiredError
 */
export function isTranscriptionRequiredError(error: unknown): error is TranscriptionRequiredError {
  return error instanceof TranscriptionRequiredError
}
