/**
 * 视频处理工具
 * 支持分段下载、音频提取、流式处理
 */

import { spawn } from 'child_process';
import { Readable } from 'stream';

export interface VideoInfo {
  url: string;
  size: number;
  duration: number;
  bitrate: number;
  format: string;
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
      if (acceptRanges !== 'bytes') {
        console.warn('服务器不支持Range请求，将使用完整下载');
      }

      return {
        url,
        size,
        duration: 0, // 需要通过FFmpeg probe获取
        bitrate: 0,
        format: contentType.includes('mp4') ? 'mp4' : 'unknown',
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
          const videoStream = info.streams.find((s: any) => s.codec_type === 'video');

          resolve({
            url,
            size: parseInt(format.size || '0'),
            duration: parseFloat(format.duration || '0'),
            bitrate: parseInt(format.bit_rate || '0') / 1000, // 转换为kbps
            format: format.format_name || 'unknown',
          });
        } catch (error) {
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
    }
  ): Promise<Buffer> {
    try {
      const headers = new Headers(options?.headers || {});
      headers.set('Range', `bytes=${start}-${end}`);

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`下载分段失败: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      throw new Error(
        `下载视频分段失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 从视频Buffer提取音频
   */
  static async extractAudio(
    videoBuffer: Buffer,
    options?: {
      format?: 'mp3' | 'wav' | 'pcm';
      sampleRate?: number;
      channels?: number;
      bitrate?: string;
    }
  ): Promise<Buffer> {
    const {
      format = 'mp3',
      sampleRate = 16000,
      channels = 1,
      bitrate = '128k',
    } = options || {};

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i',
        'pipe:0', // 从stdin读取
        '-vn', // 不处理视频
        '-acodec',
        format === 'mp3' ? 'libmp3lame' : format === 'wav' ? 'pcm_s16le' : 'copy',
        '-ar',
        sampleRate.toString(),
        '-ac',
        channels.toString(),
        '-b:a',
        bitrate,
        '-f',
        format,
        'pipe:1', // 输出到stdout
      ]);

      const chunks: Buffer[] = [];

      ffmpeg.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      ffmpeg.stderr.on('data', (data) => {
        // FFmpeg输出日志到stderr，这里可以选择记录
        // console.log('FFmpeg:', data.toString());
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg进程退出码: ${code}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });

      ffmpeg.on('error', reject);

      // 写入视频数据
      ffmpeg.stdin.write(videoBuffer);
      ffmpeg.stdin.end();
    });
  }

  /**
   * 流式提取音频（边读边转）
   */
  static createAudioExtractionStream(options?: {
    format?: 'mp3' | 'wav';
    sampleRate?: number;
    channels?: number;
  }): {
    input: Readable;
    output: Readable;
    process: any;
  } {
    const { format = 'mp3', sampleRate = 16000, channels = 1 } = options || {};

    const ffmpeg = spawn('ffmpeg', [
      '-i',
      'pipe:0',
      '-vn',
      '-acodec',
      format === 'mp3' ? 'libmp3lame' : 'pcm_s16le',
      '-ar',
      sampleRate.toString(),
      '-ac',
      channels.toString(),
      '-f',
      format,
      'pipe:1',
    ]);

    return {
      input: ffmpeg.stdin,
      output: ffmpeg.stdout,
      process: ffmpeg,
    };
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
