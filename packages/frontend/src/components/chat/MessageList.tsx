import { useEffect, useRef } from 'react'
import { Bot, User, Copy, Check, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Message } from '@ai-chat-hub/shared'
import { useState } from 'react'

interface ChatMessage extends Message {
  isStreaming?: boolean
  streamContent?: string
}

interface MessageListProps {
  messages: ChatMessage[]
  isLoading?: boolean
  onRegenerate?: (messageId: string) => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="icon" className="w-6 h-6" onClick={handleCopy}>
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </Button>
  )
}

function MessageContent({ content, role }: { content: string; role: string }) {
  if (role === 'user') {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
  }

  return (
    <ReactMarkdown
      className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 text-sm"
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '')
          const codeText = String(children).replace(/\n$/, '')

          if (!inline && match) {
            return (
              <div className="relative group">
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton text={codeText} />
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  className="!mt-0 !mb-0 rounded-lg"
                  {...props}
                >
                  {codeText}
                </SyntaxHighlighter>
              </div>
            )
          }

          return (
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
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

export function MessageList({ messages, isLoading, onRegenerate }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-primary/80 w-fit mx-auto shadow-lg">
            <Bot className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-semibold">开始新对话</h2>
          <p className="text-muted-foreground max-w-md">
            选择一个 AI 模型，开始与 AI 助手对话。支持多模型切换，完整保留对话上下文。
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {messages.map((message, index) => {
          const isUser = message.role === 'user'
          const content = message.isStreaming
            ? message.streamContent || ''
            : message.content

          return (
            <div
              key={message.id}
              className={cn('flex gap-4', isUser && 'flex-row-reverse')}
            >
              {/* Avatar */}
              <Avatar className={cn('w-8 h-8 shrink-0', isUser && 'bg-primary')}>
                <AvatarFallback className={isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}>
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </AvatarFallback>
              </Avatar>

              {/* Message */}
              <div
                className={cn(
                  'flex-1 flex flex-col',
                  isUser ? 'items-end' : 'items-start'
                )}
              >
                <div
                  className={cn(
                    'relative px-4 py-3 rounded-2xl max-w-[85%] transition-all duration-200',
                    isUser
                      ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md'
                      : 'bg-muted/30 border border-border/50 text-foreground hover:bg-muted/40'
                  )}
                >
                  <MessageContent content={content} role={message.role} />
                  
                  {/* 流式加载时的光标 */}
                  {message.isStreaming && (
                    <span className="inline-block w-1.5 h-4 ml-1 bg-current opacity-50 animate-pulse rounded-full align-middle" />
                  )}
                </div>

                {/* Actions & Info */}
                <div className={cn(
                  "flex items-center gap-2 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                  isUser && "flex-row-reverse"
                )}>
                  {!isUser && !message.isStreaming && (
                    <>
                      <CopyButton text={message.content} />
                      {onRegenerate && index === messages.length - 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                          onClick={() => onRegenerate(message.id)}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                  {message.modelId && (
                    <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                      {message.modelId.split('/').pop()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Loading indicator */}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-4">
            <Avatar className="w-8 h-8 bg-muted">
              <AvatarFallback className="bg-muted text-muted-foreground">
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="bg-muted/50 rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
