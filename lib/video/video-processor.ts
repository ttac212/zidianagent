/**
 * 视频处理工具
 * 支持分段下载、音频提取、流式处理
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable, Writable } from 'stream';
import pLimit from 'p-limit';

type SupportedAudioFormat = 'mp3' | 'wav' | 'pcm';

interface ExtractAudioConfig {
  format: SupportedAudioFormat;
  sampleRate: number;
  channels: number;
  bitrate: string;
}

interface AudioFormatConfig {
  codec: string;
  container: string;
  extension: string;
  supportsBitrate: boolean;
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
};

function getAudioFormatConfig(format: SupportedAudioFormat): AudioFormatConfig {
  return AUDIO_FORMATS[format] ?? AUDIO_FORMATS.mp3;
}

class FfmpegProcessError extends Error {
  constructor(
    message: string,
    public readonly code: number | null,
    public readonly signal: NodeJS.Signals | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'FfmpegProcessError';
  }
}

function formatFfmpegFailureMessage(
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
): string {
  const normalizedOutput = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-4)
    .join(' | ');

  const codePart =
    typeof code === 'number'
      ? `code ${code}${code > 255 ? ` (0x${(code >>> 0).toString(16)})` : ''}`
      : signal
        ? `signal ${signal}`
        : 'unknown exit';

  return normalizedOutput
    ? `FFmpeg执行失败 (${codePart}): ${normalizedOutput}`
    : `FFmpeg执行失败 (${codePart})`;
}

function shouldFallbackToTempFile(error: unknown): boolean {
  if (error instanceof FfmpegProcessError) {
    return true;
  }

  const errno = error as NodeJS.ErrnoException;
  return errno?.code === 'EPIPE' || errno?.code === 'ERR_STREAM_DESTROYED';
}

function mergeFfmpegErrors(primary: unknown, fallback: unknown): Error {
  const primaryMessage =
    primary instanceof Error ? primary.message : String(primary);
  if (fallback instanceof Error) {
    const detail = primaryMessage ? `（初次尝试: ${primaryMessage}）` : '';
    fallback.message = `${fallback.message}${detail}`;
    return fallback;
  }
  const detail = primaryMessage ? `（初次尝试: ${primaryMessage}）` : '';
  return new Error(`FFmpeg音频提取失败: ${String(fallback)}${detail}`);
}

class RangeNotSupportedError extends Error {
  constructor() {
    super('服务器未按 Range 请求返回分段数据');
    this.name = 'RangeNotSupportedError';
  }
}

type DownloadStrategy = 'single' | 'chunked';

interface DownloadVideoOptions {
  headers?: HeadersInit;
  signal?: AbortSignal;
  chunkSize?: number;
  concurrency?: number;
  smallFileThreshold?: number;
  maxRetries?: number;
  onProgress?: (downloadedBytes: number, totalBytes: number) => void | Promise<void>;
}

interface DownloadVideoResult {
  buffer: Buffer;
  strategy: DownloadStrategy;
  chunkCount: number;
}

interface ChunkDownloadOptions {
  headers?: HeadersInit;
  signal?: AbortSignal;
}

interface ChunkFetchResult {
  buffer: Buffer;
  status: number;
}

export interface VideoInfo {
  url: string;
  size: number;
  duration: number;
  bitrate: number;
  format: string;
  supportsRange: boolean;
}

export interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  timestamp: number; // 时间轴位置（秒）
  duration: number;
}

export class VideoProcessor {
  /**
   * 获取视频信息（HEAD请求）
   */
  static async getVideoInfo(
    url: string,
    options?: {
      headers?: HeadersInit;
    }
  ): Promise<VideoInfo> {
    try {
      const headHeaders = new Headers(options?.headers || {});
      let response = await fetch(url, { method: 'HEAD', headers: headHeaders });
      let resolvedHeaders = response.headers;
      let supportsRange =
        response.headers.get('accept-ranges')?.toLowerCase() === 'bytes';

      if (!response.ok) {
        const rangeHeaders = new Headers(options?.headers || {});
        rangeHeaders.set('Range', 'bytes=0-0');

        const rangeResponse = await fetch(url, {
          method: 'GET',
          headers: rangeHeaders,
        });

        if (!rangeResponse.ok && rangeResponse.status !== 206) {
          throw new Error(`无法获取视频信息: ${rangeResponse.status}`);
        }

        if (rangeResponse.status === 206) {
          supportsRange = true;
        }

        resolvedHeaders = rangeResponse.headers;
        // 消耗body释放连接
        try {
          await rangeResponse.arrayBuffer();
        } catch {
          // 忽略body读取异常
        }
      }

      let size = parseInt(resolvedHeaders.get('content-length') || '0', 10);

      const contentRange = resolvedHeaders.get('content-range');
      if ((!size || size === 0) && contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
          size = parseInt(match[1], 10);
        }
      }

      if (!Number.isFinite(size) || size <= 0) {
        throw new Error('无法获取视频大小');
      }

      const contentType = resolvedHeaders.get('content-type') || '';

      // 检查是否支持Range请求
      const acceptRanges = resolvedHeaders.get('accept-ranges');
      if (!supportsRange && acceptRanges === 'bytes') {
        supportsRange = true;
      }

      if (!supportsRange) {
        console.warn('服务器不支持Range请求，将使用完整下载');
      }

      return {
        url,
        size,
        duration: 0, // 需要通过FFmpeg probe获取
        bitrate: 0,
        format: contentType.includes('mp4') ? 'mp4' : 'unknown',
        supportsRange,
      };
    } catch (error) {
      throw new Error(
        `获取视频信息失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 使用FFprobe获取视频详细信息
   */
  static async probeVideo(
    url: string,
    options?: {
      headers?: HeadersInit;
      userAgent?: string;
    }
  ): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
      ];

      if (options?.userAgent) {
        args.push('-user_agent', options.userAgent);
      }

      if (options?.headers) {
        const headerEntries = Array.from(new Headers(options.headers).entries())
          .map(([key, value]) => `${key}: ${value}`)
          .join('\r\n');
        if (headerEntries) {
          args.push('-headers', headerEntries);
        }
      }

      args.push(url);

      const ffprobe = spawn('ffprobe', args);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('FFprobe执行失败'));
          return;
        }

        try {
          const info = JSON.parse(output);
          const format = info.format;

          resolve({
            url,
            size: parseInt(format.size || '0'),
            duration: parseFloat(format.duration || '0'),
            bitrate: parseInt(format.bit_rate || '0') / 1000, // 转换为kbps
            format: format.format_name || 'unknown',
            supportsRange: false,
          });
        } catch (_error) {
          reject(new Error('解析视频信息失败'));
        }
      });

      ffprobe.on('error', reject);
    });
  }

  /**
   * 分段下载视频
   */
  static async downloadChunk(
    url: string,
    start: number,
    end: number,
    options?: {
      headers?: HeadersInit;
      signal?: AbortSignal;
    }
  ): Promise<Buffer> {
    try {
      const result = await VideoProcessor.fetchChunk(url, start, end, {
        headers: options?.headers,
        signal: options?.signal,
      });
      return result.buffer;
    } catch (error) {
      throw new Error(
        `下载视频分段失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  static async downloadVideo(
    url: string,
    info: VideoInfo,
    options?: DownloadVideoOptions,
  ): Promise<DownloadVideoResult> {
    const totalSize = info.size;
    if (!Number.isFinite(totalSize) || totalSize <= 0) {
      throw new Error('无法下载视频: 文件大小未知');
    }

    const chunkSize = Math.max(options?.chunkSize ?? 4 * 1024 * 1024, 256 * 1024);
    const smallFileThreshold =
      options?.smallFileThreshold ?? Math.min(chunkSize, 2 * 1024 * 1024);
    const maxRetries = Math.max(0, options?.maxRetries ?? 2);
    const maxConcurrency = Math.max(1, options?.concurrency ?? 4);
    const headers = options?.headers;
    const signal = options?.signal;
    const onProgress = options?.onProgress;

    const throwIfAborted = () => {
      if (signal?.aborted) {
        if (typeof signal.throwIfAborted === 'function') {
          signal.throwIfAborted();
        } else {
          throw new Error('下载过程已取消');
        }
      }
    };

    const downloadEntire = async (): Promise<DownloadVideoResult> => {
      throwIfAborted();
      const buffer = await VideoProcessor.downloadEntireFile(url, {
        headers,
        signal,
        onProgress,
        expectedSize: totalSize,
      });
      return {
        buffer,
        strategy: 'single',
        chunkCount: 1,
      };
    };

    const chunkCount = Math.ceil(totalSize / chunkSize);
    const shouldUseChunk =
      info.supportsRange && chunkCount > 1 && totalSize > smallFileThreshold;

    if (!shouldUseChunk) {
      return downloadEntire();
    }

    throwIfAborted();

    const buffers = new Array<Buffer>(chunkCount);
    let downloadedBytes = 0;

    const firstChunkEnd = Math.min(chunkSize, totalSize) - 1;
    const firstResult = await VideoProcessor.fetchChunk(url, 0, firstChunkEnd, {
      headers,
      signal,
    });
    buffers[0] = firstResult.buffer;
    downloadedBytes += firstResult.buffer.length;
    if (onProgress) {
      await onProgress(downloadedBytes, totalSize);
    }

    if (firstResult.status !== 206) {
      if (firstResult.buffer.length === totalSize) {
        return {
          buffer: firstResult.buffer,
          strategy: 'single',
          chunkCount: 1,
        };
      }
      return downloadEntire();
    }

    const workerLimit = Math.min(maxConcurrency, Math.max(1, chunkCount - 1));
    const limit = pLimit(workerLimit);

    const chunkTasks: Array<Promise<void>> = [];
    for (let index = 1; index < chunkCount; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize - 1, totalSize - 1);

      chunkTasks.push(
        limit(async () => {
          const buffer = await VideoProcessor.fetchChunkWithRetry(
            url,
            start,
            end,
            { headers, signal },
            maxRetries,
          );
          buffers[index] = buffer;
          downloadedBytes += buffer.length;
          if (onProgress) {
            await onProgress(downloadedBytes, totalSize);
          }
        }),
      );
    }

    try {
      await Promise.all(chunkTasks);
    } catch (error) {
      if (error instanceof RangeNotSupportedError) {
        return downloadEntire();
      }
      throw error;
    }

    return {
      buffer: Buffer.concat(buffers),
      strategy: 'chunked',
      chunkCount,
    };
  }

  private static async fetchChunk(
    url: string,
    start: number,
    end: number,
    options?: ChunkDownloadOptions,
  ): Promise<ChunkFetchResult> {
    const headers = new Headers(options?.headers || {});
    headers.set('Range', `bytes=${start}-${end}`);

    const response = await fetch(url, {
      headers,
      signal: options?.signal,
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(`下载分段失败: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      status: response.status,
    };
  }

  private static async downloadEntireFile(
    url: string,
    options: {
      headers?: HeadersInit;
      signal?: AbortSignal;
      expectedSize?: number;
      onProgress?: (downloadedBytes: number, totalBytes: number) => void | Promise<void>;
    },
  ): Promise<Buffer> {
    const response = await fetch(url, {
      headers: options.headers,
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`下载视频失败: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (options.onProgress) {
      await options.onProgress(buffer.length, options.expectedSize ?? buffer.length);
    }
    return buffer;
  }

  private static async fetchChunkWithRetry(
    url: string,
    start: number,
    end: number,
    options: ChunkDownloadOptions,
    maxRetries: number,
  ): Promise<Buffer> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      if (options.signal?.aborted) {
        if (typeof options.signal.throwIfAborted === 'function') {
          options.signal.throwIfAborted();
        } else {
          throw new Error('下载过程已取消');
        }
      }

      try {
        const result = await VideoProcessor.fetchChunk(url, start, end, options);
        if (result.status !== 206) {
          throw new RangeNotSupportedError();
        }
        return result.buffer;
      } catch (error) {
        if (error instanceof RangeNotSupportedError) {
          throw error;
        }
        lastError = error;
        attempt += 1;
        if (attempt > maxRetries) {
          throw lastError instanceof Error ? lastError : new Error(String(lastError));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * 从视频Buffer提取音频
   */
  static async extractAudio(
    videoBuffer: Buffer,
    options?: {
      format?: SupportedAudioFormat;
      sampleRate?: number;
      channels?: number;
      bitrate?: string;
    }
  ): Promise<Buffer> {
    const config: ExtractAudioConfig = {
      format: options?.format ?? 'mp3',
      sampleRate: options?.sampleRate ?? 16000,
      channels: options?.channels ?? 1,
      bitrate: options?.bitrate ?? '128k',
    };

    try {
      return await VideoProcessor.extractAudioFromPipe(videoBuffer, config);
    } catch (error) {
      if (!shouldFallbackToTempFile(error)) {
        throw error;
      }

      try {
        return await VideoProcessor.extractAudioWithTempFile(videoBuffer, config);
      } catch (fallbackError) {
        throw mergeFfmpegErrors(error, fallbackError);
      }
    }
  }

  /**
   * 流式提取音频（边读边转）
   */
  static createAudioExtractionStream(options?: {
    format?: SupportedAudioFormat;
    sampleRate?: number;
    channels?: number;
  }): {
    input: Writable;
    output: Readable;
    process: any;
  } {
    const { format = 'mp3', sampleRate = 16000, channels = 1 } = options || {};
    const formatConfig = getAudioFormatConfig(format);

    const ffmpeg = spawn('ffmpeg', [
      '-i',
      'pipe:0',
      '-vn',
      '-acodec',
      formatConfig.codec,
      '-ar',
      sampleRate.toString(),
      '-ac',
      channels.toString(),
      '-f',
      formatConfig.container,
      'pipe:1',
    ]);

    return {
      input: ffmpeg.stdin,
      output: ffmpeg.stdout,
      process: ffmpeg,
    };
  }

  private static async extractAudioFromPipe(
    videoBuffer: Buffer,
    config: ExtractAudioConfig,
  ): Promise<Buffer> {
    const formatConfig = getAudioFormatConfig(config.format);
    const args = [
      '-i',
      'pipe:0',
      '-vn',
      '-acodec',
      formatConfig.codec,
      '-ar',
      config.sampleRate.toString(),
      '-ac',
      config.channels.toString(),
    ];

    if (formatConfig.supportsBitrate && config.bitrate) {
      args.push('-b:a', config.bitrate);
    }

    args.push('-f', formatConfig.container, 'pipe:1');

    const result = await VideoProcessor.runFfmpeg(args, {
      stdinBuffer: videoBuffer,
      collectStdout: true,
    });

    if (!Buffer.isBuffer(result)) {
      throw new Error('FFmpeg未返回音频数据');
    }

    return result;
  }

  private static async extractAudioWithTempFile(
    videoBuffer: Buffer,
    config: ExtractAudioConfig,
  ): Promise<Buffer> {
    const formatConfig = getAudioFormatConfig(config.format);
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'video-processor-'));
    const inputPath = join(tempDir, 'input.tmp');
    const outputPath = join(tempDir, `output.${formatConfig.extension}`);

    try {
      await fs.writeFile(inputPath, videoBuffer);

      const args = [
        '-y',
        '-i',
        inputPath,
        '-vn',
        '-acodec',
        formatConfig.codec,
        '-ar',
        config.sampleRate.toString(),
        '-ac',
        config.channels.toString(),
      ];

      if (formatConfig.supportsBitrate && config.bitrate) {
        args.push('-b:a', config.bitrate);
      }

      args.push('-f', formatConfig.container, outputPath);

      await VideoProcessor.runFfmpeg(args);
      return await fs.readFile(outputPath);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private static async runFfmpeg(
    args: string[],
    options?: {
      stdinBuffer?: Buffer;
      collectStdout?: boolean;
    },
  ): Promise<Buffer | void> {
    const { stdinBuffer, collectStdout } = options || {};

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let settled = false;

      const finishReject = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      const finishResolve = (value: Buffer | void) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      if (collectStdout) {
        ffmpeg.stdout.on('data', (chunk) => {
          stdoutChunks.push(Buffer.from(chunk));
        });
      } else {
        ffmpeg.stdout.resume();
      }

      ffmpeg.stderr.on('data', (data) => {
        stderrChunks.push(Buffer.from(data));
      });

      ffmpeg.on('close', (code, signal) => {
        if (code !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString();
          finishReject(
            new FfmpegProcessError(
              formatFfmpegFailureMessage(code, signal, stderr),
              code,
              signal,
              stderr,
            ),
          );
          return;
        }

        const result = collectStdout ? Buffer.concat(stdoutChunks) : undefined;
        finishResolve(result);
      });

      ffmpeg.on('error', (error) => finishReject(error));

      if (stdinBuffer) {
        ffmpeg.stdin.on('error', (error) => finishReject(error));

        ffmpeg.stdin.write(stdinBuffer, (error) => {
          if (error) {
            finishReject(error);
            return;
          }
          ffmpeg.stdin.end();
        });
      } else {
        ffmpeg.stdin.end();
      }
    });
  }

  /**
   * 生成分段信息
   */
  static generateChunks(
    videoSize: number,
    chunkSize: number,
    videoDuration?: number
  ): ChunkInfo[] {
    const chunks: ChunkInfo[] = [];
    const chunkCount = Math.ceil(videoSize / chunkSize);

    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize - 1, videoSize - 1);

      // 计算时间轴位置
      const timestamp = videoDuration ? (videoDuration * i) / chunkCount : 0;
      const duration = videoDuration ? videoDuration / chunkCount : 0;

      chunks.push({
        index: i,
        start,
        end,
        timestamp,
        duration,
      });
    }

    return chunks;
  }

  /**
   * 检查FFmpeg是否可用
   */
  static async checkFFmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      ffmpeg.on('close', (code) => {
        resolve(code === 0);
      });
      ffmpeg.on('error', () => {
        resolve(false);
      });
    });
  }
}
