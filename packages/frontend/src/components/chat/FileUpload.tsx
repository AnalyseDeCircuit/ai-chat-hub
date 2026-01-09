import { useRef, useState } from 'react'
import { X, FileText, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

const SUPPORTED_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.ms-excel': 'Excel',
  'text/csv': 'CSV',
  'text/plain': 'Text',
  'text/markdown': 'Markdown',
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

  const getFileTypeLabel = (mimeType: string): string => {
    return (
      SUPPORTED_TYPES[mimeType as keyof typeof SUPPORTED_TYPES] ||
      'File'
    )
  }

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

  const removeFile = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id))
  }

  const getFileIcon = (fileType: string) => {
    return <FileText className="w-4 h-4" />
  }

  return (
    <div>
      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 p-2 bg-accent/50 rounded-lg border border-border/50 group"
            >
              <div className="flex-shrink-0">
                {getFileIcon(file.fileType)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {file.fileName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {file.fileType} • {file.size}
                </div>
              </div>
              <button
                onClick={() => removeFile(file.id)}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                type="button"
                title="删除文件"
              >
                <X className="w-4 h-4 text-destructive hover:text-destructive/80" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="text-xs text-destructive mb-2 bg-destructive/10 px-2 py-1 rounded">
          {error}
        </div>
      )}

      {/* 上传按钮和状态 */}
      <div className="flex items-center gap-2">
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
          className="rounded-full"
          title={`上传文件 (${files.length}/${maxFiles})`}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
        </Button>

        {files.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {files.length}/{maxFiles}
          </div>
        )}
      </div>

      {/* 支持格式提示 */}
      <div className="text-xs text-muted-foreground mt-2">
        支持: {supportedFormats.join(', ')} • 最大 {(maxSize / 1024 / 1024).toFixed(0)}MB
      </div>
    </div>
  )
}
