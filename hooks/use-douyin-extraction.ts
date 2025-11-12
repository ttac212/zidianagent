/**
 * 抖音视频文案提取 Hook
 * 支持实时进度跟踪和SSE流式响应
 */

import { useState, useCallback, useRef } from 'react';
import { processSSEStream } from '@/lib/utils/sse-parser';

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

export interface ExtractionResult {
  text: string;
  originalText: string;
  videoInfo: {
    title?: string;
    author?: string;
    url?: string;
    duration?: number;
  };
  stats: {
    totalCharacters: number;
  };
}

export interface UseDouyinExtractionReturn {
  // 状态
  isExtracting: boolean;
  progress: ExtractionProgress;
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
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const extractText = useCallback(async (shareLink: string) => {
    // 重置状态
    setIsExtracting(true);
    setProgress({ stage: 'parsing', message: '开始处理...', percent: 0 });
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

      // 使用统一的 SSE 解析器 (支持 ZenMux 和标准格式)
      const reader = response.body.getReader();
      await processSSEStream(reader, {
        onMessage: (message) => {
          // 修复：正确处理带有 event: 头的消息
          // 将 payload 展开到顶层，确保 handleSSEEvent 能访问到 stage/percent 等字段
          if (message.payload && typeof message.payload === 'object') {
            const payload = message.payload as Record<string, any>
            // 如果 payload 有 type 字段，直接使用
            if (payload.type) {
              handleSSEEvent(payload)
            }
            // 如果有 event 但 payload 没有 type，将 event 作为 type 并展开 payload
            else if (message.event) {
              handleSSEEvent({ type: message.event, ...payload })
            }
            // 否则使用整个 message 作为事件数据
            else {
              handleSSEEvent(message)
            }
          } else {
            // 兼容标准格式（没有 event 头，直接是 data）
            handleSSEEvent(message as Record<string, any>)
          }
        },
        onError: (error) => {
          console.error('[抖音提取] SSE错误:', error)
        }
      })

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

      case 'done':
        setResult({
          text: payload.text,
          originalText: payload.originalText,
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
        console.warn('[Douyin Extraction] 未知事件类型:', type, payload);
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
    setResult(null);
    setError(null);
  }, []);

  return {
    isExtracting,
    progress,
    result,
    error,
    extractText,
    cancel,
    reset,
  };
}
