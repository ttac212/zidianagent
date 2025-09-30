/**
 * 对话列表数据处理工具函数
 * 负责将原始对话数据派生出UI所需的结构化数据
 */

import type { Conversation, ChatMessage } from '@/types/chat'
import * as dt from '@/lib/utils/date-toolkit'

// 派生的对话数据类型，包含UI需要的额外字段
export interface DerivedConversation extends Conversation {
  lastSnippet: string
  lastUpdatedLabel: string
  isPinned?: boolean
}

// 对话分组的数据结构
export interface ConversationSection {
  title: string
  conversations: DerivedConversation[]
}

/**
 * 格式化相对时间
 * @param date 日期
 * @returns 相对时间字符串，如 "3小时前"、"昨天"、"3天前"
 */
export function formatRelativeTime(date: Date): string {
  const now = dt.now()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    if (diffMinutes < 1) return '刚刚'
    return `${diffMinutes}分钟前`
  }

  if (diffHours < 24) {
    return `${diffHours}小时前`
  }

  if (diffDays === 1) {
    return '昨天'
  }

  if (diffDays < 7) {
    return `${diffDays}天前`
  }

  if (diffWeeks === 1) {
    return '1周前'
  }

  if (diffWeeks < 4) {
    return `${diffWeeks}周前`
  }

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// 旧的标题派生函数 - 现在由服务器端处理，保留作为后备
export function deriveConversationTitle(
  conversation: Conversation,
  messages?: ChatMessage[]
): string {
  // 如果已有标题且不是默认标题，直接返回
  if (conversation.title && conversation.title !== 'New Chat' && conversation.title !== '新对话') {
    return conversation.title
  }

  // 从消息中提取标题
  const conversationMessages = messages || conversation.messages || []
  const firstUserMessage = conversationMessages.find(msg => msg.role === 'user')

  if (firstUserMessage && firstUserMessage.content) {
    // 取前50个字符作为标题
    const title = firstUserMessage.content.trim().slice(0, 50)
    return title.length > 45 ? title + '...' : title
  }

  return '新对话'
}

/**
 * 提取最新消息片段
 * @param lastMessageContent 最后一条消息内容
 * @param maxLength 最大长度，默认80字符
 * @returns 最新消息的文本片段
 */
export function extractLastSnippet(lastMessageContent: string | null, maxLength: number = 80): string {
  if (!lastMessageContent || lastMessageContent.trim().length === 0) {
    return '暂无消息'
  }

  const content = lastMessageContent.trim()
  const snippet = content.slice(0, maxLength)

  return content.length > maxLength ? snippet + '...' : snippet
}

/**
 * 安全的日期创建函数 - 消除特殊情况
 * @param timestamp 时间戳（可能是无效值）
 * @returns 有效的Date对象
 */
function safeDate(timestamp: number): Date {
  // NaN检查
  if (Number.isNaN(timestamp) || !Number.isFinite(timestamp)) {
    console.warn('⚠️ 无效的时间戳:', timestamp, '使用当前时间')
    return new Date()
  }
  return new Date(timestamp)
}

/**
 * 派生单个对话的额外字段
 * @param conversation 原始对话数据
 * @returns 包含派生字段的对话数据
 */
export function deriveConversationData(conversation: Conversation): DerivedConversation {
  const updatedAt = safeDate(conversation.updatedAt)
  const lastMessage = conversation.metadata?.lastMessage

  return {
    ...conversation,
    // 不再派生标题，直接使用服务器返回的标题
    title: conversation.title,
    // 使用 lastMessage 而不是 messages
    lastSnippet: extractLastSnippet(lastMessage?.content || null),
    lastUpdatedLabel: formatRelativeTime(updatedAt),
    isPinned: conversation.metadata?.tags?.includes('pinned') || false
  }
}

/**
 * 构建对话分组数据
 * @param conversations 原始对话列表
 * @returns 按时间分组的对话数据
 */
