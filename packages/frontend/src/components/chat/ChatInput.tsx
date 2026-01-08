import { useState, useRef, useEffect } from 'react'
import { Send, Square, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  onStop: () => void
  isSending: boolean
  disabled?: boolean
}

export function ChatInput({
  onSend,
  onStop,
  isSending,
  disabled,
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [message])

  const handleSubmit = () => {
    if (message.trim() && !isSending && !disabled) {
      onSend(message.trim())
      setMessage('')
      // 重置高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="bg-transparent p-4 pb-8">
      <div className="max-w-5xl mx-auto">
        {/* Input Area */}
        <div className={cn(
          "relative flex items-end gap-2 p-2 px-4 transition-all duration-300",
          "bg-card/80 backdrop-blur-xl border border-border/50 rounded-[28px] shadow-2xl shadow-black/10",
          "focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5"
        )}>
          <div className="pb-1">
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0 w-10 h-10 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>

          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入任何问题..."
            disabled={disabled || isSending}
            className={cn(
              'flex-1 min-h-[44px] max-h-[250px] py-3 resize-none border-0 bg-transparent',
              'focus-visible:ring-0 focus-visible:ring-offset-0',
              'placeholder:text-muted-foreground/60 text-[15px] leading-relaxed'
            )}
            rows={1}
          />

          <div className="flex items-center pb-1">
            {isSending ? (
              <Button
                onClick={onStop}
                size="icon"
                className="shrink-0 w-10 h-10 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20 transition-all duration-200 active:scale-95"
              >
                <Square className="w-4 h-4 fill-current" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                size="icon"
                disabled={!message.trim() || disabled}
                className={cn(
                  'shrink-0 w-10 h-10 rounded-full transition-all duration-300',
                  'bg-primary text-primary-foreground shadow-lg shadow-primary/20',
                  'hover:scale-105 active:scale-95 disabled:grayscale disabled:opacity-30 disabled:scale-100'
                )}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Footer Hint */}
        <p className="mt-3 text-[11px] text-center text-muted-foreground/50 font-medium uppercase tracking-[0.1em]">
          AI-Chat Hub · Multi-Model Intelligence
        </p>
      </div>
    </div>
  )
}
