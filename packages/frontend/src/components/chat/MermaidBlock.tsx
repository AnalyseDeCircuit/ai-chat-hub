/**
 * MermaidBlock - Mermaid 图表渲染组件
 * GitHub 风格：直接渲染 SVG，超出容器时显示滚动条
 */
import { useEffect, useState, useMemo, useRef, memo } from 'react'
import mermaid from 'mermaid'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 初始化 Mermaid 配置
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'Inter, Noto Sans SC, sans-serif',
})

// 全局缓存：code hash -> svg string
const svgCache = new Map<string, string>()
let renderCounter = 0

// 简单的字符串 hash
function hashCode(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

interface MermaidBlockProps {
  code: string
}

export const MermaidBlock = memo(function MermaidBlock({ code }: MermaidBlockProps) {
  const trimmedCode = code.trim()
  const codeHash = useMemo(() => hashCode(trimmedCode), [trimmedCode])
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [svg, setSvg] = useState<string>(() => svgCache.get(codeHash) || '')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // 如果缓存中已有，直接使用
    const cached = svgCache.get(codeHash)
    if (cached) {
      setSvg(cached)
      setError(null)
      return
    }

    let isMounted = true
    const renderId = `mermaid-${codeHash}-${++renderCounter}`

    const renderDiagram = async () => {
      try {
        // 验证语法
        await mermaid.parse(trimmedCode)

        // 渲染 SVG
        const result = await mermaid.render(renderId, trimmedCode)
        
        if (!isMounted) return

        // 存入缓存
        svgCache.set(codeHash, result.svg)
        
        setSvg(result.svg)
        setError(null)
      } catch (e) {
        if (isMounted) {
          setError((e as Error).message || '图表渲染失败')
          setSvg('')
        }
      }
    }

    renderDiagram()

    return () => {
      isMounted = false
    }
  }, [codeHash, trimmedCode])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(trimmedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (error) {
    return (
      <div className="my-4 rounded-xl border border-destructive/50 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-destructive mb-2">
          <span className="font-medium">图表渲染失败</span>
        </div>
        <pre className="text-xs text-muted-foreground overflow-auto">{error}</pre>
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer">查看源码</summary>
          <pre className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-auto">{trimmedCode}</pre>
        </details>
      </div>
    )
  }

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-border/50 bg-card/50">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/30">
        <span className="text-sm font-medium text-muted-foreground">Mermaid</span>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
          onClick={handleCopy}
          title="复制源码"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* 图表区域 - GitHub 风格：直接渲染 SVG，超出滚动 */}
      <div 
        ref={containerRef}
        className={cn(
          'overflow-auto p-4',
          'bg-white dark:bg-zinc-900',
          '[&_svg]:max-w-none [&_svg]:h-auto'
        )}
        style={{ maxHeight: '600px' }}
      >
        {svg ? (
          <div 
            className="inline-block min-w-fit"
            dangerouslySetInnerHTML={{ __html: svg }} 
          />
        ) : (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">渲染中...</span>
          </div>
        )}
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // 只有 code 变化时才重新渲染
  return prevProps.code.trim() === nextProps.code.trim()
})
