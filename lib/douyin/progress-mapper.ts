/**
 * 抖音视频处理进度映射工具
 * 将各阶段进度映射到统一的 0-100% 区间
 */

/**
 * 处理阶段进度区间配置
 */
const STAGE_RANGES = {
  parsing: { start: 0, end: 10 },
  analyzing: { start: 10, end: 20 },
  downloading: { start: 20, end: 40 },
  extracting: { start: 40, end: 50 },
  transcribing: { start: 50, end: 80 },
  optimizing: { start: 80, end: 95 },
  done: { start: 95, end: 100 },
} as const;

export type ProcessingStage = keyof typeof STAGE_RANGES;

/**
 * 将阶段内的进度百分比映射到全局进度
 * @param stage 当前处理阶段
 * @param stagePercent 阶段内进度 (0-100)
 * @returns 全局进度百分比 (0-100)
 */
export function mapStageProgress(stage: ProcessingStage, stagePercent: number): number {
  const range = STAGE_RANGES[stage];
  if (!range) return 0;

  // 确保输入在 0-100 范围内
  const normalizedPercent = Math.max(0, Math.min(100, stagePercent));

  // 映射到阶段的进度区间
  const rangeSize = range.end - range.start;
  const mappedProgress = range.start + (rangeSize * normalizedPercent) / 100;

  return Math.floor(mappedProgress);
}

/**
 * 获取阶段的起始进度
 */
export function getStageStartProgress(stage: ProcessingStage): number {
  return STAGE_RANGES[stage]?.start ?? 0;
}

/**
 * 获取阶段的结束进度
 */
export function getStageEndProgress(stage: ProcessingStage): number {
  return STAGE_RANGES[stage]?.end ?? 0;
}
