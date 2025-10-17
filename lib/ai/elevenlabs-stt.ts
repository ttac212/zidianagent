/**
 * Elevenlabs Speech-to-Text API 客户端
 * 通过 302.AI 代理访问
 *
 * 支持URL方式提交音频,异步获取结果
 */

export interface ElevenlabsSTTConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ElevenlabsSTTRequest {
  audioUrl: string; // 公网可访问的音频URL
  languageCode?: string; // 语言代码,如 "zh" "en"
  tagAudioEvents?: boolean; // 是否标记掌声、笑声等
  diarize?: boolean; // 是否区分说话人
}

export interface ElevenlabsSTTResponse {
  success: boolean;
  taskId?: string; // 任务ID,用于查询结果
  text?: string; // 转录文本
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    speaker?: string;
  }>;
  error?: string;
}

export class ElevenlabsSTTClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ElevenlabsSTTConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.302.ai/302/submit';
  }

  /**
   * 提交语音转文字任务
   */
  async submit(request: ElevenlabsSTTRequest): Promise<{ taskId: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/elevenlabs/speech-to-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          audio_url: request.audioUrl,
          language_code: request.languageCode || 'zh',
          tag_audio_events: request.tagAudioEvents ?? true,
          diarize: request.diarize ?? false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Elevenlabs STT 提交失败: ${response.status} ${response.statusText}\n${errorText}`
        );
      }

      const result = await response.json();

      // 302.AI的submit API返回task_id
      if (!result.task_id) {
        throw new Error('API未返回task_id');
      }

      return {
        taskId: result.task_id,
      };
    } catch (error) {
      console.error('Elevenlabs STT提交失败:', error);
      throw error;
    }
  }

  /**
   * 查询任务结果
   */
  async fetch(taskId: string, maxRetries: number = 60): Promise<ElevenlabsSTTResponse> {
    try {
      // 轮询查询结果
      for (let i = 0; i < maxRetries; i++) {
        const response = await fetch(`${this.baseUrl.replace('/submit', '')}/fetch/${taskId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Elevenlabs STT 查询失败: ${response.status} ${response.statusText}\n${errorText}`
          );
        }

        const result = await response.json();

        // 检查任务状态
        if (result.status === 'completed') {
          return {
            success: true,
            taskId,
            text: result.result?.text || '',
            segments: result.result?.segments,
          };
        }

        if (result.status === 'failed') {
          return {
            success: false,
            taskId,
            error: result.error || '任务失败',
          };
        }

        // 任务还在处理中,等待后重试
        await this.sleep(2000); // 2秒
      }

      // 超时
      return {
        success: false,
        taskId,
        error: '查询超时',
      };
    } catch (error) {
      console.error('Elevenlabs STT查询失败:', error);
      return {
        success: false,
        taskId,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 提交并等待结果(一步完成)
   */
  async transcribe(request: ElevenlabsSTTRequest): Promise<ElevenlabsSTTResponse> {
    try {
      // 1. 提交任务
      const { taskId } = await this.submit(request);

      // 2. 等待结果
      return await this.fetch(taskId);
    } catch (error) {
      console.error('Elevenlabs STT转录失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 估算转录成本
   * @param durationSeconds 音频时长（秒）
   * @returns 估算成本（PTC）
   */
  static estimateCost(durationSeconds: number): number {
    const minutes = durationSeconds / 60;
    return minutes * 0.05; // 0.05 PTC/分钟
  }
}

/**
 * 创建Elevenlabs STT客户端单例
 */
let clientInstance: ElevenlabsSTTClient | null = null;

export function getElevenlabsSTTClient(
  config?: ElevenlabsSTTConfig
): ElevenlabsSTTClient {
  if (!clientInstance) {
    const apiKey = process.env.LLM_API_KEY || config?.apiKey;

    if (!apiKey) {
      throw new Error(
        'Elevenlabs STT API key is required. Set LLM_API_KEY in environment variables.'
      );
    }

    clientInstance = new ElevenlabsSTTClient({
      apiKey,
      baseUrl: config?.baseUrl,
    });
  }
  return clientInstance;
}

/**
 * 重置客户端单例（用于测试）
 */
export function resetElevenlabsSTTClient(): void {
  clientInstance = null;
}