export function buildConversationSections(conversations: Conversation[]): ConversationSection[] {
  if (!conversations || conversations.length === 0) {
    return []
  }

  // 派生所有对话数据
  const derivedConversations = conversations.map(deriveConversationData)

  // 按固定状态和更新时间排序
  const sortedConversations = derivedConversations.sort((a, b) => {
    // 固定的对话优先
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1

    // 按最后更新时间倒序
    return b.updatedAt - a.updatedAt
  })

  // 分组逻辑
  const now = dt.now()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  console.log('📅 时间分组调试:', {
    now: now.toISOString(),
    today: today.toISOString(),
    yesterday: yesterday.toISOString(),
    weekAgo: weekAgo.toISOString(),
    firstConv: sortedConversations[0] ? {
      title: sortedConversations[0].title,
      updatedAt: safeDate(sortedConversations[0].updatedAt).toISOString()
    } : null
  })

  const sections: ConversationSection[] = []

  // 固定的对话（如果有的话）
  const pinnedConversations = sortedConversations.filter(conv => conv.isPinned)
  if (pinnedConversations.length > 0) {
    sections.push({
      title: '📌 已固定',
      conversations: pinnedConversations
    })
  }

  // 非固定对话按时间分组
  const unpinnedConversations = sortedConversations.filter(conv => !conv.isPinned)

  const todayConversations = unpinnedConversations.filter(conv => {
    const convDate = safeDate(conv.updatedAt)
    return convDate >= today
  })

  const yesterdayConversations = unpinnedConversations.filter(conv => {
    const convDate = safeDate(conv.updatedAt)
    return convDate >= yesterday && convDate < today
  })

  const thisWeekConversations = unpinnedConversations.filter(conv => {
    const convDate = safeDate(conv.updatedAt)
    return convDate >= weekAgo && convDate < yesterday
  })

  const olderConversations = unpinnedConversations.filter(conv => {
    const convDate = safeDate(conv.updatedAt)
    return convDate < weekAgo
  })

  // 添加非空分组
  if (todayConversations.length > 0) {
    sections.push({
      title: '今天',
      conversations: todayConversations
    })
  }

  if (yesterdayConversations.length > 0) {
    sections.push({
      title: '昨天',
      conversations: yesterdayConversations
    })
  }

  if (thisWeekConversations.length > 0) {
    sections.push({
      title: '本周',
      conversations: thisWeekConversations
    })
  }

  if (olderConversations.length > 0) {
    sections.push({
      title: '更早',
      conversations: olderConversations
    })
  }

  return sections
}

/**
 * 过滤对话（用于搜索功能）
 * @param conversations 对话列表
 * @param searchQuery 搜索查询
 * @returns 匹配的对话列表
 */
export function filterConversations(
  conversations: DerivedConversation[],
  searchQuery: string
): DerivedConversation[] {
  if (!searchQuery.trim()) {
    return conversations
  }

  const query = searchQuery.toLowerCase().trim()

  return conversations.filter(conv => {
    // 搜索标题
    if (conv.title.toLowerCase().includes(query)) {
      return true
    }

    // 搜索消息片段
    if (conv.lastSnippet.toLowerCase().includes(query)) {
      return true
    }

    // 搜索消息内容（深度搜索）
    if (conv.messages && conv.messages.some(msg =>
      msg.content.toLowerCase().includes(query)
    )) {
      return true
    }

    return false
  })
}

/**
 * 切换对话固定状态
 * @param conversation 对话对象
 * @returns 更新后的对话元数据
 */
export function toggleConversationPinned(conversation: DerivedConversation): {
  metadata: Conversation['metadata']
} {
  const currentTags = conversation.metadata?.tags || []
  const isPinned = currentTags.includes('pinned')

  let newTags: string[]
  if (isPinned) {
    // 取消固定
    newTags = currentTags.filter(tag => tag !== 'pinned')
  } else {
    // 固定对话
    newTags = [...currentTags, 'pinned']
  }

  // 只提取用户自定义字段，排除实时统计字段
  const { totalTokens, messageCount, lastActivity, lastMessage, ...customFields } = conversation.metadata || {}

  return {
    metadata: {
      ...customFields,  // 保留其他用户自定义字段
      tags: newTags     // 更新 tags
      // 注意：不包含 totalTokens、messageCount、lastActivity、lastMessage
      // 这些字段由服务端从数据库表列计算，不应该存储在 metadata JSON 中
    }
  }
}