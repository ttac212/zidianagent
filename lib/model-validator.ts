/**
 * 模型一致性验证工具
 * 用于在开发和生产环境中验证模型选择的一致性
 */

import { ALLOWED_MODELS } from '@/lib/ai/models'
import { lifecycle } from '@/lib/lifecycle-manager'
import * as dt from '@/lib/utils/date-toolkit'

interface ModelValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  modelInfo?: {
    id: string
    name: string
    provider: string
  }
}

interface ValidationContext {
  component: string
  timestamp: string
  environment: string
}

/**
 * 验证模型ID是否有效
 */
export function validateModelId(modelId: string): ModelValidationResult {
  const result: ModelValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  }

  // 检查模型ID是否为空
  if (!modelId || modelId.trim() === '') {
    result.isValid = false
    result.errors.push('模型ID不能为空')
    return result
  }

  // 检查模型是否在白名单中
  const allowedModel = ALLOWED_MODELS.find(m => m.id === modelId)
  if (!allowedModel) {
    result.isValid = false
    result.errors.push(`模型 "${modelId}" 不在白名单中`)
    
    // 提供建议的模型
    const similarModels = ALLOWED_MODELS.filter(m => 
      m.id.toLowerCase().includes(modelId.toLowerCase()) ||
      modelId.toLowerCase().includes(m.id.toLowerCase())
    )

    if (similarModels.length > 0) {
      result.warnings.push(`您可能想使用: ${similarModels.map(m => m.id).join(', ')}`)
    }
    
    return result
  }

  // 添加模型信息
  result.modelInfo = {
    id: allowedModel.id,
    name: allowedModel.name,
    provider: allowedModel.id.includes('claude') ? 'Claude' : 
              allowedModel.id.includes('gemini') ? 'Google' : 'Unknown'
  }

  return result
}

/**
 * 验证多个环节的模型一致性
 */
export function validateModelConsistency(
  uiModel: string,
  stateModel: string,
  requestModel: string,
  context: ValidationContext
): ModelValidationResult {
  const result: ModelValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  }

  const models = { UI: uiModel, 状态: stateModel, 请求: requestModel }
  
  // 检查是否所有模型都相同
  const allModels = [uiModel, stateModel, requestModel]
  const uniqueModels = [...new Set(allModels)]
  
  if (uniqueModels.length > 1) {
    result.isValid = false
    result.errors.push(
      `${context.component} 中模型不一致: ${JSON.stringify(models, null, 2)}`
    )
  }

  // 验证每个模型的有效性
  for (const [source, modelId] of Object.entries(models)) {
    const validation = validateModelId(modelId)
    if (!validation.isValid) {
      result.errors.push(`${source}模型无效: ${validation.errors.join(', ')}`)
    }
  }

  // 记录验证日志
  const logData = {
    结果: result.isValid ? '一致' : '不一致',
    模型: models,
    时间: context.timestamp,
    环境: context.environment,
    错误: result.errors,
    警告: result.warnings
  }

  if (result.isValid) {
    console.info(`[模型一致性验证] ${context.component}:`, logData)
  } else {
    console.error(`[模型一致性验证] ${context.component}:`, logData)
  }

  return result
}

/**
 * 创建模型验证中间件
 * 用于在API请求前进行验证
 */
export function createModelValidationMiddleware() {
  return {
    beforeRequest: (modelId: string, _endpoint: string) => {
      const validation = validateModelId(modelId)
      
      if (!validation.isValid) {
        const error = new Error(`API请求前验证失败: ${validation.errors.join(', ')}`)
        throw error
      }

      return validation
    },
    
    afterRequest: (modelId: string, response: any) => {
      // 可以在这里验证响应中的模型信息
      return response
    }
  }
}

/**
 * 运行时模型状态检查器
 * 定期检查模型状态的一致性
 */
export class ModelConsistencyChecker {
  private checkInterval: NodeJS.Timeout | null = null
  private isRunning = false
  private lifecycleRegistered = false

  constructor(private _intervalMs: number = 30000) {} // 默认30秒检查一次

  start(getModelStates: () => { ui: string; state: string; storage: string }) {
    if (this.isRunning) return

    this.isRunning = true

    // 首次启动时注册生命周期清理，保持幂等
    if (!this.lifecycleRegistered && typeof window === 'undefined') {
      lifecycle.register(() => this.stop(), 'model-consistency-checker')
      this.lifecycleRegistered = true
    }

    this.checkInterval = setInterval(() => {
      try {
        const states = getModelStates()
        const validation = validateModelConsistency(
          states.ui,
          states.state,
          states.storage,
          {
            component: 'ModelConsistencyChecker',
            timestamp: dt.toISO(),
            environment: process.env.NODE_ENV || 'unknown'
          }
        )

        // 如果发现不一致，发出警告
        if (!validation.isValid) {
          // 开发环境输出警告
          if (process.env.NODE_ENV === 'development') {
            console.warn('[ModelValidator] Validation failed:', {
              errors: validation.errors,
              warnings: validation.warnings,
              timestamp: dt.toISO()
            })
          }
        }
      } catch (error) {
        // 生产环境静默失败，开发环境记录错误
        if (process.env.NODE_ENV === 'development') {
          console.error('[ModelValidator] Check failed:', error)
        }
      }
    }, this._intervalMs)
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      this.isRunning = false
    }
  }

  checkOnce(getModelStates: () => { ui: string; state: string; storage: string }) {
    const states = getModelStates()
    return validateModelConsistency(
      states.ui,
      states.state,
      states.storage,
      {
        component: 'ManualCheck',
        timestamp: dt.toISO(),
        environment: process.env.NODE_ENV || 'unknown'
      }
    )
  }
}

/**
 * 开发环境专用的调试工具
 */
export const ModelDebugTools = {
  // 导出当前所有模型状态
  exportModelStates: () => {
    const states: any = {}
    
    try {
      // 从localStorage获取
      states.localStorage = localStorage.getItem('lastSelectedModelId')
      
      // 从白名单获取
      states.allowedModels = ALLOWED_MODELS.map(m => ({ id: m.id, name: m.name }))
      
      // 当前时间
      states.timestamp = dt.toISO()
      
      return states
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      return null
    }
  },

  // 重置所有模型状态
  resetModelStates: () => {
    try {
      localStorage.removeItem('lastSelectedModelId')
      // 建议刷新页面
      // eslint-disable-next-line no-unused-vars
      } catch (_error) {
      }
  },

  // 强制设置模型
  forceSetModel: (modelId: string) => {
    const validation = validateModelId(modelId)
    if (!validation.isValid) {
      return false
    }

    try {
      localStorage.setItem('lastSelectedModelId', modelId)
      return true
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      return false
    }
  }
}

// 在开发环境中暴露调试工具到全局
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).ModelDebugTools = ModelDebugTools
}