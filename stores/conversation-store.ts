/**
 * 对话状态管理 Store
 * 使用 Zustand 统一管理对话相关的所有状态
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Conversation, ChatMessage } from '@/types/chat'

// Store 状态类型定义
interface ConversationState {
  // 对话列表
  conversations: Conversation[]
  // 当前选中的对话ID
  currentConversationId: string | null
  // 当前对话对象（计算得出）
  currentConversation: Conversation | null
  // 加载状态
  isLoading: boolean
  isCreating: boolean
  isDeleting: boolean
  isUpdating: boolean
  // 错误状态
  error: string | null
  // 搜索和过滤
  searchQuery: string
  filterModel: string | null
}

// Store Actions
interface ConversationActions {
  // 对话列表操作
  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  deleteConversation: (id: string) => void
  
  // 选择对话
  selectConversation: (id: string | null) => void
  
  // 消息操作
  addMessage: (conversationId: string, message: ChatMessage) => void
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void
  deleteMessage: (conversationId: string, messageId: string) => void
  
  // 加载状态管理
  setLoading: (loading: boolean) => void
  setCreating: (creating: boolean) => void
  setDeleting: (deleting: boolean) => void
  setUpdating: (updating: boolean) => void
  
  // 错误处理
  setError: (error: string | null) => void
  clearError: () => void
  
  // 搜索和过滤
  setSearchQuery: (query: string) => void
  setFilterModel: (model: string | null) => void
  
  // 工具方法
  getConversationById: (id: string) => Conversation | undefined
  getFilteredConversations: () => Conversation[]
  clearAll: () => void
}

// 完整的 Store 类型
type ConversationStore = ConversationState & ConversationActions

// 初始状态
export const conversationStoreInitialState: ConversationState = {
  conversations: [],
  currentConversationId: null,
  currentConversation: null,
  isLoading: false,
  isCreating: false,
  isDeleting: false,
  isUpdating: false,
  error: null,
  searchQuery: '',
  filterModel: null,
}

// 创建 Store
export const useConversationStore = create<ConversationStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // 初始状态
        ...conversationStoreInitialState,
        
        // 对话列表操作
        setConversations: (conversations) => 
          set((state) => {
            state.conversations = conversations
            // 如果当前选中的对话在新列表中，更新它
            if (state.currentConversationId) {
              const current = conversations.find(c => c.id === state.currentConversationId)
              state.currentConversation = current || null
            }
          }),
        
        addConversation: (conversation) =>
          set((state) => {
            state.conversations.unshift(conversation)
          }),
        
        updateConversation: (id, updates) =>
          set((state) => {
            const index = state.conversations.findIndex(c => c.id === id)
            if (index !== -1) {
              Object.assign(state.conversations[index], updates)
              // 如果更新的是当前对话，同步更新
              if (state.currentConversationId === id) {
                state.currentConversation = { ...state.conversations[index] }
              }
            }
          }),
        
        deleteConversation: (id) =>
          set((state) => {
            state.conversations = state.conversations.filter(c => c.id !== id)
            // 如果删除的是当前对话，清空选择
            if (state.currentConversationId === id) {
              state.currentConversationId = null
              state.currentConversation = null
            }
          }),
        
        // 选择对话
        selectConversation: (id) =>
          set((state) => {
            state.currentConversationId = id
            state.currentConversation = id 
              ? state.conversations.find(c => c.id === id) || null
              : null
          }),
        
        // 消息操作
        addMessage: (conversationId, message) =>
          set((state) => {
            const conversation = state.conversations.find(c => c.id === conversationId)
            if (conversation) {
              const now = Date.now()
              const tokens = message.tokens ?? 0
              conversation.messages.push(message)
              conversation.updatedAt = now
              // 更新元数据
              const metadata = conversation.metadata ?? (conversation.metadata = {})
              metadata.messageCount = conversation.messages.length
              metadata.lastActivity = now
              metadata.totalTokens = (metadata.totalTokens ?? 0) + tokens
            }
          }),
        
        updateMessage: (conversationId, messageId, updates) =>
          set((state) => {
            const conversation = state.conversations.find(c => c.id === conversationId)
            if (conversation) {
              const message = conversation.messages.find(m => m.id === messageId)
              if (message) {
                Object.assign(message, updates)
              }
            }
          }),
        
        deleteMessage: (conversationId, messageId) =>
          set((state) => {
            const conversation = state.conversations.find(c => c.id === conversationId)
            if (conversation) {
              conversation.messages = conversation.messages.filter(m => m.id !== messageId)
              // 更新元数据
              if (conversation.metadata) {
                conversation.metadata.messageCount = conversation.messages.length
              }
            }
          }),
        
        // 加载状态管理
        setLoading: (loading) => set({ isLoading: loading }),
        setCreating: (creating) => set({ isCreating: creating }),
        setDeleting: (deleting) => set({ isDeleting: deleting }),
        setUpdating: (updating) => set({ isUpdating: updating }),
        
        // 错误处理
        setError: (error) => set({ error }),
        clearError: () => set({ error: null }),
        
        // 搜索和过滤
        setSearchQuery: (query) => set({ searchQuery: query }),
        setFilterModel: (model) => set({ filterModel: model }),
        
        // 工具方法
        getConversationById: (id) => get().conversations.find(c => c.id === id),
        
        getFilteredConversations: () => {
          const { conversations, searchQuery, filterModel } = get()
          let filtered = [...conversations]
          
          // 按搜索词过滤
          if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(c => 
              c.title.toLowerCase().includes(query) ||
              c.messages.some(m => m.content.toLowerCase().includes(query))
            )
          }
          
          // 按模型过滤
          if (filterModel) {
            filtered = filtered.filter(c => c.model === filterModel)
          }
          
          // 按更新时间排序
          filtered.sort((a, b) => b.updatedAt - a.updatedAt)
          
          return filtered
        },
        
        clearAll: () => set(conversationStoreInitialState),
      })),
      {
        name: 'conversation-storage',
        // 只持久化部分状态
        partialize: (state) => ({
          currentConversationId: state.currentConversationId,
          searchQuery: state.searchQuery,
          filterModel: state.filterModel,
        }),
      }
    ),
    {
      name: 'ConversationStore',
    }
  )
)

// 导出 Hooks
export const useConversations = () => useConversationStore((state) => state.conversations)
export const useCurrentConversation = () => useConversationStore((state) => state.currentConversation)
export const useCurrentConversationId = () => useConversationStore((state) => state.currentConversationId)
export const useConversationActions = () => useConversationStore((state) => ({
  setConversations: state.setConversations,
  addConversation: state.addConversation,
  updateConversation: state.updateConversation,
  deleteConversation: state.deleteConversation,
  selectConversation: state.selectConversation,
  addMessage: state.addMessage,
  updateMessage: state.updateMessage,
  deleteMessage: state.deleteMessage,
}))
export const useConversationLoading = () => useConversationStore((state) => ({
  isLoading: state.isLoading,
  isCreating: state.isCreating,
  isDeleting: state.isDeleting,
  isUpdating: state.isUpdating,
}))
