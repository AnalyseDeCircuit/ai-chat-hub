import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Model } from '@ai-chat-hub/shared'
import { cn } from '@/lib/utils'

interface ModelSelectorProps {
  models: Model[]
  selectedModelId: string | null
  onModelChange: (modelId: string) => void
  disabled?: boolean
}

const PROVIDER_COLORS = {
  openai: 'text-emerald-500',
  anthropic: 'text-amber-500',
  google: 'text-blue-500',
  deepseek: 'text-violet-500',
  zhipu: 'text-indigo-500',
  moonshot: 'text-cyan-500',
  azure: 'text-sky-500',
  custom: 'text-gray-500',
} as const

const PROVIDER_NAMES = {
  openai: 'OpenAI',
  anthropic: 'Claude',
  google: 'Gemini',
  deepseek: 'DeepSeek',
  zhipu: '智谱AI',
  moonshot: 'Moonshot',
  azure: 'Azure',
  custom: 'Custom',
} as const

export function ModelSelector({
  models,
  selectedModelId,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  const selectedModel = models.find((m) => m.id === selectedModelId)

  return (
    <Select value={selectedModelId || ''} onValueChange={onModelChange} disabled={disabled}>
      <SelectTrigger className="w-[240px] h-9 bg-accent/50 border-0 rounded-full hover:bg-accent transition-all duration-200 focus:ring-4 focus:ring-primary/10">
        <SelectValue placeholder="选择 AI 模型">
          {selectedModel && (
            <div className="flex items-center gap-2 px-1">
              <div className={cn(
                "w-2 h-2 rounded-full",
                PROVIDER_COLORS[selectedModel.provider as keyof typeof PROVIDER_COLORS].replace('text-', 'bg-')
              )} />
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                {PROVIDER_NAMES[selectedModel.provider as keyof typeof PROVIDER_NAMES]}
              </span>
              <span className="text-sm font-medium truncate max-w-[100px]">{selectedModel.displayName}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover/95 backdrop-blur-2xl border-border/50 rounded-2xl shadow-2xl p-1">
        {models.map((model) => (
          <SelectItem
            key={model.id}
            value={model.id}
            className="rounded-xl hover:bg-accent focus:bg-accent py-2.5 px-3 transition-colors"
          >
            <div className="flex items-center justify-between w-full gap-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  PROVIDER_COLORS[model.provider as keyof typeof PROVIDER_COLORS].replace('text-', 'bg-')
                )} />
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold">
                    {model.displayName}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
                    {PROVIDER_NAMES[model.provider as keyof typeof PROVIDER_NAMES]} · {(model.contextLength / 1000).toFixed(0)}K 上下文
                  </span>
                </div>
              </div>
              {model.id === selectedModelId && <Check className="w-4 h-4 text-primary" />}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
