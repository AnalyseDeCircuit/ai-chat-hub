import { useRef, useState } from 'react'
import { X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface UploadedImage {
  id: string
  file: File
  preview: string
  base64: string
  mimeType: string
}

interface ImageUploadProps {
  images: UploadedImage[]
  onImagesChange: (images: UploadedImage[]) => void
  maxImages?: number
  maxSize?: number // bytes
  supportedFormats?: string[]
  disabled?: boolean
}

export function ImageUpload({
  images,
  onImagesChange,
  maxImages = 10,
  maxSize = 20971520, // 20MB
  supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  disabled = false,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const compressImage = async (file: File, maxWidth = 1024): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: file.type }))
              } else {
                resolve(file)
              }
            },
            file.type,
            0.85
          )
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setError(null)
    setIsProcessing(true)

    try {
      const newImages: UploadedImage[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // 验证文件类型
        const ext = file.name.split('.').pop()?.toLowerCase()
        if (!ext || !supportedFormats.includes(ext)) {
          throw new Error(`不支持的文件格式: ${ext}. 仅支持: ${supportedFormats.join(', ')}`)
        }

        // 验证文件大小
        if (file.size > maxSize) {
          throw new Error(`图片大小不能超过 ${(maxSize / 1024 / 1024).toFixed(1)}MB`)
        }

        // 验证数量
        if (images.length + newImages.length >= maxImages) {
          throw new Error(`最多只能上传 ${maxImages} 张图片`)
        }

        // 压缩图片
        const compressed = await compressImage(file)

        // 转换为 Base64
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = (e) => {
            const result = e.target?.result as string
            // 移除 "data:image/xxx;base64," 前缀
            const base64 = result.split(',')[1]
            resolve(base64)
          }
          reader.readAsDataURL(compressed)
        })

        const base64 = await base64Promise
        const preview = URL.createObjectURL(compressed)

        newImages.push({
          id: generateId(),
          file: compressed,
          preview,
          base64,
          mimeType: compressed.type,
        })
      }

      onImagesChange([...images, ...newImages])
    } catch (err: any) {
      setError(err.message || '图片上传失败')
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsProcessing(false)
      // 重置 input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeImage = (id: string) => {
    const image = images.find((img) => img.id === id)
    if (image) {
      URL.revokeObjectURL(image.preview)
    }
    onImagesChange(images.filter((img) => img.id !== id))
  }

  return (
    <div>
      {/* 图片预览 */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border"
            >
              <img
                src={img.preview}
                alt={img.file.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                type="button"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">
                {img.file.name}
              </div>
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

      {/* 上传按钮 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={supportedFormats.map((f) => `.${f}`).join(',')}
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || images.length >= maxImages}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || images.length >= maxImages || isProcessing}
        className="rounded-full"
        title={`上传图片 (${images.length}/${maxImages})`}
      >
        {isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <ImageIcon className="w-5 h-5" />
        )}
      </Button>
    </div>
  )
}
