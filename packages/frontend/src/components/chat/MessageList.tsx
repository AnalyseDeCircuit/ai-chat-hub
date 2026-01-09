import { useEffect, useRef, useState, useCallback } from 'react'
import { Bot, User, Copy, Check, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Message } from '@ai-chat-hub/shared'

interface ChatMessage extends Message {
  isStreaming?: boolean
  streamContent?: string
}

interface MessageListProps {
  messages: ChatMessage[]
  isLoading?: boolean
  onRegenerate?: (messageId: string) => void
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
        className="!m-0 !p-4 !bg-transparent text-sm"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

// 消息内容渲染组件
function MessageContent({ content, role }: { content: string; role: string }) {
  if (role === 'user') {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed break-words">
        {content}
      </p>
    )
  }

  return (
    <ReactMarkdown
      className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0"
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
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// 单条消息组件
interface MessageItemProps {
  message: ChatMessage
  isLast: boolean
  onRegenerate?: (messageId: string) => void
}

function MessageItem({ message, isLast, onRegenerate }: MessageItemProps) {
  const isUser = message.role === 'user'
  const content = message.isStreaming 
    ? message.streamContent || '' 
    : message.content

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <Avatar className={cn(
        'w-8 h-8 flex-shrink-0',
        isUser ? 'bg-primary' : 'bg-muted border border-border'
      )}>
        <AvatarFallback className={cn(
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}>
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className={cn('flex flex-col max-w-[80%] min-w-0', isUser && 'items-end')}>
        <div
          className={cn(
            'px-4 py-3 rounded-2xl',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-card border border-border/50 rounded-tl-sm'
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
          <div className="flex items-center gap-1 mt-1 opacity-0 hover:opacity-100 transition-opacity">
            <CopyButton text={message.content} />
            {onRegenerate && isLast && (
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 rounded-md"
                onClick={() => onRegenerate(message.id)}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            )}
            {message.modelId && (
              <span className="text-xs text-muted-foreground ml-2">
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
    <div className="flex gap-3">
      <Avatar className="w-8 h-8 bg-muted border border-border">
        <AvatarFallback className="bg-muted text-muted-foreground">
          <Bot className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-5">
          <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// 主组件
export function MessageList({ messages, isLoading, onRegenerate }: MessageListProps) {
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
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
            onRegenerate={onRegenerate}
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
