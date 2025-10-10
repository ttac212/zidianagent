/**
 * 聊天系统统一配置文件
 * 管理所有与聊天相关的阈值、性能参数和UI配置
 */

// 虚拟滚动配置
export const VIRTUAL_SCROLL_CONFIG = {
  // 触发虚拟滚动的消息数量阈值
  threshold: 100,
  
  // 估计的消息项高度（像素）
  itemHeight: 120,
  
  // 额外渲染的项数（缓冲区）
  overscan: 5,
  
  // 自动滚动阈值（距离底部多少像素内认为接近底部）
  autoScrollThreshold: 100,
  
  // 新对话自动滚动的消息数量阈值
  newConversationScrollThreshold: 2,
} as const;

// 消息相关配置
export const MESSAGE_CONFIG = {
  // 新消息微光效果持续时间（毫秒）
  glowDuration: 3000,
  
  // 新消息标记持续时间（毫秒）
  newMessageDuration: 5000,
  
  // 消息内容触发微光效果的最小长度
  minContentLengthForGlow: 10,
  
  // 文本选择的最大长度（超过则不自动填入）
  maxSelectedTextLength: 1000,
} as const;

// 输入框配置
export const INPUT_CONFIG = {
  // 输入框最小高度
  minHeight: 72,
  
  // 输入框最大高度
  maxHeight: 300,
  
  // 重试配置
  maxRetries: 3,
} as const;

// 性能相关配置
export const PERFORMANCE_CONFIG = {
  // API监控统计保留的最近记录数
  apiMonitorMaxRecords: 10,
  
  // 标签最大长度
  maxTagLength: 50,
  
  // 内容预览截断长度
  contentPreviewLength: 50,
} as const;

// 分页配置
export const PAGINATION_CONFIG = {
  // 默认每页条数
  defaultLimit: 20,
  
  // API查询默认限制
  apiQueryLimit: 100,
} as const;

// 对话历史加载配置
export const CHAT_HISTORY_CONFIG = {
  // 首次加载和分页请求的默认窗口大小
  initialWindow: 100,
  // 单次请求允许的最大窗口，防止一次取太多消息
  maxWindow: 200,
} as const;

// 边界值验证函数
export const validateConfig = () => {
  const errors: string[] = [];
  
  // 验证虚拟滚动配置
  if (VIRTUAL_SCROLL_CONFIG.threshold <= 0) {
    errors.push('虚拟滚动阈值必须大于0');
  }
  
  if (VIRTUAL_SCROLL_CONFIG.itemHeight <= 0) {
    errors.push('消息项高度必须大于0');
  }
  
  if (VIRTUAL_SCROLL_CONFIG.overscan < 0) {
    errors.push('overscan值不能为负数');
  }
  
  // 验证消息配置
  if (MESSAGE_CONFIG.glowDuration <= 0) {
    errors.push('微光持续时间必须大于0');
  }
  
  if (MESSAGE_CONFIG.minContentLengthForGlow < 0) {
    errors.push('最小内容长度不能为负数');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 配置摘要信息（用于调试）
export const getConfigSummary = () => {
  return {
    virtualScroll: {
      threshold: VIRTUAL_SCROLL_CONFIG.threshold,
      itemHeight: VIRTUAL_SCROLL_CONFIG.itemHeight,
      overscan: VIRTUAL_SCROLL_CONFIG.overscan,
    },
    message: {
      glowDuration: MESSAGE_CONFIG.glowDuration,
      minContentLengthForGlow: MESSAGE_CONFIG.minContentLengthForGlow,
    },
    input: {
      minHeight: INPUT_CONFIG.minHeight,
      maxHeight: INPUT_CONFIG.maxHeight,
      maxRetries: INPUT_CONFIG.maxRetries,
    },
    performance: {
      apiMonitorMaxRecords: PERFORMANCE_CONFIG.apiMonitorMaxRecords,
      maxTagLength: PERFORMANCE_CONFIG.maxTagLength,
    },
    pagination: {
      defaultLimit: PAGINATION_CONFIG.defaultLimit,
      apiQueryLimit: PAGINATION_CONFIG.apiQueryLimit,
    },
  };
};
