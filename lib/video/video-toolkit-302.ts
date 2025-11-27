/**
 * 302.AI 视频工具 API 客户端
 *
 * 用于在 Vercel Serverless 环境下提取音频
 * 解决 FFmpeg 不可用的问题
 *
 * API 文档: https://api.302.ai/302/video/toolkit
 *
 * 价格：
 * - 提取音频: 0.003 PTC/分钟（不足一分钟按一分钟计）
 * - 合并视频: 0.0005 PTC/秒
 */

const VIDEO_TOOLKIT_API_BASE = 'https://api.302.ai'
const SUBMIT_ENDPOINT = '/302/video/toolkit/submit'
const STATUS_ENDPOINT = '/302/video/toolkit/status'

// 默认超时配置
const DEFAULT_POLL_INTERVAL_MS = 2000 // 2秒轮询一次
const DEFAULT_MAX_WAIT_MS = 180_000 // 最长等待3分钟

export type VideoToolkitOperation = 'audio_separation' | 'video_merge'

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface SubmitResponse {
  task_id: string
  status: TaskStatus
  created_at: string
}

export interface StatusResponse {
  task_id: string
  status: TaskStatus
  created_at: string
  completed_at?: string
  result?: {
    /** 提取的音频URL（audio_separation操作） */
    audio_url?: string
    /** 合并后的视频URL（video_merge操作） */
    video_url?: string
  }
  error?: string
}

export interface AudioExtractionResult {
  audioUrl: string
  taskId: string
  duration: number // 处理耗时（毫秒）
}

/**
 * 302.AI 视频工具客户端
 */
export class VideoToolkit302 {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.LLM_API_KEY || ''
    this.baseUrl = VIDEO_TOOLKIT_API_BASE

    if (!this.apiKey) {
      throw new Error('VideoToolkit302: 缺少 API Key')
    }
  }

  /**
   * 提交视频处理任务
   */
  async submit(
    videoUrls: string[],
    operation: VideoToolkitOperation
  ): Promise<SubmitResponse> {
    const response = await fetch(`${this.baseUrl}${SUBMIT_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        video: videoUrls,
        operation,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`视频工具API提交失败: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  /**
   * 查询任务状态
   */
  async getStatus(taskId: string): Promise<StatusResponse> {
    const response = await fetch(
      `${this.baseUrl}${STATUS_ENDPOINT}?task_id=${encodeURIComponent(taskId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`视频工具API查询失败: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  /**
   * 等待任务完成（轮询）
   */
  async waitForCompletion(
    taskId: string,
    options?: {
      pollInterval?: number
      maxWait?: number
      onProgress?: (status: StatusResponse) => void
      signal?: AbortSignal
    }
  ): Promise<StatusResponse> {
    const pollInterval = options?.pollInterval || DEFAULT_POLL_INTERVAL_MS
    const maxWait = options?.maxWait || DEFAULT_MAX_WAIT_MS
    const startTime = Date.now()

    while (true) {
      // 检查中止信号
      if (options?.signal?.aborted) {
        throw new Error('任务已取消')
      }

      // 检查超时
      if (Date.now() - startTime > maxWait) {
        throw new Error(`视频处理超时（${maxWait / 1000}秒）`)
      }

      const status = await this.getStatus(taskId)

      // 回调通知进度
      options?.onProgress?.(status)

      if (status.status === 'completed') {
        return status
      }

      if (status.status === 'failed') {
        throw new Error(status.error || '视频处理失败')
      }

      // 等待后继续轮询
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }
  }

  /**
   * 从视频URL提取音频（便捷方法）
   *
   * @param videoUrl 视频URL
   * @param options 选项
   * @returns 音频URL和处理信息
   */
  async extractAudio(
    videoUrl: string,
    options?: {
      pollInterval?: number
      maxWait?: number
      onProgress?: (message: string, percent?: number) => void
      signal?: AbortSignal
    }
  ): Promise<AudioExtractionResult> {
    const startTime = Date.now()

    // 1. 提交任务
    options?.onProgress?.('提交音频提取任务...', 10)
    const submitResult = await this.submit([videoUrl], 'audio_separation')

    console.info(`[VideoToolkit302] 任务已提交: ${submitResult.task_id}`)

    // 2. 等待完成
    let lastPercent = 20
    const result = await this.waitForCompletion(submitResult.task_id, {
      pollInterval: options?.pollInterval,
      maxWait: options?.maxWait,
      signal: options?.signal,
      onProgress: (status) => {
        if (status.status === 'pending') {
          options?.onProgress?.('任务排队中...', lastPercent)
        } else if (status.status === 'processing') {
          lastPercent = Math.min(lastPercent + 10, 80)
          options?.onProgress?.('正在提取音频...', lastPercent)
        }
      },
    })

    // 3. 返回结果
    if (!result.result?.audio_url) {
      throw new Error('音频提取成功但未返回音频URL')
    }

    options?.onProgress?.('音频提取完成', 100)

    return {
      audioUrl: result.result.audio_url,
      taskId: submitResult.task_id,
      duration: Date.now() - startTime,
    }
  }
}

/**
 * 获取默认客户端实例
 */
let defaultClient: VideoToolkit302 | null = null

export function getVideoToolkit302(): VideoToolkit302 {
  if (!defaultClient) {
    defaultClient = new VideoToolkit302()
  }
  return defaultClient
}
