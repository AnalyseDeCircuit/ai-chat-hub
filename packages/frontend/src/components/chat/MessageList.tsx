import { useEffect, useRef, useState, useCallback } from 'react'
import { Bot, User, Copy, Check, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Message, Model } from '@ai-chat-hub/shared'

interface ChatMessage extends Message {
  isStreaming?: boolean
  streamContent?: string
}

interface MessageListProps {
  messages: ChatMessage[]
  isLoading?: boolean
  models?: Model[]
  onRegenerate?: (messageId: string) => void
  onFeedback?: (messageId: string, rating: -1 | 1) => void
}

// 复制按钮组件
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="w-7 h-7 rounded-md" 
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </Button>
  )
}

// 代码块组件
function CodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-border/50 bg-[#282c34]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#21252b] border-b border-white/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-mono">{language}</span>
          <CopyButton text={code} />
        </div>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        className="!m-0 !p-4 !bg-transparent text-sm font-mono"
        codeTagProps={{ className: 'font-mono' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

// 表格块组件
function TableBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)

  const handleCopy = async () => {
    if (!tableRef.current) return
    const table = tableRef.current.querySelector('table')
    if (!table) return

    // 将表格转为文本格式
    const rows = table.querySelectorAll('tr')
    const text = Array.from(rows).map(row => {
      const cells = row.querySelectorAll('th, td')
      return Array.from(cells).map(cell => cell.textContent?.trim() || '').join('\t')
    }).join('\n')

    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-border/50 bg-card/50">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/30">
        <span className="text-sm font-medium text-muted-foreground">表格</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-500">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      {/* 表格内容 - 支持横向滚动 */}
      <div ref={tableRef} className="overflow-x-auto">
        {children}
      </div>
    </div>
  )
}

// 消息内容渲染组件
function MessageContent({ content, role }: { content: string; role: string }) {
  if (role === 'user') {
    return (
      <p className="whitespace-pre-wrap text-sm leading-[1.7] break-words">
        {content}
      </p>
    )
  }

  // 预处理 LaTeX 公式：支持多种格式
  const processedContent = content
    // 标准 LaTeX 块级公式：\[ \] -> $$ ... $$ (使用双换行确保块级渲染)
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, '\n\n$$$$$1$$$$\n\n')
    // 标准 LaTeX 行内公式：\( \) -> $ ... $
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, ' $$$1$ ')
    // 处理 AI 返回的 [ ... ] 格式 -> $$ ... $$
    .replace(/\[\s*((?:\\[a-zA-Z]+|\\partial|\\frac|\\nabla|\\vec|\\hat|\\cdot|\\times)[\s\S]*?)\s*\]/g, '\n\n$$$$$1$$$$\n\n')
    // 处理多行公式块 -> $$
    .replace(/^\s*\[\s*$/gm, '\n\n$$$$\n')
    .replace(/^\s*\]\s*$/gm, '\n$$$$\n\n')

  return (
    <ReactMarkdown
      className="prose prose-sm dark:prose-invert max-w-none 
        prose-p:leading-[1.8] prose-p:my-3 prose-pre:p-0 
        prose-headings:mb-4 prose-headings:mt-6 prose-headings:font-semibold
        prose-code:before:content-none prose-code:after:content-none
        prose-ul:my-3 prose-ol:my-3 prose-li:my-1.5
        prose-blockquote:my-4 prose-blockquote:border-l-primary"
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '')
          const codeText = String(children).replace(/\n$/, '')

          if (!inline && match) {
            return <CodeBlock language={match[1]} code={codeText} />
          }

          return (
            <code 
              className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono text-primary" 
              {...props}
            >
              {children}
            </code>
          )
        },
        // 有序列表
        ol({ children }: any) {
          return <ol className="list-decimal list-inside space-y-2 my-4">{children}</ol>
        },
        // 无序列表
        ul({ children }: any) {
          return <ul className="list-disc list-inside space-y-2 my-4">{children}</ul>
        },
        // 列表项
        li({ children }: any) {
          return <li className="leading-relaxed break-words whitespace-normal">{children}</li>
        },
        // 段落
        p({ children }: any) {
          return <p className="my-3 leading-[1.8]">{children}</p>
        },
        table({ children }: any) {
          return (
            <TableBlock>
              <table className="w-full">{children}</table>
            </TableBlock>
          )
        },
        thead({ children }: any) {
          return <thead className="border-b border-border/60">{children}</thead>
        },
        th({ children }: any) {
          return <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{children}</th>
        },
        td({ children }: any) {
          return <td className="px-4 py-4 whitespace-nowrap">{children}</td>
        },
        tr({ children }: any) {
          return <tr className="border-b border-border/30">{children}</tr>
        },
      }}
    >
      {processedContent}
    </ReactMarkdown>
  )
}

