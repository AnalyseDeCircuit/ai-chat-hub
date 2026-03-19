/**
 * ToolCallBlock - 工具调用显示组件
 * 用于在消息中展示 Function Calling 的调用过程和结果
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Search, Calculator, Clock, Link } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolCallProps {
  id: string
  name: string
  arguments: string
  status: 'pending' | 'running' | 'completed' | 'error'
  result?: string
}

// 工具图标映射
const toolIcons: Record<string, typeof Search> = {
  web_search: Search,
  calculator: Calculator,
  get_current_time: Clock,
  url_reader: Link,
}

// 工具名称映射
const toolNames: Record<string, string> = {
  web_search: '联网搜索',
  calculator: '计算器',
  get_current_time: '获取时间',
  url_reader: '读取网页',
}

export function ToolCallBlock({ name, arguments: args, status, result }: ToolCallProps) {
  const [expanded, setExpanded] = useState(status === 'error' || false)
  
  const Icon = toolIcons[name] || Search
  const displayName = toolNames[name] || name
  
  // 解析参数
  let parsedArgs: Record<string, unknown> = {}
  try {
    parsedArgs = JSON.parse(args)
  } catch {
    // 保持为空对象
  }
  
  // 状态图标
  const StatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-red-500" />
      default:
        return null
    }
  }
  
  // 状态文字
  const statusText = {
    pending: '等待执行',
    running: '执行中...',
    completed: '已完成',
    error: '执行失败',
  }

  return (
    <div className={cn(
      'my-2 rounded-lg border overflow-hidden',
      status === 'error' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30' : 'border-border bg-muted/30'
    )}>
      {/* 头部 - 可点击展开/折叠 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left',
          'hover:bg-muted/50 transition-colors'
        )}
      >
        {/* 展开/折叠图标 */}
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        
        {/* 工具图标 */}
        <Icon className="w-4 h-4 text-primary flex-shrink-0" />
        
        {/* 工具名称 */}
        <span className="text-sm font-medium flex-1">{displayName}</span>
        
        {/* 状态 */}
        <div className="flex items-center gap-1.5">
          <StatusIcon />
          <span className={cn(
            'text-xs',
            status === 'error' ? 'text-red-500' : 'text-muted-foreground'
          )}>
            {statusText[status]}
          </span>
        </div>
      </button>
      
      {/* 展开的详情 */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50">
          {/* 参数 */}
          {Object.keys(parsedArgs).length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">参数:</p>
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                {JSON.stringify(parsedArgs, null, 2)}
              </pre>
            </div>
          )}
          
          {/* 结果 */}
          {result && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {status === 'error' ? '错误信息:' : '结果:'}
              </p>
              <pre className={cn(
                'text-xs rounded p-2 overflow-x-auto whitespace-pre-wrap',
                status === 'error' ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : 'bg-muted'
              )}>
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 工具调用列表
 */
interface ToolCallListProps {
  toolCalls: Array<{
    id: string
    name: string
    arguments: string
    status: 'pending' | 'running' | 'completed' | 'error'
    result?: string
  }>
}

export function ToolCallList({ toolCalls }: ToolCallListProps) {
  if (toolCalls.length === 0) return null
  
  return (
    <div className="space-y-1">
      {toolCalls.map((tc) => (
        <ToolCallBlock
          key={tc.id}
          id={tc.id}
          name={tc.name}
          arguments={tc.arguments}
          status={tc.status}
          result={tc.result}
        />
      ))}
    </div>
  )
}
