/**
 * Agent Executor - Agent 执行服务
 * 处理多轮工具调用的执行循环
 */
import type { ChatMessage, StreamChunk, ToolCall, ToolResult, ToolDefinition } from '@ai-chat-hub/shared'
import { toolRegistry } from './tool-registry.js'
import type { ModelAdapter, CompletionOptions } from '../adapters/base.js'

export interface AgentConfig {
  /** 最大工具调用轮数 */
  maxIterations?: number
  /** 单轮最大工具调用数 */
  maxToolCallsPerIteration?: number
  /** 工具执行超时（毫秒）*/
  toolTimeout?: number
}

export interface AgentExecutionContext {
  adapter: ModelAdapter
  apiKey: string
  model: string
  messages: ChatMessage[]
  options: CompletionOptions
  tools: ToolDefinition[]
  config?: AgentConfig
  signal?: AbortSignal
}

const DEFAULT_CONFIG: Required<AgentConfig> = {
  maxIterations: 10,
  maxToolCallsPerIteration: 5,
  toolTimeout: 30000,
}

/**
 * Agent 执行器
 * 实现 ReAct 模式的工具调用循环
 */
export async function executeAgent(
  context: AgentExecutionContext,
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const config = { ...DEFAULT_CONFIG, ...context.config }
  const { adapter, apiKey, model, options, tools, signal } = context
  
  // 工作消息列表（包含工具调用历史）
  let workingMessages = [...context.messages]
  let iteration = 0

  while (iteration < config.maxIterations) {
    if (signal?.aborted) {
      break
    }

    iteration++
    
    // 收集本轮的工具调用
    const pendingToolCalls: ToolCall[] = []
    let assistantContent = ''

    // 调用模型
    await adapter.streamCompletion(
      apiKey,
      model,
      workingMessages,
      {
        ...options,
        tools,
        toolChoice: 'auto',
      },
      (chunk) => {
        if (chunk.type === 'content' && chunk.content) {
          assistantContent += chunk.content
          onChunk(chunk)
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          pendingToolCalls.push(chunk.toolCall)
          // 通知前端有工具调用
          onChunk({
            type: 'tool_call',
            toolCall: chunk.toolCall,
          })
        } else if (chunk.type === 'done') {
          // 如果没有工具调用，直接传递 done
          if (pendingToolCalls.length === 0) {
            onChunk(chunk)
          }
        } else if (chunk.type === 'error') {
          onChunk(chunk)
        }
      },
      signal
    )

    // 如果没有工具调用，结束循环
    if (pendingToolCalls.length === 0) {
      break
    }

    // 限制每轮工具调用数量
    const toolCallsToExecute = pendingToolCalls.slice(0, config.maxToolCallsPerIteration)

    // 添加助手消息（包含工具调用）
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: assistantContent,
      toolCalls: toolCallsToExecute,
    }
    workingMessages.push(assistantMessage)

    // 执行工具调用
    const toolResults = await executeToolCalls(toolCallsToExecute, config.toolTimeout)

    // 发送工具执行结果到前端
    for (const result of toolResults) {
      onChunk({
        type: 'tool_result',
        toolResult: result,
      })
    }

    // 添加工具结果消息
    for (const result of toolResults) {
      const toolMessage: ChatMessage = {
        role: 'tool',
        content: result.content,
        toolCallId: result.toolCallId,
        name: result.name,
      }
      workingMessages.push(toolMessage)
    }
  }

  // 如果达到最大迭代次数，发送警告
  if (iteration >= config.maxIterations) {
    onChunk({
      type: 'content',
      content: '\n\n[警告: 达到最大工具调用轮数限制]',
    })
    onChunk({
      type: 'done',
    })
  }
}

/**
 * 执行工具调用
 */
async function executeToolCalls(
  toolCalls: ToolCall[],
  timeout: number
): Promise<ToolResult[]> {
  const results: ToolResult[] = []

  for (const tc of toolCalls) {
    try {
      // 添加超时控制
      const result = await Promise.race([
        toolRegistry.execute(tc.name, tc.id, tc.arguments),
        new Promise<ToolResult>((_, reject) =>
          setTimeout(() => reject(new Error('工具执行超时')), timeout)
        ),
      ])
      results.push(result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.push({
        toolCallId: tc.id,
        name: tc.name,
        content: `工具执行错误: ${errorMessage}`,
        isError: true,
      })
    }
  }

  return results
}

/**
 * 简单的单次工具调用执行（非 Agent 模式）
 * 只执行一轮工具调用，不进入循环
 */
export async function executeSingleRound(
  context: AgentExecutionContext,
  onChunk: (chunk: StreamChunk) => void
): Promise<{ hasToolCalls: boolean; toolResults?: ToolResult[] }> {
  const { adapter, apiKey, model, options, tools, signal } = context
  
  const pendingToolCalls: ToolCall[] = []

  await adapter.streamCompletion(
    apiKey,
    model,
    context.messages,
    {
      ...options,
      tools,
      toolChoice: 'auto',
    },
    (chunk) => {
      if (chunk.type === 'tool_call' && chunk.toolCall) {
        pendingToolCalls.push(chunk.toolCall)
        onChunk(chunk)
      } else {
        onChunk(chunk)
      }
    },
    signal
  )

  if (pendingToolCalls.length === 0) {
    return { hasToolCalls: false }
  }

  // 执行工具调用
  const toolResults = await toolRegistry.executeMany(pendingToolCalls)
  
  return { hasToolCalls: true, toolResults }
}
