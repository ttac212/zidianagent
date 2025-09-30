/**
 * Key Manager 重构验证测试
 * 确保重构后的行为与原始版本一致
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { selectApiKey } from '@/lib/ai/key-manager'

describe('Key Manager 重构验证', () => {
  beforeEach(() => {
    // 清除所有环境变量
    delete process.env.LLM_CLAUDE_SONNET_4_5_THINKING_KEY
    delete process.env.LLM_CLAUDE_SONNET_4_5_KEY
    delete process.env.LLM_CLAUDE_API_KEY
    delete process.env.LLM_GEMINI_API_KEY
    delete process.env.LLM_OPENAI_API_KEY
    delete process.env.LLM_API_KEY
  })

  describe('Claude 模型匹配', () => {
    it('应该精确匹配 claude-sonnet-4-5-20250929-thinking', () => {
      process.env.LLM_CLAUDE_SONNET_4_5_THINKING_KEY = 'thinking-key'

      const result = selectApiKey('claude-sonnet-4-5-20250929-thinking')

      expect(result.apiKey).toBe('thinking-key')
      expect(result.provider).toBe('Claude')
    })

    it('应该精确匹配 claude-sonnet-4-5-20250929', () => {
      process.env.LLM_CLAUDE_SONNET_4_5_KEY = 'sonnet-key'

      const result = selectApiKey('claude-sonnet-4-5-20250929')

      expect(result.apiKey).toBe('sonnet-key')
      expect(result.provider).toBe('Claude')
    })

    it('应该前缀匹配 claude- 模型', () => {
      process.env.LLM_CLAUDE_API_KEY = 'claude-general-key'

      const result = selectApiKey('claude-3-5-opus')

      expect(result.apiKey).toBe('claude-general-key')
      expect(result.provider).toBe('Claude')
    })

    it('应该 fallback 到通用 Key', () => {
      process.env.LLM_API_KEY = 'fallback-key'

      const result = selectApiKey('claude-new-model')

      expect(result.apiKey).toBe('fallback-key')
      expect(result.provider).toBe('Claude')
    })
  })

  describe('Gemini 模型匹配', () => {
    it('应该匹配 gemini- 前缀', () => {
      process.env.LLM_GEMINI_API_KEY = 'gemini-key'

      const result = selectApiKey('gemini-2.5-pro')

      expect(result.apiKey).toBe('gemini-key')
      expect(result.provider).toBe('Google')
    })

    it('应该 fallback 到通用 Key', () => {
      process.env.LLM_API_KEY = 'fallback-key'

      const result = selectApiKey('gemini-3-pro')

      expect(result.apiKey).toBe('fallback-key')
      expect(result.provider).toBe('Google')
    })
  })

  describe('GPT 模型匹配', () => {
    it('应该匹配 gpt- 前缀', () => {
      process.env.LLM_OPENAI_API_KEY = 'openai-key'

      const result = selectApiKey('gpt-4o')

      expect(result.apiKey).toBe('openai-key')
      expect(result.provider).toBe('OpenAI')
    })
  })

  describe('未知模型处理', () => {
    it('应该返回通用 fallback Key', () => {
      process.env.LLM_API_KEY = 'fallback-key'

      const result = selectApiKey('unknown-model-xyz')

      expect(result.apiKey).toBe('fallback-key')
      expect(result.provider).toBe('Unknown')
    })

    it('没有任何 Key 时应该返回空字符串', () => {
      const result = selectApiKey('unknown-model')

      expect(result.apiKey).toBe('')
      expect(result.provider).toBe('Unknown')
    })
  })

  describe('Fallback 链优先级', () => {
    it('精确匹配优先级最高', () => {
      process.env.LLM_CLAUDE_SONNET_4_5_THINKING_KEY = 'specific-key'
      process.env.LLM_CLAUDE_API_KEY = 'general-key'
      process.env.LLM_API_KEY = 'fallback-key'

      const result = selectApiKey('claude-sonnet-4-5-20250929-thinking')

      expect(result.apiKey).toBe('specific-key')
    })

    it('前缀匹配优先于通用 Key', () => {
      process.env.LLM_CLAUDE_API_KEY = 'claude-key'
      process.env.LLM_API_KEY = 'fallback-key'

      const result = selectApiKey('claude-opus-3')

      expect(result.apiKey).toBe('claude-key')
    })

    it('专用 Key 缺失时应该 fallback', () => {
      // 没有 THINKING_KEY
      process.env.LLM_CLAUDE_API_KEY = 'claude-key'
      process.env.LLM_API_KEY = 'fallback-key'

      const result = selectApiKey('claude-sonnet-4-5-20250929-thinking')

      expect(result.apiKey).toBe('claude-key') // fallback 到 Claude 通用 Key
    })
  })

  describe('边界情况', () => {
    it('空字符串 modelId', () => {
      process.env.LLM_API_KEY = 'fallback-key'

      const result = selectApiKey('')

      expect(result.apiKey).toBe('fallback-key')
      expect(result.provider).toBe('Unknown')
    })

    it('只包含前缀的 modelId', () => {
      process.env.LLM_CLAUDE_API_KEY = 'claude-key'

      const result = selectApiKey('claude-')

      expect(result.apiKey).toBe('claude-key')
      expect(result.provider).toBe('Claude')
    })

    it('大小写敏感匹配', () => {
      process.env.LLM_CLAUDE_API_KEY = 'claude-key'

      // 不应该匹配 Claude（大写C）
      const result = selectApiKey('Claude-opus')

      expect(result.provider).toBe('Unknown')
    })
  })
})
