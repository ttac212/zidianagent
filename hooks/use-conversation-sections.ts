/**
 * 对话分组选择器 Hook
 * 使用 useMemo 缓存分组计算结果,避免每次渲染重新计算
 */

import { useMemo } from 'react'
import type { Conversation } from '@/types/chat'
import {
  buildConversationSections,
  filterConversations,
  deriveConversationData,
  type DerivedConversation,
  type ConversationSection
} from '@/lib/utils/conversation-list'

/**
 * 对话分组和搜索的统一处理
 * @param conversations 原始对话列表
 * @param searchQuery 搜索查询
 * @returns 分组数据或搜索结果
 */
export function useConversationSections(
  conversations: Conversation[],
  searchQuery: string
) {
  // 1. 派生所有对话数据（useMemo缓存）
  const derivedConversations = useMemo(
    () => (conversations || []).map(deriveConversationData),
    [conversations]
  )

  // 2. 搜索过滤（useMemo缓存）
  const isSearching = searchQuery.trim().length > 0
  const filteredConversations = useMemo(
    () => isSearching ? filterConversations(derivedConversations, searchQuery) : [],
    [derivedConversations, searchQuery, isSearching]
  )

  // 3. 分组构建（useMemo缓存,基于原始conversations）
  const conversationSections = useMemo(
    () => buildConversationSections(conversations || []),
    [conversations]
  )

  return {
    isSearching,
    filteredConversations,
    conversationSections,
    derivedConversations
  }
}
