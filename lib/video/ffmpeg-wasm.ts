/**
 * FFmpeg WebAssembly 封装
 * 用于 Vercel serverless 环境，替代原生 ffmpeg
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

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

// FFmpeg 实例缓存（单例模式）
let ffmpegInstance: FFmpeg | null = null
let loadPromise: Promise<void> | null = null

/**
 * 获取或初始化 FFmpeg 实例
 */
async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && loadPromise) {
    await loadPromise
    return ffmpegInstance
  }

  ffmpegInstance = new FFmpeg()

  // 配置日志（可选）
  ffmpegInstance.on('log', ({ message }) => {
    // 仅在开发环境输出日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[FFmpeg]', message)
    }
  })

  // 加载 FFmpeg WASM 核心
  // 使用 CDN 加载以减少 bundle 大小
  loadPromise = (async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    await ffmpegInstance!.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
  })()

  await loadPromise
  return ffmpegInstance
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
  const inputFileName = 'input.mp4'
  const outputFileName = `output.${formatConfig.extension}`

  try {
    const ffmpeg = await getFFmpeg()

    // 写入输入文件到虚拟文件系统
    await ffmpeg.writeFile(inputFileName, new Uint8Array(videoBuffer))

    // 构建 FFmpeg 命令参数
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

    // 执行 FFmpeg 命令
    await ffmpeg.exec(args)

    // 读取输出文件
    const data = await ffmpeg.readFile(outputFileName)

    // 清理虚拟文件系统
    await ffmpeg.deleteFile(inputFileName)
    await ffmpeg.deleteFile(outputFileName)

    // 转换为 Buffer
    if (data instanceof Uint8Array) {
      return Buffer.from(data)
    }

    throw new Error('FFmpeg 输出格式错误')
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    throw new Error(`FFmpeg WebAssembly 音频提取失败: ${message}`)
  }
}

/**
 * 检查 FFmpeg WebAssembly 是否可用
 */
export async function checkFFmpegWasmAvailable(): Promise<boolean> {
  try {
    await getFFmpeg()
    return true
  } catch {
    return false
  }
}

/**
 * 重置 FFmpeg 实例（用于错误恢复）
 */
export function resetFFmpegInstance(): void {
  if (ffmpegInstance) {
    ffmpegInstance.terminate()
    ffmpegInstance = null
    loadPromise = null
  }
}
