import { useState } from 'react'
import { Copy, Check, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ShareDialogProps {
  shareUrl: string
  onClose: () => void
}

export function ShareDialog({ shareUrl, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false)
  const fullUrl = `${window.location.origin}${shareUrl}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">分享会话</h2>
              <p className="text-sm text-muted-foreground">任何人都可以通过此链接查看</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-url">分享链接</Label>
            <div className="flex gap-2">
              <Input
                id="share-url"
                value={fullUrl}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button onClick={handleCopy} size="icon" variant={copied ? 'default' : 'outline'}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium">分享说明</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 分享后，任何人都可以查看此会话内容</li>
              <li>• 分享的会话内容为只读，无法修改</li>
              <li>• 您可以随时取消分享</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-6 border-t border-border bg-muted/30">
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}
