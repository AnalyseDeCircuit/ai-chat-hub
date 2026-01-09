/**
 * Message Slice - 消息管理
 * 负责消息列表的 CRUD 操作
 */
import type { StateCreator } from 'zustand'
import type { ChatStore, ChatMessage } from '../chat'

export interface MessageSlice {
  // State
  messages: ChatMessage[]
  
  // Actions
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, data: Partial<ChatMessage>) => void
  removeMessage: (id: string) => void
  clearMessages: () => void
}

export const createMessageSlice: StateCreator<
  ChatStore,
  [],
  [],
  MessageSlice
> = (set) => ({
  // Initial State
  messages: [],
  
  // Actions
  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) =>
    set((state) => ({ 
      messages: [...state.messages, message] 
    })),
  
  updateMessage: (id, data) =>
    set((state) => ({
      messages: state.messages.map((m) => 
        m.id === id ? { ...m, ...data } : m
      ),
    })),
  
  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),
  
  clearMessages: () => set({ messages: [] }),
})
