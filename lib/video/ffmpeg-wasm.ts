/**
 * FFmpeg WebAssembly 封装
 * 用于 Vercel serverless 环境，替代原生 ffmpeg
 *
 * 设计原则：
 * - 静态决策：通过 USE_WASM_FFMPEG 在部署时确定，不在运行时降级
 * - 单例模式：全局只保留一个 WASM 实例，避免重复加载
 * - 严格清理：每次处理后手动删除虚拟 FS 文件
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

type SupportedAudioFormat = 'mp3' | 'wav' | 'pcm'

interface ExtractAudioOptions {
  format?: SupportedAudioFormat
  sampleRate?: number
  channels?: number
  bitrate?: string
}

interface AudioFormatConfig {
  codec: string
  container: string
  extension: string
  supportsBitrate: boolean
}

const AUDIO_FORMATS: Record<SupportedAudioFormat, AudioFormatConfig> = {
  mp3: {
    codec: 'libmp3lame',
    container: 'mp3',
    extension: 'mp3',
    supportsBitrate: true,
  },
  wav: {
    codec: 'pcm_s16le',
    container: 'wav',
    extension: 'wav',
    supportsBitrate: false,
  },
  pcm: {
    codec: 'pcm_s16le',
    container: 's16le',
    extension: 'pcm',
    supportsBitrate: false,
  },
}

/**
 * 静态决策：是否使用 WASM FFmpeg
 * - Vercel 环境：必须使用 WASM（无原生 ffmpeg）
 * - 本地/VPS：使用原生 ffmpeg（性能更好）
 */
export const USE_WASM_FFMPEG = process.env.VERCEL === '1'

// FFmpeg 实例管理（单例 + 加载锁）
let ffmpegInstance: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

/**
 * 获取或初始化 FFmpeg 实例（带加载锁防止并发竞争）
 */
async function getFFmpeg(): Promise<FFmpeg> {
  // 已有实例直接返回
  if (ffmpegInstance) {
    return ffmpegInstance
  }

  // 使用加载锁防止并发重复初始化
  if (loadPromise) {
    return loadPromise
  }

  loadPromise = (async () => {
    const instance = new FFmpeg()

    // 仅开发环境输出日志
    if (process.env.NODE_ENV === 'development') {
      instance.on('log', ({ message }) => {
        console.log('[FFmpeg WASM]', message)
      })
    }

    // 加载 FFmpeg WASM 核心（CDN 加载减少 bundle 大小）
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    await instance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    ffmpegInstance = instance
    return instance
  })()

  try {
    return await loadPromise
  } catch (error) {
    // 加载失败时重置状态，允许重试
    loadPromise = null
    throw error
  }
}

/**
 * 使用 WebAssembly 版本的 FFmpeg 从视频中提取音频
 */
export async function extractAudioWasm(
  videoBuffer: Buffer,
  options?: ExtractAudioOptions
): Promise<Buffer> {
  const format = options?.format ?? 'mp3'
  const sampleRate = options?.sampleRate ?? 16000
  const channels = options?.channels ?? 1
  const bitrate = options?.bitrate ?? '128k'

  const formatConfig = AUDIO_FORMATS[format]

  // 使用时间戳生成唯一文件名，避免并发冲突
  const timestamp = Date.now()
  const inputFileName = `input-${timestamp}.mp4`
  const outputFileName = `output-${timestamp}.${formatConfig.extension}`

  const ffmpeg = await getFFmpeg()

  try {
    // 1. 写入输入文件到虚拟文件系统
    await ffmpeg.writeFile(inputFileName, new Uint8Array(videoBuffer))

    // 2. 构建 FFmpeg 命令参数
    const args = [
      '-i', inputFileName,
      '-vn',                              // 不处理视频
      '-acodec', formatConfig.codec,      // 音频编码
      '-ar', sampleRate.toString(),       // 采样率
      '-ac', channels.toString(),         // 声道数
    ]

    if (formatConfig.supportsBitrate && bitrate) {
      args.push('-b:a', bitrate)          // 比特率
    }

    args.push('-f', formatConfig.container, outputFileName)

    // 3. 执行 FFmpeg 命令
    await ffmpeg.exec(args)

    // 4. 读取输出文件
    const data = await ffmpeg.readFile(outputFileName)

    if (!(data instanceof Uint8Array)) {
      throw new Error('FFmpeg 输出格式错误')
    }

    return Buffer.from(data)
  } finally {
    // 5. 严格清理虚拟 FS（关键！防止内存泄漏）
    try {
      await ffmpeg.deleteFile(inputFileName)
    } catch {
      // 忽略删除失败（文件可能不存在）
    }
    try {
      await ffmpeg.deleteFile(outputFileName)
    } catch {
      // 忽略删除失败
    }
  }
}

/**
 * 清理 FFmpeg WASM 实例
 * 应在 API 请求结束时调用，释放内存
 */
export function cleanupFFmpegWasm(): void {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate()
    } catch {
      // 忽略清理错误
    }
    ffmpegInstance = null
    loadPromise = null
  }
}
