/**
 * Tool Registry - 工具注册和执行服务
 * 管理内置工具和自定义工具
 */
import type { ToolDefinition, ToolResult, BuiltinToolType } from '@ai-chat-hub/shared'

/**
 * 工具处理器函数类型
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>

/**
 * 注册的工具
 */
interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
}

/**
 * 工具注册表
 */
class ToolRegistry {
  private tools = new Map<string, RegisteredTool>()

  /**
   * 注册一个工具
   */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler })
  }

  /**
   * 取消注册工具
   */
  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  /**
   * 获取工具定义
   */
  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition
  }

  /**
   * 获取所有工具定义
   */
  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition)
  }

  /**
   * 根据内置工具类型获取工具定义
   */
  getBuiltinTools(types: BuiltinToolType[]): ToolDefinition[] {
    return types
      .map(type => this.tools.get(type)?.definition)
      .filter((d): d is ToolDefinition => d !== undefined)
  }

  /**
   * 执行工具
   */
  async execute(name: string, toolCallId: string, argsJson: string): Promise<ToolResult> {
    const tool = this.tools.get(name)
    
    if (!tool) {
      return {
        toolCallId,
        name,
        content: `错误: 未知工具 "${name}"`,
        isError: true,
      }
    }

    try {
      const args = JSON.parse(argsJson)
      const result = await tool.handler(args)
      return {
        toolCallId,
        name,
        content: result,
        isError: false,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        toolCallId,
        name,
        content: `工具执行失败: ${errorMessage}`,
        isError: true,
      }
    }
  }

  /**
   * 批量执行工具
   */
  async executeMany(
    calls: Array<{ id: string; name: string; arguments: string }>
  ): Promise<ToolResult[]> {
    return Promise.all(
      calls.map(call => this.execute(call.name, call.id, call.arguments))
    )
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * 获取已注册工具数量
   */
  get size(): number {
    return this.tools.size
  }
}

// 单例实例
export const toolRegistry = new ToolRegistry()

// 导出类型
export { ToolRegistry }
