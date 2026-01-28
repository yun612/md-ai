import { useDebounceFn } from '@vueuse/core'
import { nanoid } from 'nanoid'
import htmlParser from 'prettier/parser-html'
import prettier from 'prettier/standalone'

/**
 * 为 HTML 元素添加 ID（如果缺少的话）
 * @param content 原始 HTML 字符串
 * @returns 添加了 ID 的 HTML 字符串
 */
function addIdsToHtmlElements(content: string): string {
  if (!content || content.trim() === ``)
    return content

  // 排除不需要 ID 的标签（自闭合标签和特殊标签）
  const excludedTags = new Set([
    `script`,
    `style`,
    `meta`,
    `link`,
    `br`,
    `hr`,
    `img`,
    `input`,
    `area`,
    `base`,
    `col`,
    `embed`,
    `source`,
    `track`,
    `wbr`,
    `!doctype`,
  ])

  // 匹配所有 HTML 开始标签（包括自闭合标签）
  // 格式: <tagName attributes> 或 <tagName attributes />
  /* eslint-disable regexp/no-super-linear-backtracking */
  const tagPattern = /<(\w+)([^>]*?)(\s*\/\s*>|>)/g

  return content.replace(tagPattern, (match, tagName, attributes, closing) => {
    const lowerTagName = tagName.toLowerCase()

    // 跳过不需要 ID 的标签
    if (excludedTags.has(lowerTagName))
      return match

    // 检查是否已经有 id 属性（支持单引号、双引号、无引号）
    // 匹配: id="value", id='value', id=value
    /* eslint-disable regexp/no-unused-capturing-group */
    const idPattern = /\bid\s*=\s*(["'])([^"']+)\1|\bid\s*=\s*([^\s>]+)/i
    if (idPattern.test(attributes))
      return match

    // 生成新的 ID
    const newId = nanoid()
    const isSelfClosing = closing.trim() === `/`

    // 在属性列表末尾添加 id 属性
    const trimmedAttributes = attributes.trim()
    const newAttributes = trimmedAttributes
      ? `${trimmedAttributes} id="${newId}"`
      : `id="${newId}"`

    // 重新组装标签
    if (isSelfClosing)
      return `<${tagName} ${newAttributes} />`
    else
      return `<${tagName} ${newAttributes}>`
  })
}

/**
 * 使用 Prettier 格式化 HTML 内容
 * @param content HTML 字符串
 * @returns 格式化后的 HTML 字符串
 */
async function prettierFormat(content: string): Promise<string> {
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
    throw error
  }
}

/**
 * 格式化 HTML 内容
 * 处理流程：添加 ID → Prettier 格式化
 * @param content 原始 HTML 字符串
 * @returns 格式化后的 HTML 字符串
 */
export async function formatHtml(content: string): Promise<string> {
  if (!content || content.trim() === ``)
    return content

  try {
    // 1. 先为元素添加 ID（在 prettier 之前）
    const withIds = addIdsToHtmlElements(content)
    console.log(`withIds`, withIds)
    // 2. 使用 Prettier 格式化
    const formatted = await prettierFormat(withIds)

    return formatted
  }
  catch (error) {
    console.error(`Format HTML error:`, error)
    return content
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
