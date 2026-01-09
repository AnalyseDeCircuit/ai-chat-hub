/**
 * Session Slice - 会话管理
 * 负责会话列表、当前会话的状态管理
 */
import type { Session } from '@ai-chat-hub/shared'
import type { StateCreator } from 'zustand'
import type { ChatStore } from '../chat'

export interface SessionSlice {
  // State
  currentSession: Session | null
  sessions: Session[]
  
  // Actions
  setCurrentSession: (session: Session | null) => void
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (id: string, data: Partial<Session>) => void
  removeSession: (id: string) => void
}

export const createSessionSlice: StateCreator<
  ChatStore,
  [],
  [],
  SessionSlice
> = (set) => ({
  // Initial State
  currentSession: null,
  sessions: [],
  
  // Actions
  setCurrentSession: (session) => set({ currentSession: session }),
  
  setSessions: (sessions) => set({ sessions }),
  
  addSession: (session) =>
    set((state) => ({ 
      sessions: [session, ...state.sessions] 
    })),
  
  updateSession: (id, data) =>
    set((state) => ({
      sessions: state.sessions.map((s) => 
        s.id === id ? { ...s, ...data } : s
      ),
      currentSession:
        state.currentSession?.id === id
          ? { ...state.currentSession, ...data }
          : state.currentSession,
    })),
  
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSession: state.currentSession?.id === id 
        ? null 
        : state.currentSession,
    })),
})
