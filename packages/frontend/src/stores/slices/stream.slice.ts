/**
 * Stream Slice - 流式响应管理
 * 负责流式消息的状态、内容累积、推理过程等
 */
import type { StateCreator } from 'zustand'
import type { ChatStore } from '../chat'

// 流式响应中的结构化数据
export interface StreamChunk {
  type: 'content' | 'reasoning' | 'tool_call' | 'tool_result' | 'done' | 'error'
  content?: string
  toolCall?: {
    id: string
    name: string
    arguments: string
  }
  toolResult?: {
    callId: string
    result: string
  }
  usage?: {
    promptTokens: number
    completionTokens: number
  }
  error?: string
}

// 单条消息的流式状态
export interface StreamState {
  messageId: string
  content: string           // 主要内容
  reasoning: string         // 推理/思考过程
  toolCalls: Array<{        // 工具调用列表
    id: string
    name: string
    arguments: string
    status: 'pending' | 'running' | 'completed' | 'error'
    result?: string
  }>
  isComplete: boolean
  startTime: number
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

export interface StreamSlice {
  // State
  activeStreams: Map<string, StreamState>  // messageId -> StreamState
  
  // Actions
  startStream: (messageId: string) => void
  appendContent: (messageId: string, content: string) => void
  appendReasoning: (messageId: string, reasoning: string) => void
  addToolCall: (messageId: string, toolCall: StreamChunk['toolCall']) => void
  updateToolResult: (messageId: string, callId: string, result: string) => void
  finishStream: (messageId: string, usage?: StreamChunk['usage']) => void
  abortStream: (messageId: string) => void
  
  // Selectors
  getStreamState: (messageId: string) => StreamState | undefined
  isStreaming: (messageId: string) => boolean
}

export const createStreamSlice: StateCreator<
  ChatStore,
  [],
  [],
  StreamSlice
> = (set, get) => ({
  // Initial State
  activeStreams: new Map(),
  
  // Actions
  startStream: (messageId) =>
    set((state) => {
      const newStreams = new Map(state.activeStreams)
      newStreams.set(messageId, {
        messageId,
        content: '',
        reasoning: '',
        toolCalls: [],
        isComplete: false,
        startTime: Date.now(),
      })
      return { activeStreams: newStreams }
    }),
  
  appendContent: (messageId, content) =>
    set((state) => {
      const stream = state.activeStreams.get(messageId)
      if (!stream) return state
      
      const newStreams = new Map(state.activeStreams)
      newStreams.set(messageId, {
        ...stream,
        content: stream.content + content,
      })
      
      // 同步更新消息列表中的 streamContent
      const messages = state.messages.map((m) =>
        m.id === messageId
          ? { ...m, streamContent: stream.content + content }
          : m
      )
      
      return { activeStreams: newStreams, messages }
    }),
  
  appendReasoning: (messageId, reasoning) =>
    set((state) => {
      const stream = state.activeStreams.get(messageId)
      if (!stream) return state
      
      const newStreams = new Map(state.activeStreams)
      newStreams.set(messageId, {
        ...stream,
        reasoning: stream.reasoning + reasoning,
      })
      
      // 同步更新消息的 reasoning 元数据
      const messages = state.messages.map((m) =>
        m.id === messageId
          ? { 
              ...m, 
              metadata: { 
                ...m.metadata, 
                reasoning: stream.reasoning + reasoning 
              } 
            }
          : m
      )
      
      return { activeStreams: newStreams, messages }
    }),
  
  addToolCall: (messageId, toolCall) =>
    set((state) => {
      const stream = state.activeStreams.get(messageId)
      if (!stream || !toolCall) return state
      
      const newStreams = new Map(state.activeStreams)
      newStreams.set(messageId, {
        ...stream,
        toolCalls: [
          ...stream.toolCalls,
          {
            ...toolCall,
            status: 'pending',
          },
        ],
      })
      return { activeStreams: newStreams }
    }),
  
  updateToolResult: (messageId, callId, result) =>
    set((state) => {
      const stream = state.activeStreams.get(messageId)
      if (!stream) return state
      
      const newStreams = new Map(state.activeStreams)
      newStreams.set(messageId, {
        ...stream,
        toolCalls: stream.toolCalls.map((tc) =>
          tc.id === callId
            ? { ...tc, status: 'completed' as const, result }
            : tc
        ),
      })
      return { activeStreams: newStreams }
    }),
  
  finishStream: (messageId, usage) =>
    set((state) => {
      const stream = state.activeStreams.get(messageId)
      if (!stream) return state
      
      // 将流式内容转移到正式消息
      const messages = state.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              content: stream.content,
              isStreaming: false,
              streamContent: undefined,
              tokensInput: usage?.promptTokens || 0,
              tokensOutput: usage?.completionTokens || 0,
              metadata: {
                ...m.metadata,
                reasoning: stream.reasoning || undefined,
                toolCalls: stream.toolCalls.length > 0 ? stream.toolCalls : undefined,
                latencyMs: Date.now() - stream.startTime,
              },
            }
          : m
      )
      
      // 清理流式状态
      const newStreams = new Map(state.activeStreams)
      newStreams.delete(messageId)
      
      return { activeStreams: newStreams, messages }
    }),
  
  abortStream: (messageId) =>
    set((state) => {
      const stream = state.activeStreams.get(messageId)
      if (!stream) return state
      
      // 保留已生成的内容
      const messages = state.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              content: stream.content || '（已取消）',
              isStreaming: false,
              streamContent: undefined,
              metadata: {
                ...m.metadata,
                finishReason: 'cancelled',
              },
            }
          : m
      )
      
      const newStreams = new Map(state.activeStreams)
      newStreams.delete(messageId)
      
      return { activeStreams: newStreams, messages }
    }),
  
  // Selectors
  getStreamState: (messageId) => get().activeStreams.get(messageId),
  
  isStreaming: (messageId) => {
    const stream = get().activeStreams.get(messageId)
    return stream ? !stream.isComplete : false
  },
})
