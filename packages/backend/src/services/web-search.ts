/**
 * Web Search Service - 联网搜索服务
 * 支持多种搜索引擎后端
 */
import { env } from '../config/env.js'

export interface SearchResult {
  title: string
  url: string
  snippet: string
  publishedDate?: string
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  totalResults: number
  searchTime: number
}

// 各搜索引擎响应类型
interface SearXNGResponse {
  results: Array<{
    title: string
    url: string
    content?: string
    publishedDate?: string
  }>
}

interface SerperResponse {
  organic?: Array<{
    title: string
    link: string
    snippet?: string
    date?: string
  }>
}

interface TavilyResponse {
  results?: Array<{
    title: string
    url: string
    content?: string
    published_date?: string
  }>
}

/**
 * 使用 SearXNG 进行搜索（自托管元搜索引擎）
 */
async function searchWithSearXNG(query: string, maxResults = 5): Promise<SearchResult[]> {
  const searxngUrl = env.SEARXNG_URL
  if (!searxngUrl) {
    throw new Error('SEARXNG_URL not configured')
  }

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    categories: 'general',
    language: 'zh-CN',
    safesearch: '1',
  })

  const response = await fetch(`${searxngUrl}/search?${params}`)
  if (!response.ok) {
    throw new Error(`SearXNG search failed: ${response.status}`)
  }

  const data = await response.json() as SearXNGResponse
  return data.results.slice(0, maxResults).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content || '',
    publishedDate: r.publishedDate,
  }))
}

/**
 * 使用 DuckDuckGo 进行搜索（免费，无需 API key）
 */
async function searchWithDuckDuckGo(query: string, maxResults = 5): Promise<SearchResult[]> {
  // DuckDuckGo 的 HTML 搜索结果（lite 版本更容易解析）
  const response = await fetch(
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Chat-Hub/1.0)',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.status}`)
  }

  const html = await response.text()
  const results: SearchResult[] = []
  
  // 简单解析 HTML 结果
  const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g
  const snippetRegex = /<td[^>]+class="result-snippet"[^>]*>([^<]+)<\/td>/g
  
  let linkMatch
  let snippetMatch
  const links: { url: string; title: string }[] = []
  const snippets: string[] = []

  while ((linkMatch = linkRegex.exec(html)) !== null && links.length < maxResults) {
    links.push({ url: linkMatch[1], title: linkMatch[2] })
  }

  while ((snippetMatch = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
    snippets.push(snippetMatch[1])
  }

  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
    })
  }

  return results
}

/**
 * 使用 Serper API 进行 Google 搜索
 */
async function searchWithSerper(query: string, maxResults = 5): Promise<SearchResult[]> {
  const apiKey = env.SERPER_API_KEY
  if (!apiKey) {
    throw new Error('SERPER_API_KEY not configured')
  }

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'cn',
      hl: 'zh-cn',
      num: maxResults,
    }),
  })

  if (!response.ok) {
    throw new Error(`Serper search failed: ${response.status}`)
  }

  const data = await response.json() as SerperResponse
  return (data.organic || []).slice(0, maxResults).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet || '',
    publishedDate: r.date,
  }))
}

/**
 * 使用 Tavily API 进行 AI 优化搜索
 */
async function searchWithTavily(query: string, maxResults = 5): Promise<SearchResult[]> {
  const apiKey = env.TAVILY_API_KEY
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not configured')
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`)
  }

  const data = await response.json() as TavilyResponse
  return (data.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content || '',
    publishedDate: r.published_date,
  }))
}

/**
 * 主搜索函数 - 自动选择可用的搜索后端
 */
export async function webSearch(query: string, maxResults = 5): Promise<SearchResponse> {
  const startTime = Date.now()
  let results: SearchResult[] = []
  let error: Error | null = null

  // 优先级：Tavily > Serper > SearXNG > DuckDuckGo
  const backends = [
    { name: 'Tavily', fn: searchWithTavily, condition: !!env.TAVILY_API_KEY },
    { name: 'Serper', fn: searchWithSerper, condition: !!env.SERPER_API_KEY },
    { name: 'SearXNG', fn: searchWithSearXNG, condition: !!env.SEARXNG_URL },
    { name: 'DuckDuckGo', fn: searchWithDuckDuckGo, condition: true }, // 始终可用
  ]

  for (const backend of backends) {
    if (!backend.condition) continue
    
    try {
      results = await backend.fn(query, maxResults)
      if (results.length > 0) {
        break
      }
    } catch (e) {
      error = e as Error
      console.warn(`Search backend ${backend.name} failed:`, e)
      continue
    }
  }

  if (results.length === 0 && error) {
    throw error
  }

  return {
    query,
    results,
    totalResults: results.length,
    searchTime: Date.now() - startTime,
  }
}

/**
 * 格式化搜索结果为 AI 可读的上下文
 */
export function formatSearchResultsForAI(response: SearchResponse): string {
  if (response.results.length === 0) {
    return `搜索 "${response.query}" 没有找到相关结果。`
  }

  let context = `以下是关于 "${response.query}" 的网络搜索结果：\n\n`
  
  response.results.forEach((result, index) => {
    context += `[${index + 1}] ${result.title}\n`
    context += `    URL: ${result.url}\n`
    context += `    ${result.snippet}\n\n`
  })

  context += `\n请基于以上搜索结果回答用户的问题。如果引用了某个来源，请注明出处。`
  
  return context
}
