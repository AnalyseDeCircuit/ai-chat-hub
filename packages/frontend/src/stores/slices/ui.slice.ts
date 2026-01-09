/**
 * UI Slice - 界面状态管理
 * 负责加载状态、侧边栏、错误提示等 UI 相关状态
 */
import type { Model } from '@ai-chat-hub/shared'
import type { StateCreator } from 'zustand'
import type { ChatStore } from '../chat'

export interface UISlice {
  // State
  models: Model[]
  currentModelId: string | null
  isLoading: boolean
  isSending: boolean
  error: string | null
  sidebarOpen: boolean
  
  // Actions
  setModels: (models: Model[]) => void
  setCurrentModelId: (modelId: string | null) => void
  setLoading: (loading: boolean) => void
  setSending: (sending: boolean) => void
  setError: (error: string | null) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const createUISlice: StateCreator<
  ChatStore,
  [],
  [],
  UISlice
> = (set) => ({
  // Initial State
  models: [],
  currentModelId: null,
  isLoading: false,
  isSending: false,
  error: null,
  sidebarOpen: true,
  
  // Actions
  setModels: (models) => set({ models }),
  
  setCurrentModelId: (currentModelId) => set({ currentModelId }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setSending: (isSending) => set({ isSending }),
  
  setError: (error) => set({ error }),
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
})
