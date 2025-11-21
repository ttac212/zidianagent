/**
 * 商家档案 API 客户端
 * 统一处理档案生成和转录需求响应
 */

/**
 * 转录内容信息
 */
export interface TranscriptionContentInfo {
  id: string
  title: string
  reason: string
}

/**
 * 转录需求响应（202 Accepted）
 */
export interface TranscriptionRequiredResponse {
  statusCode: 202
  needsTranscription: true
  error: 'TRANSCRIPTION_REQUIRED'
  message: string
  data: {
    total: number
    missingCount: number
    missingPercentage: number
    contentsToTranscribe: TranscriptionContentInfo[]
  }
  hint: string
}

/**
 * 档案生成成功响应（200 OK）
 */
export interface ProfileGeneratedResponse {
  statusCode: 200
  needsTranscription: false
  data: {
    profile: any // MerchantProfile类型
    tokensUsed: number
    model: string
  }
}

/**
 * 档案生成结果（联合类型）
 */
export type GenerateProfileResult =
  | TranscriptionRequiredResponse
  | ProfileGeneratedResponse

/**
 * 判断是否为转录需求响应
 */
export function isTranscriptionRequired(
  result: GenerateProfileResult
): result is TranscriptionRequiredResponse {
  return result.needsTranscription === true
}

/**
 * 生成商家档案
 * 统一处理202和200响应，封装错误处理逻辑
 *
 * @param merchantId - 商家ID
 * @returns 档案生成结果或转录需求响应
 * @throws Error - 其他错误情况
 */
export async function generateProfile(merchantId: string): Promise<GenerateProfileResult> {
  const response = await fetch(`/api/merchants/${merchantId}/profile/generate`, {
    method: 'POST'
  })

  const data = await response.json()

  // 处理 202 Accepted - 需要先转录
  if (response.status === 202 && data?.error === 'TRANSCRIPTION_REQUIRED') {
    return {
      statusCode: 202,
      needsTranscription: true,
      error: 'TRANSCRIPTION_REQUIRED',
      message: data.message || '部分内容缺失转录，需要先完成转录',
      data: {
        total: data.data?.total || 0,
        missingCount: data.data?.missingCount || 0,
        missingPercentage: data.data?.missingPercentage || 0,
        contentsToTranscribe: data.data?.contentsToTranscribe || []
      },
      hint: data.hint || '请先转录缺失的内容，然后重新生成档案'
    }
  }

  // 处理其他 202 情况（未预期）
  if (response.status === 202) {
    throw new Error(data.message || '请求处理中，请稍后重试')
  }

  // 处理错误响应
  if (!response.ok) {
    throw new Error(data.message || `档案生成失败 (HTTP ${response.status})`)
  }

  // 处理 200 OK - 档案生成成功
  return {
    statusCode: 200,
    needsTranscription: false,
    data: {
      profile: data.data?.profile,
      tokensUsed: data.data?.tokensUsed || 0,
      model: data.data?.model || 'unknown'
    }
  }
}

/**
 * 获取商家档案
 */
export async function fetchProfile(merchantId: string) {
  const response = await fetch(`/api/merchants/${merchantId}/profile`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || '获取档案失败')
  }

  const data = await response.json()
  return data.data
}
