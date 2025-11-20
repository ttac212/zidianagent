/**
 * 统一的消息长度限制配置
 * 前后端共享，确保一致性
 */
export const MESSAGE_LIMITS = {
  // 单条消息最大长度
  MAX_LENGTH: 150000,

  // 显示字符计数器的阈值
  SHOW_COUNTER_THRESHOLD: 10000,

  // 警告阈值（接近最大限制时显示警告）
  WARNING_THRESHOLD: 13000,

  // 危险阈值（即将超出限制）
  DANGER_THRESHOLD: 145000,

  // 消息截断时的后缀提示
  TRUNCATION_SUFFIX: '\n\n[消息已被截断，请分段发送]',

  // 上下文裁剪配置 - 按模型实际上限设计
  CONTEXT_LIMITS: {
    // 模型特定的上下文窗口配置
    MODEL_CONFIGS: {
      'anthropic/claude-sonnet-4.5': {
        contextWindow: 200000,
        reserveTokens: 8000,
        maxTokens: 16000
      },
      'claude-opus-4-1-20250805': {
        contextWindow: 200000,
        reserveTokens: 8000,
        maxTokens: 8000
      },
      'claude-sonnet-4-5-20250929-thinking': {
        contextWindow: 200000,
        reserveTokens: 8000,
        maxTokens: 16000
      },
      'claude-sonnet-4-5-20250929': {
        contextWindow: 200000,
        reserveTokens: 8000,
        maxTokens: 8000
      },
      'claude-3-5-sonnet': {
        contextWindow: 200000,
        reserveTokens: 8000,
        maxTokens: 8000
      },
      'claude-3-5-haiku-20241022': {
        contextWindow: 200000,
        reserveTokens: 4000,
        maxTokens: 8000
      },
      'gemini-2.5-pro': {
        contextWindow: 1000000,
        reserveTokens: 8000,
        maxTokens: 8000
      },
      'google/gemini-2.5-pro': {
        contextWindow: 480000,
        reserveTokens: 8000,
        maxTokens: 8000
      },
      'google/gemini-3-pro-preview': {
        contextWindow: 480000,
        reserveTokens: 8000,
        maxTokens: 16000
      },
      'gemini-1.5-pro': {
        contextWindow: 1000000,
        reserveTokens: 8000,
        maxTokens: 8000
      },
      'gpt-4': {
        contextWindow: 8192,
        reserveTokens: 2000,
        maxTokens: 4096
      },
      'gpt-4-turbo': {
        contextWindow: 128000,
        reserveTokens: 8000,
        maxTokens: 8000
      },
      'gpt-3.5-turbo': {
        contextWindow: 16385,
        reserveTokens: 4000,
        maxTokens: 4096
      }
    },

    // 默认配置（保守估计）
    DEFAULT: {
      maxMessages: 80,
      maxTokens: 32000,      // 基于GPT-4的最小窗口
      reserveTokens: 8000
    },

    // 显示时的裁剪配置（不受模型限制）
    DISPLAY: {
      maxMessages: 200,
      maxTokens: 200000,     // 显示用途，取合理中值
      reserveTokens: 0
    }
  }
} as const

/**
 * 根据模型ID获取上下文配置
 * @param modelId 模型ID
 */
export function getModelContextConfig(modelId: string) {
  // 类型安全的模型配置查找
  const modelConfigs = MESSAGE_LIMITS.CONTEXT_LIMITS.MODEL_CONFIGS;
  const modelConfig = modelConfigs[modelId as keyof typeof modelConfigs];

  if (modelConfig) {
    const contextMaxTokens = Math.max(0, modelConfig.contextWindow - modelConfig.reserveTokens);

    // SECURITY: 防止配置错误导致内存溢出
    const SAFE_MAX_TOKENS = 500000; // 50万token绝对上限
    if (contextMaxTokens > SAFE_MAX_TOKENS) {
      console.warn(`[Config] Model ${modelId} configured tokens (${contextMaxTokens}) exceeds safe limit (${SAFE_MAX_TOKENS})`);
      return {
        maxMessages: 120,
        maxTokens: contextMaxTokens,
        reserveTokens: modelConfig.reserveTokens,
        modelWindow: modelConfig.contextWindow,
        outputMaxTokens: modelConfig.maxTokens || 8000,
        limitApplied: true
      };
    }

    return {
      maxMessages: 120, // 统一的消息数量限制
      maxTokens: contextMaxTokens, // 上下文窗口token数
      reserveTokens: modelConfig.reserveTokens,
      modelWindow: modelConfig.contextWindow,
      outputMaxTokens: modelConfig.maxTokens || 8000 // API max_tokens参数
    };
  }

  // 使用默认配置
  return {
    ...MESSAGE_LIMITS.CONTEXT_LIMITS.DEFAULT,
    outputMaxTokens: 8000 // 默认输出限制
  };
}

/**
 * 获取字符限制状态
 */
export function getCharLimitStatus(length: number) {
  return {
    isValid: length <= MESSAGE_LIMITS.MAX_LENGTH,
    showCounter: length >= MESSAGE_LIMITS.SHOW_COUNTER_THRESHOLD,
    isWarning: length >= MESSAGE_LIMITS.WARNING_THRESHOLD,
    isDanger: length >= MESSAGE_LIMITS.DANGER_THRESHOLD,
    remaining: MESSAGE_LIMITS.MAX_LENGTH - length,
    percentage: Math.min(100, (length / MESSAGE_LIMITS.MAX_LENGTH) * 100)
  }
}

/**
 * 安全截断消息内容
 */
export function truncateMessage(content: string): {
  truncated: boolean
  content: string
  originalLength: number
} {
  if (content.length <= MESSAGE_LIMITS.MAX_LENGTH) {
    return {
      truncated: false,
      content,
      originalLength: content.length
    }
  }
  
  // 保留空间给截断提示
  const maxLength = MESSAGE_LIMITS.MAX_LENGTH - MESSAGE_LIMITS.TRUNCATION_SUFFIX.length
  const truncatedContent = content.slice(0, maxLength) + MESSAGE_LIMITS.TRUNCATION_SUFFIX
  
  return {
    truncated: true,
    content: truncatedContent,
    originalLength: content.length
  }
}
