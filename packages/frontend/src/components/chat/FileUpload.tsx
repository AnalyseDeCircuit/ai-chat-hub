import { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'

export interface UploadedFile {
  id: string
  file: File
  fileName: string
  fileType: string
  size: string
  mimeType: string
  preview: string
}

interface FileUploadProps {
  files: UploadedFile[]
  onFilesChange: (files: UploadedFile[]) => void
  maxFiles?: number
  maxSize?: number // bytes
  supportedFormats?: string[]
  disabled?: boolean
}

export function FileUpload({
  files,
  onFilesChange,
  maxFiles = 5,
  maxSize = 50 * 1024 * 1024, // 50MB
  supportedFormats = ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt', 'md'],
  disabled = false,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles) return

    setError(null)
    setIsProcessing(true)

    try {
      const newFiles: UploadedFile[] = []

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const ext = file.name.split('.').pop()?.toLowerCase()

        // 验证文件类型
        if (!ext || !supportedFormats.includes(ext)) {
          throw new Error(
            `不支持的文件格式: ${ext}. 仅支持: ${supportedFormats.join(', ')}`
          )
        }

        // 验证文件大小
        if (file.size > maxSize) {
          throw new Error(
            `文件大小不能超过 ${(maxSize / 1024 / 1024).toFixed(1)}MB`
          )
        }

        // 验证文件数量
        if (files.length + newFiles.length >= maxFiles) {
          throw new Error(`最多只能上传 ${maxFiles} 个文件`)
        }

        newFiles.push({
          id: generateId(),
          file,
          fileName: file.name,
          fileType: ext.toUpperCase(),
          size: formatFileSize(file.size),
          mimeType: file.type,
          preview: `${file.name} (${formatFileSize(file.size)})`,
        })
      }

      onFilesChange([...files, ...newFiles])
    } catch (err: any) {
      setError(err.message || '文件上传失败')
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsProcessing(false)
      // 重置 input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="relative">
      {/* 错误提示 - 绝对定位避免布局跳动 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute bottom-full left-0 mb-2 text-xs text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg whitespace-nowrap shadow-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 上传按钮 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={supportedFormats.map((f) => `.${f}`).join(',')}
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || files.length >= maxFiles}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || files.length >= maxFiles || isProcessing}
        className="rounded-full hover:bg-accent transition-colors relative"
        title={`上传文件 (${files.length}/${maxFiles})`}
      >
        {isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : (
          <Upload className="w-5 h-5" />
        )}
        {files.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-[10px] font-bold text-primary-foreground rounded-full flex items-center justify-center">
            {files.length}
          </span>
        )}
      </Button>
    </div>
  )
}
