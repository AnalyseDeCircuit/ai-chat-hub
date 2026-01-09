import { useState, useEffect } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { chatApi } from '@/api'

interface ModelConfig {
  temperature: number
  maxTokens: number
  topP: number
  systemPrompt: string | null
}

interface ModelConfigDialogProps {
  modelId: string | null
  modelName?: string
  disabled?: boolean
}

export function ModelConfigDialog({ modelId, modelName, disabled }: ModelConfigDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<ModelConfig>({
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    systemPrompt: null,
  })

  // 加载配置
  useEffect(() => {
    if (open && modelId) {
      setLoading(true)
      chatApi.getModelConfig(modelId)
        .then((data) => {
          setConfig({
            temperature: data.temperature ?? 0.7,
            maxTokens: data.maxTokens ?? 2048,
            topP: data.topP ?? 1.0,
            systemPrompt: data.systemPrompt ?? null,
          })
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [open, modelId])

  // 保存配置
  const handleSave = async () => {
    if (!modelId) return
    
    setSaving(true)
    try {
      await chatApi.updateModelConfig(modelId, config)
      setOpen(false)
    } catch (error) {
      console.error('保存配置失败:', error)
    } finally {
      setSaving(false)
    }
  }

  // 重置为默认值
  const handleReset = () => {
    setConfig({
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1.0,
      systemPrompt: null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full hover:bg-accent"
          disabled={disabled || !modelId}
          title="模型参数设置"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>模型参数设置</DialogTitle>
          <DialogDescription>
            {modelName ? `当前模型: ${modelName}` : '调整模型生成参数'}
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">加载中...</div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Temperature */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature">Temperature</Label>
                <span className="text-sm text-muted-foreground font-mono">
                  {config.temperature.toFixed(2)}
                </span>
              </div>
              <Slider
                id="temperature"
                min={0}
                max={2}
                step={0.01}
                value={[config.temperature]}
                onValueChange={([value]) => setConfig(c => ({ ...c, temperature: value }))}
              />
              <p className="text-xs text-muted-foreground">
                控制输出的随机性。较低的值使输出更确定，较高的值更有创造性。
              </p>
            </div>

            {/* Top P */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="topP">Top P</Label>
                <span className="text-sm text-muted-foreground font-mono">
                  {config.topP.toFixed(2)}
                </span>
              </div>
              <Slider
                id="topP"
                min={0}
                max={1}
                step={0.01}
                value={[config.topP]}
                onValueChange={([value]) => setConfig(c => ({ ...c, topP: value }))}
              />
              <p className="text-xs text-muted-foreground">
                核采样。只考虑概率累计达到 top_p 的候选 token。
              </p>
            </div>

            {/* Max Tokens */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <span className="text-sm text-muted-foreground font-mono">
                  {config.maxTokens}
                </span>
              </div>
              <Slider
                id="maxTokens"
                min={256}
                max={16384}
                step={256}
                value={[config.maxTokens]}
                onValueChange={([value]) => setConfig(c => ({ ...c, maxTokens: value }))}
              />
              <p className="text-xs text-muted-foreground">
                生成回复的最大 token 数量。
              </p>
            </div>

            {/* System Prompt */}
            <div className="space-y-3">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                placeholder="你是一个有帮助的AI助手..."
                value={config.systemPrompt || ''}
                onChange={(e) => setConfig(c => ({ ...c, systemPrompt: e.target.value || null }))}
                className="min-h-[100px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                设置AI的行为和角色。留空使用默认设置。
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            重置默认
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
