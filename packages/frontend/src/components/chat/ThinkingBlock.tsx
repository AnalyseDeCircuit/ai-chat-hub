/**
 * ThinkingBlock - AI 推理/思考过程展示组件
 * 支持折叠展开，带计时器显示思考时长
 */
import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Brain, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThinkingBlockProps {
  content: string
  isStreaming?: boolean
  defaultExpanded?: boolean
}

export function ThinkingBlock({ 
  content, 
  isStreaming = false, 
  defaultExpanded = false 
}: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [thinkingTime, setThinkingTime] = useState(0)
  const startTimeRef = useRef<number>(Date.now())
  const contentRef = useRef<HTMLDivElement>(null)

  // 计时器
  useEffect(() => {
    if (!isStreaming) return

    startTimeRef.current = Date.now()
    const timer = setInterval(() => {
      setThinkingTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    return () => clearInterval(timer)
  }, [isStreaming])

  // 流式时自动滚动到底部
  useEffect(() => {
    if (isStreaming && expanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [content, isStreaming, expanded])

  // 格式化时间
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  }

  // 简要预览（截取前100个字符）
  const preview = content.slice(0, 100).replace(/\n/g, ' ')

  return (
    <div className="my-4 rounded-xl border border-border/50 bg-gradient-to-br from-violet-500/5 to-purple-500/5 overflow-hidden">
      {/* 标题栏 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
          {isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Brain className="w-4 h-4" />
          )}
          <span className="font-medium text-sm">
            {isStreaming ? '正在思考...' : '思考过程'}
          </span>
        </div>
        
        {/* 思考时间 */}
        <span className="text-xs text-muted-foreground">
          {isStreaming 
            ? formatTime(thinkingTime)
            : content.length > 0 
              ? `${content.length} 字符` 
              : ''
          }
        </span>
        
        <div className="flex-1" />
        
        {/* 预览 */}
        {!expanded && content && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {preview}...
          </span>
        )}
        
        {/* 展开/折叠图标 */}
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* 内容区域 */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          expanded ? 'max-h-[400px]' : 'max-h-0'
        )}
      >
        <div
          ref={contentRef}
          className={cn(
            'px-4 pb-4 overflow-y-auto max-h-[380px]',
            'text-sm text-muted-foreground leading-relaxed',
            'prose prose-sm dark:prose-invert max-w-none',
            'prose-p:my-2 prose-p:leading-relaxed'
          )}
        >
          {/* 渲染思考内容，保留换行 */}
          {content.split('\n').map((line, i) => (
            <p key={i} className="my-1">
              {line || '\u00A0'}
            </p>
          ))}
          
          {/* 流式光标 */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-violet-500/50 animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </div>
  )
}
