import type {
  ChatMessage,
  ChatSessionStatus,
  ChatState
} from '@/types/chat'

const BUSY_STATUSES: ReadonlySet<ChatSessionStatus> = new Set([
  'preparing',
  'requesting',
  'streaming'
])

export const selectSessionStatus = (state: ChatState): ChatSessionStatus => state.session.status
export const selectSessionError = (state: ChatState): string | null => state.session.error
export const selectSessionUpdatedAt = (state: ChatState): number | null => state.session.updatedAt
export const selectActiveConversationId = (state: ChatState): string | null => state.session.conversationId
export const selectSyncedConversationId = (state: ChatState): string | null => state.session.sync.conversationId
export const selectSyncStatus = (state: ChatState) => state.session.sync.status

export const selectIsSessionBusy = (state: ChatState): boolean =>
  BUSY_STATUSES.has(state.session.status)

export const selectIsStreaming = (state: ChatState): boolean =>
  state.session.status === 'streaming'

export const selectMessages = (state: ChatState): ChatMessage[] => state.history.messages
export const selectHistoryHasMoreBefore = (state: ChatState): boolean =>
  state.history.pagination.hasMoreBefore
export const selectHistoryCursorBeforeId = (state: ChatState): string | null =>
  state.history.pagination.cursor?.beforeId ?? null

export const selectComposerInput = (state: ChatState): string => state.composer.input
export const selectComposerSettings = (state: ChatState) => state.composer.settings
export const selectComposerEditingTitle = (state: ChatState): boolean => state.composer.editingTitle
export const selectComposerTempTitle = (state: ChatState): string => state.composer.tempTitle
