// 模型白名单来自环境变量 MODEL_ALLOWLIST，逗号分隔
// 简化为单一模型，推理功能通过 reasoning_effort 参数控制

const publicAllowlist = (process.env.NEXT_PUBLIC_MODEL_ALLOWLIST || '').trim()
const privateAllowlist = (process.env.MODEL_ALLOWLIST || '').trim()
const raw = publicAllowlist || privateAllowlist
const DEFAULT_ALLOWLIST = [
  'anthropic/claude-sonnet-4.5'
]

const allowlist = raw
  ? raw.split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_ALLOWLIST

// 模型友好名称映射
const MODEL_NAME_MAP: Record<string, string> = {
  'anthropic/claude-sonnet-4.5': 'Claude Sonnet 4.5',
  'openai/gpt-5.1': 'GPT-5.1'
}

// 模型能力元数据
export interface ModelCapabilities {
  supportsReasoning: boolean       // 是否支持推理模式
  provider: 'ZenMux' | '302.AI'    // 提供商
  family: 'claude' | 'gemini' | 'gpt'      // 模型家族
}

const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'anthropic/claude-sonnet-4.5': {
    supportsReasoning: true,
    provider: 'ZenMux',
    family: 'claude'
  },
  'openai/gpt-5.1': {
    supportsReasoning: true,
    provider: 'ZenMux',
    family: 'gpt'
  }
}

// 导出格式化的模型列表（前端使用）
export const ALLOWED_MODELS = allowlist.map(id => ({
  id,
  name: MODEL_NAME_MAP[id] || id,
  capabilities: MODEL_CAPABILITIES[id] || {
    supportsReasoning: true,
    provider: 'ZenMux',
    family: 'claude'
  }
}))

// 导出简单数组（后端验证使用）
export const ALLOWED_MODEL_IDS = allowlist

// 默认模型为白名单首项
export const DEFAULT_MODEL = ALLOWED_MODEL_IDS[0]

export function isAllowed(model?: string) {
  if (!model) return false
  return ALLOWED_MODEL_IDS.includes(model)
}

// 获取模型能力
export function getModelCapabilities(modelId: string): ModelCapabilities {
  return MODEL_CAPABILITIES[modelId] || {
    supportsReasoning: true,
    provider: 'ZenMux',
    family: 'claude'
  }
}

