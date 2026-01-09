/**
 * Chat Store - 组合所有 slice
 * 采用 slice 模式实现关注点分离，便于维护和测试
 */
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Message } from '@ai-chat-hub/shared'
import {
  createSessionSlice,
  createMessageSlice,
  createStreamSlice,
  createUISlice,
  type SessionSlice,
  type MessageSlice,
  type StreamSlice,
  type UISlice,
} from './slices'

// 扩展 Message 类型支持流式状态
export interface ChatMessage extends Message {
  isStreaming?: boolean
  streamContent?: string
  metadata: Message['metadata'] & {
    reasoning?: string
    toolCalls?: Array<{
      id: string
      name: string
      arguments: string
      status: string
      result?: string
    }>
  }
}

// 组合所有 slice 类型
export type ChatStore = SessionSlice & MessageSlice & StreamSlice & UISlice & {
  // 便捷方法：兼容旧 API
  appendToMessage: (id: string, content: string) => void
  finishStreamingMessage: (id: string, newId?: string, usage?: { promptTokens: number; completionTokens: number }) => void
  reset: () => void
}

// 初始状态（用于 reset）
const getInitialState = () => ({
  currentSession: null,
  sessions: [],
  messages: [],
  activeStreams: new Map(),
  models: [],
  currentModelId: null,
  isLoading: false,
  isSending: false,
  error: null,
  sidebarOpen: true,
})

export const useChatStore = create<ChatStore>()(
  devtools(
    (...args) => {
      const [set, get] = args
      
      return {
        // 组合所有 slice
        ...createSessionSlice(...args),
        ...createMessageSlice(...args),
        ...createStreamSlice(...args),
        ...createUISlice(...args),
        
        // 兼容旧 API：appendToMessage -> appendContent
        appendToMessage: (id, content) => {
          const { appendContent, activeStreams } = get()
          // 如果流还没启动，先启动
          if (!activeStreams.has(id)) {
            get().startStream(id)
          }
          appendContent(id, content)
        },
        
        // 兼容旧 API：finishStreamingMessage -> finishStream
        finishStreamingMessage: (id, newId, usage) => {
          const { finishStream, updateMessage } = get()
          finishStream(id, usage)
          // 如果有新 ID，更新消息 ID
          if (newId && newId !== id) {
            updateMessage(id, { id: newId } as any)
          }
        },
        
        // 重置所有状态
        reset: () => set(getInitialState()),
      }
    },
    { name: 'chat-store' }
  )
)

// ==================== Selectors ====================
// 使用 selector 避免不必要的重渲染

export const chatSelectors = {
  // 会话相关
  currentSession: (state: ChatStore) => state.currentSession,
  sessions: (state: ChatStore) => state.sessions,
  sessionById: (id: string) => (state: ChatStore) => 
    state.sessions.find(s => s.id === id),
  
  // 消息相关
  messages: (state: ChatStore) => state.messages,
  messageById: (id: string) => (state: ChatStore) => 
    state.messages.find(m => m.id === id),
  lastMessage: (state: ChatStore) => 
    state.messages[state.messages.length - 1],
  assistantMessages: (state: ChatStore) => 
    state.messages.filter(m => m.role === 'assistant'),
  
  // 流式相关
  isMessageStreaming: (id: string) => (state: ChatStore) =>
    state.activeStreams.has(id),
  streamContent: (id: string) => (state: ChatStore) =>
    state.activeStreams.get(id)?.content || '',
  streamReasoning: (id: string) => (state: ChatStore) =>
    state.activeStreams.get(id)?.reasoning || '',
  hasActiveStream: (state: ChatStore) =>
    state.activeStreams.size > 0,
  
  // UI 相关
  currentModel: (state: ChatStore) =>
    state.models.find(m => m.id === state.currentModelId),
  availableModels: (state: ChatStore) => state.models,
  isLoading: (state: ChatStore) => state.isLoading,
  isSending: (state: ChatStore) => state.isSending,
  isBusy: (state: ChatStore) => state.isLoading || state.isSending,
}

