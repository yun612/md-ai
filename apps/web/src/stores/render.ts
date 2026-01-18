import { initRenderer } from '@md/core'
import { themeMap } from '@md/shared/configs'
import { useHtmlEditorStore } from '@/components/editor/html-editor/useHtmlEditorStore'
import { css2json, customCssWithTemplate, customizeTheme, postProcessHtml, renderMarkdown } from '@/utils'
import { useHeadingTemplateStore } from './headingTemplate'
import { useThemeStore } from './theme'

/**
 * 渲染 Store
 * 负责 Markdown 渲染、HTML 输出、标题提取等
 */
export const useRenderStore = defineStore(`render`, () => {
  // 输出的 HTML
  const output = ref(``)

  // 阅读时间统计
  const readingTime = reactive({
    chars: 0,
    words: 0,
    minutes: 0,
    sections: 0,
    colors: [] as Array<{
      color: string
      percentage: number
    }>,
  })

  // 文章标题列表（用于生成目录）
  const titleList = ref<{
    url: string
    title: string
    level: number
  }[]>([])

  // 渲染器实例（延迟初始化）
  let renderer: ReturnType<typeof initRenderer> | null = null

  // 初始化渲染器
  const initRendererInstance = (cssContent: string, theme: any, fonts: string, size: string, options: any) => {
    const fontSize = Number(size.replace(`px`, ``))
    const themeConfig = customCssWithTemplate(
      css2json(cssContent),
      options.primaryColor,
      customizeTheme(theme, { fontSize, color: options.primaryColor }),
    )

    const headingTemplateStore = useHeadingTemplateStore()
    const headingTemplate = headingTemplateStore.currentTemplate

    renderer = initRenderer({
      theme: themeConfig,
      fonts,
      size,
      isUseIndent: options.isUseIndent,
      isUseJustify: options.isUseJustify,
      isMacCodeBlock: options.isMacCodeBlock,
      isShowLineNumber: options.isShowLineNumber,
      headingTemplate: headingTemplate || null,
      primaryColor: options.primaryColor,
    })

    return renderer
  }

  // 获取渲染器
  const getRenderer = () => renderer

  // 获取主题配置
  const getTheme = (cssContent: string, theme: any, size: string, color: string) => {
    const fontSize = Number(size.replace(`px`, ``))
    return customCssWithTemplate(
      css2json(cssContent),
      color,
      customizeTheme(theme, { fontSize, color }),
    )
  }

  // 提取标题
  const extractTitles = () => {
    const div = document.createElement(`div`)
    div.innerHTML = output.value
    const list = div.querySelectorAll<HTMLElement>(`[data-heading]`)

    titleList.value = []
    let i = 0
    for (const item of list) {
      item.setAttribute(`id`, `${i}`)
      titleList.value.push({
        url: `#${i}`,
        title: `${item.textContent}`,
        level: Number(item.tagName.slice(1)),
      })
      i++
    }
    output.value = div.innerHTML
  }

  // 从完整HTML文档中提取body内容
  function extractBodyFromHtml(htmlContent: string): string {
    if (!htmlContent || !htmlContent.trim()) {
      return ``
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlContent, `text/html`)

    const parseError = doc.querySelector(`parsererror`)
    if (parseError) {
      console.warn(`HTML解析错误，尝试直接提取body内容:`, parseError.textContent)
      const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)
      if (bodyMatch && bodyMatch[1]) {
        return bodyMatch[1].trim()
      }
      return htmlContent
    }

    const body = doc.body
    if (!body) {
      const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)
      if (bodyMatch && bodyMatch[1]) {
        return bodyMatch[1].trim()
      }
      return htmlContent
    }

    const bodyContent = body.innerHTML
    if (!bodyContent.trim()) {
      const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)
      if (bodyMatch && bodyMatch[1]) {
        return bodyMatch[1].trim()
      }
      return htmlContent
    }

    return bodyContent
  }

  function calculateReadingStats(htmlContent: string) {
    const tempDiv = document.createElement(`div`)
    tempDiv.innerHTML = htmlContent
    const textContent = tempDiv.textContent || ``

    const chars = textContent.length
    const minutes = Math.ceil(textContent.length / 400)

    const sectionElements = tempDiv.querySelectorAll(`section`)
    const sections = sectionElements.length

    const colorMap = new Map<string, number>()
    const allElements = tempDiv.querySelectorAll(`*`)
    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement
      const style = htmlEl.getAttribute(`style`)
      if (style) {
        const colorMatch = style.match(/color:\s*([^;]+)/i)
        if (colorMatch && colorMatch[1]) {
          const color = colorMatch[1].trim()
          colorMap.set(color, (colorMap.get(color) || 0) + 1)
        }
      }
    })

    const totalStyledElements = Array.from(colorMap.values()).reduce((sum, count) => sum + count, 0)
    const colors = Array.from(colorMap.entries())
      .map(([color, count]) => ({
        color,
        percentage: totalStyledElements > 0 ? Math.round((count / totalStyledElements) * 100) : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage)

    return { chars, minutes, sections, colors }
  }

  // 渲染内容
  const render = (content: string, options: any) => {
    const htmlEditorStore = useHtmlEditorStore()
    const isHtmlMode = htmlEditorStore.isHtmlMode

    if (isHtmlMode) {
      const bodyContent = extractBodyFromHtml(content)

      if (!bodyContent) {
        output.value = ``
        readingTime.chars = 0
        readingTime.words = 0
        readingTime.minutes = 0
        readingTime.sections = 0
        readingTime.colors = []
        titleList.value = []
        return output.value
      }

      const stats = calculateReadingStats(bodyContent)
      readingTime.chars = stats.chars
      readingTime.words = 0
      readingTime.minutes = stats.minutes
      readingTime.sections = stats.sections
      readingTime.colors = stats.colors

      const tempDiv = document.createElement(`div`)
      tempDiv.innerHTML = bodyContent

      const headingElements = tempDiv.querySelectorAll(`h1, h2, h3, h4, h5, h6`)
      titleList.value = []
      let i = 0
      for (const item of headingElements) {
        const clonedItem = item.cloneNode(true) as HTMLElement
        clonedItem.setAttribute(`id`, `${i}`)
        titleList.value.push({
          url: `#${i}`,
          title: item.textContent || ``,
          level: Number(item.tagName.slice(1)),
        })
        item.setAttribute(`id`, `${i}`)
        i++
      }

      output.value = tempDiv.innerHTML

      return output.value
    }

    if (!renderer) {
      throw new Error(`Renderer not initialized. Call initRendererInstance first.`)
    }

    const headingTemplateStore = useHeadingTemplateStore()
    const headingTemplate = headingTemplateStore.currentTemplate
    const themeStore = useThemeStore()

    renderer.reset({
      citeStatus: options.isCiteStatus,
      legend: options.legend,
      isUseIndent: options.isUseIndent,
      isUseJustify: options.isUseJustify,
      countStatus: options.isCountStatus,
      isMacCodeBlock: options.isMacCodeBlock,
      isShowLineNumber: options.isShowLineNumber,
      headingTemplate: headingTemplate || null,
      primaryColor: themeStore.primaryColor,
    })

    const { html: baseHtml, readingTime: readingTimeResult } = renderMarkdown(content, renderer)

    const stats = calculateReadingStats(baseHtml)
    readingTime.chars = stats.chars
    readingTime.words = 0
    readingTime.minutes = stats.minutes
    readingTime.sections = stats.sections
    readingTime.colors = stats.colors

    output.value = postProcessHtml(baseHtml, readingTimeResult, renderer)

    extractTitles()

    return output.value
  }

  // 更新主题
  const updateTheme = (cssContent: string, theme: any, fonts: string, size: string, color: string) => {
    if (!renderer)
      return

    const newTheme = getTheme(cssContent, theme, size, color)
    renderer.setOptions({
      theme: newTheme,
      fonts,
      size,
      primaryColor: color,
    })
  }

  // 更新 CSS（兼容旧接口）
  const updateCss = (cssContent: string) => {
    if (!renderer)
      return

    const themeStore = useThemeStore()
    const themeKey = themeStore.theme as keyof typeof themeMap
    const newTheme = getTheme(
      cssContent,
      themeMap[themeKey], // 使用 themeMap 将字符串转换为主题对象
      themeStore.fontSize,
      themeStore.primaryColor,
    )
    renderer.setOptions({
      theme: newTheme,
      primaryColor: themeStore.primaryColor,
    })
  }

  return {
    // State
    output,
    readingTime,
    titleList,

    // Actions
    initRendererInstance,
    getRenderer,
    render,
    updateTheme,
    updateCss,
    getTheme,
  }
})
