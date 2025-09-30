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
      'claude-opus-4-1-20250805': {
        contextWindow: 200000,
        reserveTokens: 8000,
        maxTokens: 8000,
        // 创作模式：使用90%容量，预留更多输出空间
        creativeMode: { contextWindow: 200000, reserveTokens: 20000, maxTokens: 16000 }
      },
      'claude-sonnet-4-5-20250929-thinking': {
        contextWindow: 200000,
        reserveTokens: 8000,
        maxTokens: 16000,
        creativeMode: { contextWindow: 200000, reserveTokens: 20000, maxTokens: 24000 }
      },
      'claude-sonnet-4-5-20250929': {
        contextWindow: 200000,
        reserveTokens: 8000,
        maxTokens: 8000,
        creativeMode: { contextWindow: 200000, reserveTokens: 20000, maxTokens: 16000 }
      },
      'claude-3-5-sonnet': {
        contextWindow: 200000,
        reserveTokens: 8000,
        maxTokens: 8000,
        creativeMode: { contextWindow: 200000, reserveTokens: 20000, maxTokens: 16000 }
      },
      'claude-3-5-haiku-20241022': {
        contextWindow: 200000,
        reserveTokens: 4000,
        maxTokens: 8000,
        creativeMode: { contextWindow: 200000, reserveTokens: 16000, maxTokens: 12000 }
      },
      'gemini-2.5-pro': {
        contextWindow: 1000000,
        reserveTokens: 8000,
        maxTokens: 8000,
        // Gemini支持超长上下文，创作模式使用90%容量
        creativeMode: { contextWindow: 1000000, reserveTokens: 100000, maxTokens: 32000 }
      },
      'gemini-1.5-pro': {
        contextWindow: 1000000,
        reserveTokens: 8000,
        maxTokens: 8000,
        creativeMode: { contextWindow: 1000000, reserveTokens: 100000, maxTokens: 32000 }
      },
      'gpt-4': {
        contextWindow: 8192,
        reserveTokens: 2000,
        maxTokens: 4096,
        creativeMode: { contextWindow: 8192, reserveTokens: 2000, maxTokens: 4096 } // GPT-4容量有限
      },
      'gpt-4-turbo': {
        contextWindow: 128000,
        reserveTokens: 8000,
        maxTokens: 8000,
        creativeMode: { contextWindow: 128000, reserveTokens: 16000, maxTokens: 16000 }
      },
      'gpt-3.5-turbo': {
        contextWindow: 16385,
        reserveTokens: 4000,
        maxTokens: 4096,
        creativeMode: { contextWindow: 16385, reserveTokens: 4000, maxTokens: 4096 }
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
 * @param creativeMode 是否启用创作模式（长文本优化）
 */
export function getModelContextConfig(modelId: string, creativeMode: boolean = false) {
  // 类型安全的模型配置查找
  const modelConfigs = MESSAGE_LIMITS.CONTEXT_LIMITS.MODEL_CONFIGS;
  const modelConfig = modelConfigs[modelId as keyof typeof modelConfigs];

  if (modelConfig) {
    // 选择配置：创作模式或标准模式
    const config = creativeMode && modelConfig.creativeMode
      ? modelConfig.creativeMode
      : modelConfig

    const contextMaxTokens = Math.max(0, config.contextWindow - config.reserveTokens);

    // SECURITY: 防止配置错误导致内存溢出
    const SAFE_MAX_TOKENS = 500000; // 50万token绝对上限
    if (contextMaxTokens > SAFE_MAX_TOKENS) {
      console.warn(`[Config] Model ${modelId} configured tokens (${contextMaxTokens}) exceeds safe limit (${SAFE_MAX_TOKENS})`);
      return {
        maxMessages: 120,
        maxTokens: contextMaxTokens,
        reserveTokens: config.reserveTokens,
        modelWindow: config.contextWindow,
        outputMaxTokens: config.maxTokens || 8000,
        limitApplied: true,
        creativeMode
      };
    }

    return {
      maxMessages: 120, // 统一的消息数量限制
      maxTokens: contextMaxTokens, // 上下文窗口token数
      reserveTokens: config.reserveTokens,
      modelWindow: config.contextWindow,
      outputMaxTokens: config.maxTokens || 8000, // API max_tokens参数
      limitApplied: false,
      creativeMode
    };
  }

  // 使用默认配置
  return {
    ...MESSAGE_LIMITS.CONTEXT_LIMITS.DEFAULT,
    outputMaxTokens: 8000, // 默认输出限制
    creativeMode: false
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