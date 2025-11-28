/**
 * Pipeline步骤统一导出
 *

 * 新增：transcribeVideoWithWhisper 支持直接从视频转录（无需FFmpeg）
 */

export { parseShareLink, type ParseLinkContext, type ParseLinkResult } from './parse'
export { fetchVideoDetail, type FetchDetailContext, type FetchDetailResult } from './fetch-detail'
export {
  transcribeAudio,
  transcribeVideoWithWhisper,
  type TranscribeAudioContext,
  type TranscribeAudioResult,
  type TranscribeVideoContext,
  type TranscribeVideoResult
} from './transcribe'
export { optimizeTranscriptStep, type OptimizeTranscriptContext, type OptimizeTranscriptResult } from './optimize'
export { summarize, type SummarizeContext, type SummarizeResult } from './summarize'
