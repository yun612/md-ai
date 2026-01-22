import { useDebounceFn } from '@vueuse/core'
import htmlParser from 'prettier/parser-html'
import prettier from 'prettier/standalone'

/**
 * 格式化 HTML 内容
 * @param content 原始 HTML 字符串
 * @returns 格式化后的 HTML 字符串
 */
export async function formatHtml(content: string): Promise<string> {
  if (!content || content.trim() === ``)
    return content

  try {
    const formatted = await prettier.format(content, {
      parser: `html`,
      plugins: [htmlParser],
      printWidth: 120,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: false,
      trailingComma: `none`,
      bracketSpacing: true,
      htmlWhitespaceSensitivity: `ignore`,
      endOfLine: `lf`,
    })
    return formatted
  }
  catch (error) {
    console.error(`Prettier format error:`, error)
    return content // 如果格式化失败，返回原内容
  }
}

/**
 * 创建带防抖的格式化函数
 * @param callback 格式化完成后的回调函数
 * @param wait 防抖等待时间（毫秒）
 */
export function useDebouncedFormatter(callback: (formatted: string) => void, wait = 1000) {
  return useDebounceFn(async (content: string) => {
    const formatted = await formatHtml(content)
    callback(formatted)
  }, wait)
}
