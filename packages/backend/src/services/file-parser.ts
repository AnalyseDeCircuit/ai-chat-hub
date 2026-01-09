import * as XLSX from 'xlsx'
import * as mammoth from 'mammoth'
import * as csvParse from 'csv-parse/sync'

// 延迟导入 PDF.js 以避免在 Node.js 环境中加载浏览器 API
let pdfjsLib: any = null

async function getPdfJS() {
  if (!pdfjsLib) {
    // 使用 legacy 版本，兼容 Node.js 环境
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  }
  return pdfjsLib
}

export interface ParsedFileContent {
  fileName: string
  fileType: string
  mimeType: string
  content: string
  pages?: number
  metadata?: Record<string, any>
}

export class FileParserService {
  /**
   * 解析 PDF 文件
   */
  async parsePDF(buffer: Buffer, fileName: string): Promise<ParsedFileContent> {
    try {
      const pdfjs = await getPdfJS()
      // PDF.js 需要 Uint8Array，而不是 Buffer
      const uint8Array = new Uint8Array(buffer)
      
      // 使用兼容 Node.js 的配置
      const pdf = await pdfjs.getDocument({ 
        data: uint8Array,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise
      
      const pageCount = pdf.numPages
      let fullText = ''

      // 提取所有页面的文本
      for (let i = 1; i <= Math.min(pageCount, 50); i++) {
        // 限制最多 50 页
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
        fullText += `\n--- 第 ${i} 页 ---\n${pageText}`
      }

      return {
        fileName,
        fileType: 'pdf',
        mimeType: 'application/pdf',
        content: fullText.trim(),
        pages: pageCount,
        metadata: {
          totalPages: pageCount,
          extractedPages: Math.min(pageCount, 50) as number,
        } as Record<string, any>,
      }
    } catch (error) {
      throw new Error(`PDF 解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 解析 Word 文件（.docx）
   */
  async parseWord(buffer: Buffer, fileName: string): Promise<ParsedFileContent> {
    try {
      const result = await mammoth.extractRawText({ buffer })
      
      return {
        fileName,
        fileType: 'docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: result.value,
        metadata: {
          messages: result.messages.map(m => m.message),
        },
      }
    } catch (error) {
      throw new Error(`Word 文档解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 解析 Excel 文件
   */
  async parseExcel(buffer: Buffer, fileName: string): Promise<ParsedFileContent> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetNames = workbook.SheetNames
      let fullContent = ''

      // 提取所有工作表的内容
      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName]
        const csvContent = XLSX.utils.sheet_to_csv(worksheet)
        fullContent += `\n=== 工作表: ${sheetName} ===\n${csvContent}`
      }

      return {
        fileName,
        fileType: 'xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: fullContent.trim(),
        metadata: {
          sheetCount: sheetNames.length,
          sheetNames: sheetNames,
        },
      }
    } catch (error) {
      throw new Error(`Excel 文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 解析 CSV 文件
   */
  async parseCSV(buffer: Buffer, fileName: string): Promise<ParsedFileContent> {
    try {
      const text = buffer.toString('utf-8')
      const records = csvParse.parse(text, {
        columns: true,
        skip_empty_lines: true,
      })

      // 将记录转换为表格格式
      let content = ''
      if (records.length > 0) {
        const firstRecord = records[0] as Record<string, unknown>
        const headers = Object.keys(firstRecord)
        content = headers.join('\t') + '\n'
        for (const record of records.slice(0, 1000)) {
          // 限制最多 1000 行
          const recordData = record as Record<string, unknown>
          content += headers.map(h => recordData[h] || '').join('\t') + '\n'
        }
      }

      return {
        fileName,
        fileType: 'csv',
        mimeType: 'text/csv',
        content: content.trim(),
        metadata: {
          rowCount: records.length,
          columnCount: records.length > 0 ? Object.keys(records[0] as Record<string, unknown>).length : 0,
          columns: records.length > 0 ? Object.keys(records[0] as Record<string, unknown>) : [],
          limitedRows: Math.min(records.length, 1000),
        },
      }
    } catch (error) {
      throw new Error(`CSV 文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 解析 TXT 文件
   */
  async parseTXT(buffer: Buffer, fileName: string): Promise<ParsedFileContent> {
    const text = buffer.toString('utf-8')
    
    return {
      fileName,
      fileType: 'txt',
      mimeType: 'text/plain',
      content: text,
      metadata: {
        size: buffer.length,
        lines: text.split('\n').length,
      },
    }
  }

  /**
   * 解析 Markdown 文件
   */
  async parseMarkdown(buffer: Buffer, fileName: string): Promise<ParsedFileContent> {
    const text = buffer.toString('utf-8')
    
    return {
      fileName,
      fileType: 'md',
      mimeType: 'text/markdown',
      content: text,
      metadata: {
        size: buffer.length,
        lines: text.split('\n').length,
      },
    }
  }

  /**
   * 通用文件解析入口
   */
  async parseFile(buffer: Buffer, fileName: string, mimeType: string): Promise<ParsedFileContent> {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''

    // 根据文件扩展名或 MIME 类型判断
    if (ext === 'pdf' || mimeType === 'application/pdf') {
      return this.parsePDF(buffer, fileName)
    } else if (ext === 'docx' || mimeType.includes('wordprocessingml')) {
      return this.parseWord(buffer, fileName)
    } else if (
      ext === 'xlsx' ||
      ext === 'xls' ||
      mimeType.includes('spreadsheet')
    ) {
      return this.parseExcel(buffer, fileName)
    } else if (ext === 'csv' || mimeType === 'text/csv') {
      return this.parseCSV(buffer, fileName)
    } else if (ext === 'txt' || mimeType === 'text/plain') {
      return this.parseTXT(buffer, fileName)
    } else if (ext === 'md' || mimeType === 'text/markdown') {
      return this.parseMarkdown(buffer, fileName)
    } else {
      // 尝试作为纯文本解析
      try {
        return this.parseTXT(buffer, fileName)
      } catch {
        throw new Error(`不支持的文件类型: ${ext || 'unknown'}`)
      }
    }
  }

  /**
   * 验证文件是否可解析
   */
  isSupportedFile(fileName: string, mimeType: string): boolean {
    const supportedExtensions = ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt', 'md']
    const supportedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/plain',
      'text/markdown',
    ]

    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    return (
      supportedExtensions.includes(ext) ||
      supportedMimeTypes.some(type => mimeType.includes(type))
    )
  }

  /**
   * 获取文件摘要（用于显示文件信息）
   */
  async getFileSummary(
    buffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{
    fileName: string
    fileType: string
    size: string
    preview: string
  }> {
    try {
      const parsed = await this.parseFile(buffer, fileName, mimeType)
      const preview = parsed.content.substring(0, 200)

      return {
        fileName,
        fileType: parsed.fileType,
        size: `${(buffer.length / 1024).toFixed(2)} KB`,
        preview: preview + (parsed.content.length > 200 ? '...' : ''),
      }
    } catch (error) {
      throw new Error(
        `获取文件摘要失败: ${error instanceof Error ? error.message : '未知错误'}`
      )
    }
  }
}

export const createFileParserService = (): FileParserService => {
  return new FileParserService()
}
