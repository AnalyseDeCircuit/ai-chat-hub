import { useState, useRef, useEffect } from 'react'
import { Send, Square, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ImageUpload, type UploadedImage } from './ImageUpload'
import { FileUpload, type UploadedFile } from './FileUpload'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (message: string, images?: UploadedImage[], files?: UploadedFile[]) => void
  onStop: () => void
  isSending: boolean
  disabled?: boolean
  visionCapabilities?: {
    supportsVision?: boolean
    maxImages?: number
    supportedFormats?: string[]
    maxImageSize?: number
  }
}

export function ChatInput({
  onSend,
  onStop,
  isSending,
  disabled,
  visionCapabilities,
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [files, setFiles] = useState<UploadedFile[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const supportsVision = visionCapabilities?.supportsVision ?? false

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
      onSend(
        message.trim(),
        images.length > 0 ? images : undefined,
        files.length > 0 ? files : undefined
      )
      setMessage('')
      setImages([])
      setFiles([])
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
        {/* Attachments Area */}
        {(images.length > 0 || files.length > 0) && (
          <div className="mb-4 space-y-3">
            {/* Image Attachments */}
            {images.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">📷 图片</div>
                <div className="flex flex-wrap gap-2">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group"
                    >
                      <img
                        src={img.preview}
                        alt={img.file.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => {
                          // Remove image
                        }}
                        className="absolute -top-1 -right-1 bg-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        type="button"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* File Attachments */}
            {files.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">📄 文件</div>
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2 bg-accent/50 rounded-lg border border-border/50 group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm truncate">{file.fileName}</div>
                          <div className="text-xs text-muted-foreground">{file.fileType} • {file.size}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          // Remove file
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        type="button"
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Area with Image/File Upload */}
        <div className={cn(
          "relative flex items-end gap-2 p-2 px-4 transition-all duration-300",
          "bg-card/80 backdrop-blur-xl border border-border/50 rounded-[28px] shadow-2xl shadow-black/10",
          "focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5"
        )}>
          {/* Image Upload */}
          {supportsVision && (
            <div className="pb-1">
              <ImageUpload
                images={images}
                onImagesChange={setImages}
                maxImages={visionCapabilities?.maxImages}
                maxSize={visionCapabilities?.maxImageSize}
                supportedFormats={visionCapabilities?.supportedFormats}
                disabled={disabled || isSending}
              />
            </div>
          )}

          {/* File Upload */}
          <div className="pb-1">
            <FileUpload
              files={files}
              onFilesChange={setFiles}
              maxFiles={5}
              maxSize={50 * 1024 * 1024} // 50MB
              supportedFormats={['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt', 'md']}
              disabled={disabled || isSending}
            />
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
