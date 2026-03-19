import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, X, FileText, Globe, SearchCheck, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ImageUpload, type UploadedImage } from './ImageUpload'
import { FileUpload, type UploadedFile } from './FileUpload'
import { cn } from '@/lib/utils'

export interface SendOptions {
  webSearch?: boolean
  enableTools?: boolean
}

interface ChatInputProps {
  onSend: (message: string, images?: UploadedImage[], files?: UploadedFile[], options?: SendOptions) => void
  onStop: () => void
  isSending: boolean
  disabled?: boolean
  visionCapabilities?: {
    supportsVision?: boolean
    maxImages?: number
    supportedFormats?: string[]
    maxImageSize?: number
  }
  supportsTools?: boolean // 当前模型是否支持 Function Calling
}

export function ChatInput({
  onSend,
  onStop,
  isSending,
  disabled,
  visionCapabilities,
  supportsTools = false,
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isComposing, setIsComposing] = useState(false) // 中文输入法状态
  const [webSearchEnabled, setWebSearchEnabled] = useState(false) // 联网搜索开关
  const [toolsEnabled, setToolsEnabled] = useState(false) // 工具调用开关
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const supportsVision = visionCapabilities?.supportsVision ?? false

  // 自动调整 textarea 高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [message])

  // 提交消息
  const handleSubmit = useCallback(() => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage || isSending || disabled) return

    onSend(
      trimmedMessage,
      images.length > 0 ? images : undefined,
      files.length > 0 ? files : undefined,
      { webSearch: webSearchEnabled, enableTools: toolsEnabled }
    )
    
    setMessage('')
    setImages([])
    setFiles([])
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [message, images, files, isSending, disabled, onSend])

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 如果正在使用输入法（如中文输入法），不处理 Enter
    if (isComposing) return
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit, isComposing])

  // 输入法开始组合（开始输入中文）
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true)
  }, [])

  // 输入法结束组合（选择中文完成）
  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false)
  }, [])

  // 移除图片
  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }, [])

  // 移除文件
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const hasAttachments = images.length > 0 || files.length > 0

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        {/* 附件预览区域 */}
        {hasAttachments && (
          <div className="mb-3 space-y-2">
            {/* 图片预览 */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group"
                  >
                    <img
                      src={img.preview}
                      alt={img.file.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* 文件预览 */}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border group"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate max-w-[150px]">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {file.fileType.toUpperCase()} · {file.size}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 输入区域 */}
        <div className={cn(
          'flex items-end gap-2 p-3 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
          'focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all'
        )}>
          {/* Agent 工具开关 */}
          {supportsTools && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'w-9 h-9 rounded-xl flex-shrink-0 transition-colors',
                toolsEnabled 
                  ? 'text-purple-500 hover:text-purple-600 bg-purple-500/10 hover:bg-purple-500/20' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setToolsEnabled(!toolsEnabled)}
              disabled={disabled || isSending}
              title={toolsEnabled ? '已开启 Agent 模式（联网搜索、计算器等）' : '开启 Agent 模式'}
            >
              <Wrench className="w-4 h-4" />
            </Button>
          )}

          {/* 联网搜索开关 */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'w-9 h-9 rounded-xl flex-shrink-0 transition-colors',
              webSearchEnabled 
                ? 'text-blue-500 hover:text-blue-600 bg-blue-500/10 hover:bg-blue-500/20' 
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
            disabled={disabled || isSending}
            title={webSearchEnabled ? '已开启联网搜索' : '开启联网搜索'}
          >
            {webSearchEnabled ? (
              <SearchCheck className="w-4 h-4" />
            ) : (
              <Globe className="w-4 h-4" />
            )}
          </Button>

          {/* 图片上传按钮 */}
          {supportsVision && (
            <ImageUpload
              images={images}
              onImagesChange={setImages}
              maxImages={visionCapabilities?.maxImages}
              maxSize={visionCapabilities?.maxImageSize}
              supportedFormats={visionCapabilities?.supportedFormats}
              disabled={disabled || isSending}
            />
          )}

          {/* 文件上传按钮 */}
          <FileUpload
            files={files}
            onFilesChange={setFiles}
            maxFiles={5}
            maxSize={50 * 1024 * 1024}
            supportedFormats={['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt', 'md']}
            disabled={disabled || isSending}
          />

          {/* 文本输入框 */}
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="输入消息..."
            disabled={disabled || isSending}
            className={cn(
              'flex-1 min-h-[40px] max-h-[200px] py-2 px-1 resize-none border-0 bg-transparent',
              'focus-visible:ring-0 focus-visible:ring-offset-0',
              'placeholder:text-muted-foreground/50 text-sm leading-relaxed'
            )}
            rows={1}
          />

          {/* 发送/停止按钮 */}
          {isSending ? (
            <Button
              onClick={onStop}
              size="icon"
              className="w-9 h-9 rounded-xl bg-destructive hover:bg-destructive/90"
            >
              <Square className="w-4 h-4 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              size="icon"
              disabled={!message.trim() || disabled}
              className={cn(
                'w-9 h-9 rounded-xl transition-all',
                message.trim()
                  ? 'bg-primary hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* 底部提示 */}
        <div className="mt-2 text-center">
          <p className="text-xs text-muted-foreground/50">
            {toolsEnabled && <span className="text-purple-500">🔧 Agent 模式 · </span>}
            {webSearchEnabled && !toolsEnabled && <span className="text-blue-500">🌐 联网搜索已开启 · </span>}
            {supportsVision ? '支持图片和文件上传' : '支持文件上传'} · 
            pdf, docx, xlsx, csv, txt, md · 最大 50MB
          </p>
        </div>
      </div>
    </div>
  )
}
