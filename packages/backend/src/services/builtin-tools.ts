/**
 * Built-in Tools - 内置工具实现
 * 不需要沙箱的安全工具
 */
import type { ToolDefinition } from '@ai-chat-hub/shared'
import { toolRegistry, type ToolHandler } from './tool-registry.js'
import { webSearch, formatSearchResultsForAI } from './web-search.js'
import { env } from '../config/env.js'

// ==================== Web Search 工具 ====================

const webSearchDefinition: ToolDefinition = {
  name: 'web_search',
  description: '在互联网上搜索信息。当用户询问最新信息、新闻、实时数据或你不确定的事实时使用此工具。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询关键词',
      },
      maxResults: {
        type: 'number',
        description: '返回的最大结果数量，默认为 5',
      },
    },
    required: ['query'],
  },
}

const webSearchHandler: ToolHandler = async (args) => {
  const { query, maxResults = 5 } = args as { query: string; maxResults?: number }
  
  try {
    const response = await webSearch(query, maxResults)
    return formatSearchResultsForAI(response)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`搜索失败: ${msg}`)
  }
}

// ==================== Get Current Time 工具 ====================

const getCurrentTimeDefinition: ToolDefinition = {
  name: 'get_current_time',
  description: '获取当前日期和时间。当用户询问现在几点、今天日期或需要时间相关信息时使用此工具。',
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: '时区，例如 "Asia/Shanghai"、"America/New_York"。默认为服务器时区。',
      },
      format: {
        type: 'string',
        description: '输出格式: "full"（完整）、"date"（仅日期）、"time"（仅时间）、"iso"（ISO格式）',
        enum: ['full', 'date', 'time', 'iso'],
      },
    },
    required: [],
  },
}

const getCurrentTimeHandler: ToolHandler = async (args) => {
  const { timezone, format = 'full' } = args as { timezone?: string; format?: string }
  
  const now = new Date()
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone || 'Asia/Shanghai',
  }
  
  switch (format) {
    case 'date':
      options.year = 'numeric'
      options.month = 'long'
      options.day = 'numeric'
      options.weekday = 'long'
      break
    case 'time':
      options.hour = '2-digit'
      options.minute = '2-digit'
      options.second = '2-digit'
      options.hour12 = false
      break
    case 'iso':
      return now.toISOString()
    case 'full':
    default:
      options.year = 'numeric'
      options.month = 'long'
      options.day = 'numeric'
      options.weekday = 'long'
      options.hour = '2-digit'
      options.minute = '2-digit'
      options.second = '2-digit'
      options.hour12 = false
      break
  }
  
  const formatter = new Intl.DateTimeFormat('zh-CN', options)
  return formatter.format(now)
}

// ==================== Calculator 工具 ====================

const calculatorDefinition: ToolDefinition = {
  name: 'calculator',
  description: '执行数学计算。支持基本运算（+、-、*、/）、幂运算（**）、取余（%）和常用数学函数。',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '要计算的数学表达式，例如 "2 + 2"、"Math.sqrt(16)"、"Math.sin(Math.PI/2)"',
      },
    },
    required: ['expression'],
  },
}

const calculatorHandler: ToolHandler = async (args) => {
  const { expression } = args as { expression: string }
  
  // 安全检查：只允许数学运算
  const safePattern = /^[\d\s+\-*/().%,Math\w]+$/
  if (!safePattern.test(expression)) {
    throw new Error('表达式包含不允许的字符')
  }
  
  // 禁止危险关键字
  const dangerousPatterns = [
    /\beval\b/i,
    /\bFunction\b/i,
    /\bimport\b/i,
    /\brequire\b/i,
    /\bprocess\b/i,
    /\bglobal\b/i,
    /\bwindow\b/i,
    /\bdocument\b/i,
    /\bfetch\b/i,
    /\bsetTimeout\b/i,
    /\bsetInterval\b/i,
  ]
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(expression)) {
      throw new Error('表达式包含不允许的函数')
    }
  }
  
  try {
    // 创建安全的数学上下文
    const mathContext = {
      Math,
      PI: Math.PI,
      E: Math.E,
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      sqrt: Math.sqrt,
      pow: Math.pow,
      log: Math.log,
      log10: Math.log10,
      log2: Math.log2,
      exp: Math.exp,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      sinh: Math.sinh,
      cosh: Math.cosh,
      tanh: Math.tanh,
      min: Math.min,
      max: Math.max,
      random: Math.random,
    }
    
    // 使用 Function 构造器在受限上下文中执行
    const fn = new Function(...Object.keys(mathContext), `return (${expression})`)
    const result = fn(...Object.values(mathContext))
    
    if (typeof result !== 'number' || !isFinite(result)) {
      return `结果: ${result}`
    }
    
    // 格式化数字结果
    if (Number.isInteger(result)) {
      return `结果: ${result}`
    }
    return `结果: ${result.toPrecision(10).replace(/\.?0+$/, '')}`
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`计算错误: ${msg}`)
  }
}

// ==================== URL Reader 工具 ====================

const urlReaderDefinition: ToolDefinition = {
  name: 'url_reader',
  description: '读取网页内容。当用户提供 URL 并希望了解其内容时使用此工具。',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要读取的网页 URL',
      },
      maxLength: {
        type: 'number',
        description: '返回内容的最大字符数，默认为 5000',
      },
    },
    required: ['url'],
  },
}

const urlReaderHandler: ToolHandler = async (args) => {
  const { url, maxLength = 5000 } = args as { url: string; maxLength?: number }
  
  // URL 验证
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('无效的 URL 格式')
  }
  
  // 只允许 http/https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('只支持 http/https 协议')
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Chat-Hub/1.0; +https://github.com/ai-chat-hub)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000), // 10秒超时
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const contentType = response.headers.get('content-type') || ''
    
    // 只处理文本内容
    if (!contentType.includes('text/') && !contentType.includes('application/json')) {
      throw new Error(`不支持的内容类型: ${contentType}`)
    }
    
    const text = await response.text()
    
    // 简单的 HTML 清理（移除脚本、样式、标签）
    let cleanText = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    // 截断
    if (cleanText.length > maxLength) {
      cleanText = cleanText.slice(0, maxLength) + '...[内容已截断]'
    }
    
    return `来自 ${url} 的内容:\n\n${cleanText}`
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`读取 URL 失败: ${msg}`)
  }
}

// ==================== 注册所有内置工具 ====================

/**
 * 初始化并注册所有内置工具
 */
export function registerBuiltinTools(): void {
  // Web Search（根据配置决定是否启用）
  if (env.TAVILY_API_KEY || env.SERPER_API_KEY || env.SEARXNG_URL) {
    toolRegistry.register(webSearchDefinition, webSearchHandler)
    console.log('✓ 已注册工具: web_search')
  }
  
  // Get Current Time（始终可用）
  toolRegistry.register(getCurrentTimeDefinition, getCurrentTimeHandler)
  console.log('✓ 已注册工具: get_current_time')
  
  // Calculator（始终可用）
  toolRegistry.register(calculatorDefinition, calculatorHandler)
  console.log('✓ 已注册工具: calculator')
  
  // URL Reader（始终可用）
  toolRegistry.register(urlReaderDefinition, urlReaderHandler)
  console.log('✓ 已注册工具: url_reader')
  
  console.log(`✓ 共注册 ${toolRegistry.size} 个内置工具`)
}

// 导出工具定义以供外部使用
export const builtinToolDefinitions = {
  web_search: webSearchDefinition,
  get_current_time: getCurrentTimeDefinition,
  calculator: calculatorDefinition,
  url_reader: urlReaderDefinition,
}
