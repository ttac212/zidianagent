/**
 * 抖音视频文案提取 Hook
 * 支持实时进度跟踪和SSE流式响应
 */

import { useState, useCallback, useRef } from 'react';

export interface ExtractionProgress {
  stage:
    | 'idle'
    | 'parsing'
    | 'analyzing'
    | 'planning'
    | 'downloading'
    | 'extracting'
    | 'transcribing'
    | 'merging'
    | 'optimizing'
    | 'done'
    | 'error';
  message: string;
  percent: number;
  current?: number;
  total?: number;
}

export interface PartialResult {
  index: number;
  text: string;
  timestamp: number;
}

export interface ExtractionResult {
  text: string;
  originalText: string;
  segments: PartialResult[];
  videoInfo: {
    title?: string;
    author?: string;
    url?: string;
    duration?: number;
  };
  stats: {
    totalSegments: number;
    successSegments: number;
    totalCharacters: number;
  };
}

export interface UseDouyinExtractionReturn {
  // 状态
  isExtracting: boolean;
  progress: ExtractionProgress;
  partialResults: PartialResult[];
  result: ExtractionResult | null;
  error: string | null;

  // 操作
  extractText: (shareLink: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useDouyinExtraction(): UseDouyinExtractionReturn {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress>({
    stage: 'idle',
    message: '',
    percent: 0,
  });
  const [partialResults, setPartialResults] = useState<PartialResult[]>([]);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const extractText = useCallback(async (shareLink: string) => {
    // 重置状态
    setIsExtracting(true);
    setProgress({ stage: 'parsing', message: '开始处理...', percent: 0 });
    setPartialResults([]);
    setResult(null);
    setError(null);

    // 创建AbortController用于取消
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/douyin/extract-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shareLink }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP错误: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      // 处理SSE流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // 解码数据
        const text = decoder.decode(value, { stream: true });

        // 处理多个SSE消息
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(data);
            } catch (e) {
              console.error('解析SSE数据失败:', e);
            }
          }
        }
      }

      setIsExtracting(false);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setError('操作已取消');
        setProgress({ stage: 'error', message: '操作已取消', percent: 0 });
      } else {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        setError(errorMessage);
        setProgress({ stage: 'error', message: errorMessage, percent: 0 });
      }
      setIsExtracting(false);
    }
  }, []);

  const handleSSEEvent = useCallback((data: any) => {
    const { type, ...payload } = data;

    switch (type) {
      case 'progress':
        setProgress({
          stage: payload.stage || 'idle',
          message: payload.message || '',
          percent: payload.percent || 0,
          current: payload.current,
          total: payload.total,
        });
        break;

      case 'info':
        setProgress((prev) => ({
          ...prev,
          stage: payload.stage || prev.stage,
          message: payload.message || prev.message,
        }));
        break;

      case 'partial':
        setPartialResults((prev) => [
          ...prev,
          {
            index: payload.index,
            text: payload.text,
            timestamp: payload.timestamp,
          },
        ]);
        setProgress((prev) => ({
          ...prev,
          percent: payload.progress || prev.percent,
        }));
        break;

      case 'warning':
        console.warn('警告:', payload.message);
        break;

      case 'done':
        setResult({
          text: payload.text,
          originalText: payload.originalText,
          segments: payload.segments,
          videoInfo: payload.videoInfo,
          stats: payload.stats,
        });
        setProgress({
          stage: 'done',
          message: '提取完成！',
          percent: 100,
        });
        break;

      case 'error':
        setError(payload.message);
        setProgress({
          stage: 'error',
          message: payload.message,
          percent: 0,
        });
        break;

      default:
        console.log('未知事件类型:', type, payload);
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setIsExtracting(false);
    setProgress({ stage: 'idle', message: '', percent: 0 });
    setPartialResults([]);
    setResult(null);
    setError(null);
  }, []);

  return {
    isExtracting,
    progress,
    partialResults,
    result,
    error,
    extractText,
    cancel,
    reset,
  };
}
