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
 * 只包裹 H2 下的内容到容器中
 * @param html - HTML 字符串
 * @returns 处理后的 HTML 字符串
 */
function wrapH2Content(html: string): string {
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

        // 如果有内容，创建容器并包裹（使用天空蓝边框）
        if (contentNodes.length > 0) {
          const borderColor = `#87ceeb` // 天空蓝
          const container = document.createElement(`section`)
          container.setAttribute(
            `style`,
            `background-color: #fafafa; border: 3px solid ${borderColor}; border-radius: 8px; padding: 20px; margin: 15px 0; box-shadow: 0 2px 8px rgba(135, 206, 235, 0.2);`,
          )

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

  return html.replace(h2Pattern, (match, h2Section, content) => {
    const trimmedContent = content.trim()
    if (!trimmedContent)
      return h2Section

    const borderColor = `#87ceeb` // 天空蓝
    const container = `<section style="background-color: #fafafa; border: 3px solid ${borderColor}; border-radius: 8px; padding: 20px; margin: 15px 0; box-shadow: 0 2px 8px rgba(135, 206, 235, 0.2);">
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
  html = wrapH2Content(html)

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
