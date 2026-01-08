import { create } from 'zustand'
import type { Session, Message, Model } from '@ai-chat-hub/shared'

interface ChatMessage extends Message {
  isStreaming?: boolean
  streamContent?: string
}

interface ChatState {
  // 当前会话
  currentSession: Session | null
  sessions: Session[]
  
  // 消息
  messages: ChatMessage[]
  
  // 模型
  models: Model[]
  currentModelId: string | null
  
  // 状态
  isLoading: boolean
  isSending: boolean
  error: string | null

  // 侧边栏
  sidebarOpen: boolean

  // Actions
  setCurrentSession: (session: Session | null) => void
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (id: string, data: Partial<Session>) => void
  removeSession: (id: string) => void
  
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, data: Partial<ChatMessage>) => void
  appendToMessage: (id: string, content: string) => void
  finishStreamingMessage: (id: string, newId?: string, usage?: { promptTokens: number; completionTokens: number }) => void
  
  setModels: (models: Model[]) => void
  setCurrentModelId: (modelId: string | null) => void
  
  setLoading: (loading: boolean) => void
  setSending: (sending: boolean) => void
  setError: (error: string | null) => void
  
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  
  reset: () => void
}

const initialState = {
  currentSession: null,
  sessions: [],
  messages: [],
  models: [],
  currentModelId: null,
  isLoading: false,
  isSending: false,
  error: null,
  sidebarOpen: true,
}

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  setCurrentSession: (session) => set({ currentSession: session }),
  
  setSessions: (sessions) => set({ sessions }),
  
  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),
  
  updateSession: (id, data) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...data } : s)),
      currentSession:
        state.currentSession?.id === id
          ? { ...state.currentSession, ...data }
          : state.currentSession,
    })),
  
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSession: state.currentSession?.id === id ? null : state.currentSession,
    })),

  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  
  updateMessage: (id, data) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...data } : m)),
    })),
  
  appendToMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id
          ? { ...m, streamContent: (m.streamContent || '') + content }
          : m
      ),
    })),

  // 完成流式消息：将 streamContent 复制到 content
  finishStreamingMessage: (id, newId, usage) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              id: newId || m.id,
              content: m.streamContent || '',
              isStreaming: false,
              tokensInput: usage?.promptTokens || 0,
              tokensOutput: usage?.completionTokens || 0,
            }
          : m
      ),
    })),

  setModels: (models) => set({ models }),
  
  setCurrentModelId: (modelId) => set({ currentModelId: modelId }),

  setLoading: (isLoading) => set({ isLoading }),
  
  setSending: (isSending) => set({ isSending }),
  
  setError: (error) => set({ error }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  reset: () => set(initialState),
}))
