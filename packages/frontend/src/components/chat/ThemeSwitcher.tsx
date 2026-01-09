import { Palette, Check } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTheme, Theme } from '@/components/ThemeProvider'
import { cn } from '@/lib/utils'

const THEMES: { value: Theme; label: string; color: string }[] = [
  { value: 'light', label: '简约明亮', color: 'bg-white' },
  { value: 'dark', label: '极致深邃', color: 'bg-slate-950' },
  { value: 'theme-violet', label: '紫色梦幻', color: 'bg-violet-950' },
  { value: 'theme-ocean', label: '蔚蓝深海', color: 'bg-sky-950' },
  { value: 'theme-green', label: '森林绿意', color: 'bg-emerald-950' },
  { value: 'theme-sepia', label: '复古羊皮', color: 'bg-[#f4ecd8]' },
]

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
      <SelectTrigger className="w-full h-9 bg-transparent border-slate-700/50 hover:bg-slate-800/50 text-slate-300">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          <SelectValue placeholder="切换主题" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
        {THEMES.map((t) => (
          <SelectItem
            key={t.value}
            value={t.value}
            className="hover:bg-slate-800 focus:bg-slate-800"
          >
            <div className="flex items-center gap-3 w-full">
              <div className={cn("w-3 h-3 rounded-full border border-slate-700", t.color)} />
              <span className="flex-1">{t.label}</span>
              {theme === t.value && <Check className="w-3 h-3 text-violet-500" />}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
