import type { RendererAPI } from '@md/shared/types'
import type { ReadTimeResults } from 'reading-time'
import DOMPurify from 'isomorphic-dompurify'
import { marked } from 'marked'

/**
 * 渲染 Markdown 内容
 * @param raw - 原始 markdown 字符串
 * @param renderer - 渲染器 API
 * @returns 渲染结果，包含 HTML 和阅读时间
 */
export function renderMarkdown(raw: string, renderer: RendererAPI) {
  // 解析 front-matter 和正文
  const { markdownContent, readingTime }
    = renderer.parseFrontMatterAndContent(raw)

  // marked -> html
  let html = marked.parse(markdownContent) as string

  // XSS 处理
  html = DOMPurify.sanitize(html, { ADD_TAGS: [`mp-common-profile`] })

  return { html, readingTime }
}

/**
 * 后处理 HTML 内容
 * @param baseHtml - 基础 HTML 字符串
 * @param reading - 阅读时间结果
 * @param renderer - 渲染器 API
 * @returns 处理后的 HTML 字符串
 */

/**
 * 将十六进制颜色转换为 RGB
 */
function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null
}

/**
 * 生成带透明度的颜色（RGBA格式）
 */
function colorWithOpacity(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return hex
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
}

/**
 * 处理颜色变量，支持主题色变量
 * @param color - 颜色值，支持 {{primaryColor}} 和 {{primaryColorLight}} 变量
 * @param primaryColor - 主题色
 * @param defaultColor - 默认颜色
 * @returns 处理后的颜色值
 */
function resolveColor(color: string | undefined, primaryColor: string | undefined, defaultColor: string): string {
  if (!color) {
    return defaultColor
  }

  // 如果包含 {{primaryColorLight}} 变量，生成浅色透明背景
  if (color.includes(`{{primaryColorLight}}`)) {
    const resolvedColor = primaryColor || defaultColor
    // 使用主题色生成带透明度的浅色背景（透明度约 0.1-0.15）
    return color.replace(/\{\{primaryColorLight\}\}/g, colorWithOpacity(resolvedColor, 0.12))
  }

  // 如果包含 {{primaryColor}} 变量，替换为主题色
  if (color.includes(`{{primaryColor}}`)) {
    const resolvedColor = primaryColor || defaultColor
    return color.replace(/\{\{primaryColor\}\}/g, resolvedColor)
  }

  // 如果是特殊标记，使用主题色
  if (color === `primary` || color === `{{primary}}`) {
    return primaryColor || defaultColor
  }

  // 如果是 primaryLight 标记，生成浅色透明背景
  if (color === `primaryLight` || color === `{{primaryLight}}`) {
    const resolvedColor = primaryColor || defaultColor
    return colorWithOpacity(resolvedColor, 0.12)
  }

  return color
}

/**
 * 只包裹 H2 下的内容到容器中
 * @param html - HTML 字符串
 * @param options - 配置选项
 * @param options.enabled - 是否启用包裹功能
 * @param options.border - 是否显示边框
 * @param options.borderColor - 边框颜色
 * @param options.backgroundColor - 背景颜色
 * @param primaryColor - 主题色
 * @returns 处理后的 HTML 字符串
 */
