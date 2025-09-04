// 模型白名单来自环境变量 MODEL_ALLOWLIST，逗号分隔
// 初始建议值来源于产品需求，最终以 /models 实查为准；若未配置，则使用安全的内置回退列表

const raw = (process.env.MODEL_ALLOWLIST || '').trim()
const DEFAULT_ALLOWLIST = [
  'claude-opus-4-1-20250805',
  'gemini-2.5-pro',
]

const allowlist = raw
  ? raw.split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_ALLOWLIST

// 模型友好名称映射
const MODEL_NAME_MAP: Record<string, string> = {
  'claude-opus-4-1-20250805': 'Claude Opus 4.1',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
}

// 导出格式化的模型列表（前端使用）
export const ALLOWED_MODELS = allowlist.map(id => ({
  id,
  name: MODEL_NAME_MAP[id] || id
}))

// 导出简单数组（后端验证使用）
export const ALLOWED_MODEL_IDS = allowlist

// 默认模型为白名单首项，避免使用友好名称作为ID导致不一致
export const DEFAULT_MODEL = ALLOWED_MODEL_IDS[0]

export function isAllowed(model?: string) {
  if (!model) return false
  return ALLOWED_MODEL_IDS.includes(model)
}

