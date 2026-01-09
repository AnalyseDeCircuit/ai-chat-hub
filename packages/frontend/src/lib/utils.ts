import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 生成会话标题：清理空白、只取首行、截断并加省略号
 * @param content 原始内容（通常是用户首条消息）
 * @param maxLength 最大字符数，默认 24
 */
export function buildSessionTitle(content: string, maxLength = 24): string {
  if (!content) return '新对话'
  
  // 去除首尾空白
  let title = content.trim()
  
  // 去除 markdown 标记
  title = title
    .replace(/^#+\s*/, '')           // 移除标题标记 # ## ###
    .replace(/^[-*+]\s*/, '')        // 移除列表标记
    .replace(/^\d+\.\s*/, '')        // 移除有序列表标记
    .replace(/\*\*(.+?)\*\*/g, '$1') // 移除粗体
    .replace(/\*(.+?)\*/g, '$1')     // 移除斜体
    .replace(/`(.+?)`/g, '$1')       // 移除行内代码
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 移除链接，保留文字
  
  // 只取第一行
  const firstLine = title.split(/[\r\n]/)[0] || title
  
  // 压缩连续空格
  title = firstLine.replace(/\s+/g, ' ').trim()
  
  // 如果是纯 URL，提取域名
  if (/^https?:\/\//i.test(title)) {
    try {
      const url = new URL(title)
      title = url.hostname
    } catch {
      // 解析失败则保留原样
    }
  }
  
  // 截断并加省略号
  if (title.length > maxLength) {
    title = title.slice(0, maxLength).trim() + '…'
  }
  
  return title || '新对话'
}