// 单条消息组件
interface MessageItemProps {
  message: ChatMessage
  isLast: boolean
  models?: Model[]
  onRegenerate?: (messageId: string) => void
  onFeedback?: (messageId: string, rating: -1 | 1) => void
}

function MessageItem({ message, isLast, models, onRegenerate, onFeedback }: MessageItemProps) {
  const [feedback, setFeedback] = useState<-1 | 1 | null>(null)
  const isUser = message.role === 'user'
  const content = message.isStreaming 
    ? message.streamContent || '' 
    : message.content

  // 获取模型名称
  const modelName = message.modelId && models 
    ? models.find(m => m.id === message.modelId)?.name || 'Unknown Model'
    : null

  const handleFeedback = (rating: -1 | 1) => {
    setFeedback(rating)
    onFeedback?.(message.id, rating)
  }

  return (
    <div className={cn('flex gap-4 group', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <Avatar className={cn(
        'w-9 h-9 flex-shrink-0 mt-1',
        isUser ? 'bg-primary' : 'bg-gradient-to-br from-blue-500 to-purple-600'
      )}>
        <AvatarFallback className={cn(
          isUser ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
        )}>
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className={cn('flex flex-col flex-1 min-w-0', isUser && 'items-end max-w-[80%] ml-auto')}>
        {/* AI模型标签 */}
        {!isUser && modelName && (
          <div className="text-xs text-muted-foreground mb-2 px-1">
            {modelName}
          </div>
        )}
        <div
          className={cn(
            isUser
              ? 'bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-tr-sm max-w-fit'
              : 'w-full'
          )}
        >
          <MessageContent content={content} role={message.role} />
          
          {/* 流式加载光标 */}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-primary/50 animate-pulse rounded-full align-middle" />
          )}
        </div>

        {/* Actions */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center gap-1 mt-2">
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <CopyButton text={message.content} />
              {onRegenerate && isLast && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-md hover:text-primary"
                  onClick={() => onRegenerate(message.id)}
                  title="重新生成"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              )}
              {onFeedback && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "w-7 h-7 rounded-md",
                      feedback === 1 ? "text-green-500" : "hover:text-green-500"
                    )}
                    onClick={() => handleFeedback(1)}
                    title="有帮助"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "w-7 h-7 rounded-md",
                      feedback === -1 ? "text-red-500" : "hover:text-red-500"
                    )}
                    onClick={() => handleFeedback(-1)}
                    title="没帮助"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
            {message.modelId && (
              <span className="text-xs text-muted-foreground ml-2 opacity-60">
                {message.modelId.split('/').pop()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 空状态组件
function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center shadow-lg shadow-primary/20">
          <Bot className="w-8 h-8 text-primary-foreground" />
        </div>
        <h2 className="text-xl font-semibold">开始新对话</h2>
        <p className="text-muted-foreground text-sm">
          选择 AI 模型，输入问题开始对话。支持多模型切换，完整保留上下文。
        </p>
      </div>
    </div>
  )
}

// 加载指示器
function LoadingIndicator() {
  return (
    <div className="flex gap-4 group">
      <Avatar className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 mt-1">
        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
          <Bot className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 pt-1">
        <div className="flex gap-1 items-center h-6">
          <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// 主组件
export function MessageList({ messages, isLoading, models, onRegenerate, onFeedback }: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // 检测用户滚动
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
    setAutoScroll(isAtBottom)
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' })
    }
  }, [messages, autoScroll])

  // 空状态
  if (messages.length === 0 && !isLoading) {
    return <EmptyState />
  }

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto px-4 py-8 12">
        {messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
            models={models}
            onRegenerate={onRegenerate}
            onFeedback={onFeedback}
          />
        ))}

        {/* 加载指示器 - 仅在最后一条不是 assistant 消息时显示 */}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <LoadingIndicator />
        )}

        {/* 底部锚点 - 用于自动滚动 */}
        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  )
}