function wrapH2Content(html: string, options?: {
  enabled?: boolean
  border?: boolean
  borderColor?: string
  backgroundColor?: string
}, primaryColor?: string): string {
  // 如果禁用了包裹功能，直接返回
  if (options?.enabled === false) {
    return html
  }
  // 在浏览器环境中使用 DOM 操作，更精确
  if (typeof document !== `undefined`) {
    try {
      const tempDiv = document.createElement(`div`)
      tempDiv.innerHTML = html

      // 只找到 H2 标题
      const h2Sections = Array.from(tempDiv.querySelectorAll(`section[data-heading-depth="2"]`))

      // 从后往前处理，避免索引问题
      for (let i = h2Sections.length - 1; i >= 0; i--) {
        const h2Section = h2Sections[i] as HTMLElement

        // 收集 H2 后面的所有内容，直到下一个 H1/H2 或容器结束
        const contentNodes: Node[] = []
        let currentNode = h2Section.nextSibling

        while (currentNode) {
          // 检查是否是下一个标题（H1 或 H2）
          if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const el = currentNode as HTMLElement
            const isHeading = el.getAttribute(`data-heading`) === `true`
            const headingDepth = el.getAttribute(`data-heading-depth`)
            if (isHeading && (headingDepth === `1` || headingDepth === `2`)) {
              break
            }
          }

          const nextSibling = currentNode.nextSibling
          contentNodes.push(currentNode)
          currentNode = nextSibling
        }

        // 如果有内容，创建容器并包裹
        if (contentNodes.length > 0) {
          const borderColor = resolveColor(options?.borderColor, primaryColor, `#87ceeb`) // 默认天空蓝，支持主题色
          const backgroundColor = resolveColor(options?.backgroundColor, primaryColor, `#fafafa`) // 支持主题色
          const showBorder = options?.border !== false // 默认显示边框

          let containerStyle = `background-color: ${backgroundColor}; border-radius: 8px; padding: 20px; margin: 15px 0;`

          if (showBorder) {
            // 使用主题色生成阴影（如果边框色是主题色）
            const shadowColor = borderColor === primaryColor
              ? borderColor
              : `rgba(135, 206, 235, 0.2)`
            containerStyle += ` border: 3px solid ${borderColor}; box-shadow: 0 2px 8px ${shadowColor};`
          }
          else {
            containerStyle += ` border: none;`
          }

          const container = document.createElement(`section`)
          container.setAttribute(`style`, containerStyle)

          // 将所有内容节点移到容器中
          contentNodes.forEach((node) => {
            container.appendChild(node)
          })

          // 将容器插入到 H2 后面
          h2Section.insertAdjacentElement(`afterend`, container)
        }
      }

      return tempDiv.innerHTML
    }
    catch (e) {
      console.warn(`H2 内容包裹失败，使用原始 HTML:`, e)
      return html
    }
  }

  // 服务端环境，使用正则表达式回退方案
  const h2Pattern = /(<section[^>]*data-heading-depth="2"[^>]*>[\s\S]*?<\/section>)([\s\S]*?)(?=<section[^>]*data-heading-depth="[12]"[^>]*>|$)/g

  return html.replace(h2Pattern, (_match, h2Section, content) => {
    const trimmedContent = content.trim()
    if (!trimmedContent)
      return h2Section

    const borderColor = resolveColor(options?.borderColor, primaryColor, `#87ceeb`) // 默认天空蓝，支持主题色
    const backgroundColor = resolveColor(options?.backgroundColor, primaryColor, `#fafafa`) // 支持主题色
    const showBorder = options?.border !== false // 默认显示边框

    let containerStyle = `background-color: ${backgroundColor}; border-radius: 8px; padding: 20px; margin: 15px 0;`

    if (showBorder) {
      // 使用主题色生成阴影（如果边框色是主题色）
      const shadowColor = borderColor === primaryColor
        ? borderColor
        : `rgba(135, 206, 235, 0.2)`
      containerStyle += ` border: 3px solid ${borderColor}; box-shadow: 0 2px 8px ${shadowColor};`
    }
    else {
      containerStyle += ` border: none;`
    }

    const container = `<section style="${containerStyle}">
${trimmedContent}
</section>`

    return `${h2Section}${container}`
  })
}

export function postProcessHtml(baseHtml: string, reading: ReadTimeResults, renderer: RendererAPI): string {
  // 阅读时间及字数统计
  let html = baseHtml
  html = renderer.buildReadingTime(reading) + html
  // 去除第一行的 margin-top
  html = html.replace(/(style=".*?)"/, `$1;margin-top: 0"`)

  // 只包裹 H2 下的内容到容器
  const headingTemplate = renderer.getOpts().headingTemplate
  const primaryColor = renderer.getOpts().primaryColor
  const wrapOptions = headingTemplate?.options
    ? {
        enabled: headingTemplate.options.wrapH2Content !== false,
        border: headingTemplate.options.h2ContentBorder !== false,
        borderColor: headingTemplate.options.h2ContentBorderColor,
        backgroundColor: headingTemplate.options.h2ContentBackgroundColor,
      }
    : undefined
  html = wrapH2Content(html, wrapOptions, primaryColor)

  // 引用脚注
  html += renderer.buildFootnotes()
  // 附加的一些 style
  html += renderer.buildAddition()
  html += `
    <style>
      .hljs.code__pre > .mac-sign {
        display: ${renderer.getOpts().isMacCodeBlock ? `flex` : `none`};
      }
    </style>
  `
  html += `
    <style>
      .code__pre {
        padding: 0 !important;
      }

      .hljs.code__pre code {
        display: -webkit-box;
        padding: 0.5em 1em 1em;
        overflow-x: auto;
        text-indent: 0;
      }
      h2 strong {
        color: inherit !important;
      }
    </style>
  `
  // 包裹 HTML
  return renderer.createContainer(html)
}

/**
 * 修改 HTML 内容
 * @param content - 原始内容
 * @param renderer - 渲染器 API
 * @returns 修改后的 HTML 字符串
 */
export function modifyHtmlContent(content: string, renderer: RendererAPI): string {
  const {
    markdownContent,
    readingTime: readingTimeResult,
  } = renderer.parseFrontMatterAndContent(content)

  let html = marked.parse(markdownContent) as string
  html = DOMPurify.sanitize(html, {
    ADD_TAGS: [`mp-common-profile`],
  })
  return postProcessHtml(html, readingTimeResult, renderer)
}
