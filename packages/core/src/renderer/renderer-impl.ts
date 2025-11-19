import type { ExtendedProperties, IOpts, RendererAPI, ThemeStyles } from '@md/shared/types'
import type { PropertiesHyphen } from 'csstype'
import type { RendererObject, Tokens } from 'marked'
import type { ReadTimeResults } from 'reading-time'
import { generateHeadingHTML } from '@md/shared/utils/headingTemplate'
import { cloneDeep, toMerged } from 'es-toolkit'
import frontMatter from 'front-matter'
import hljs from 'highlight.js/lib/core'
import { marked } from 'marked'
import readingTime from 'reading-time'
import { markedAlert, markedFootnotes, markedMarkup, markedPlantUML, markedRuby, markedSlider, markedToc, MDKatex } from '../extensions'
import { getStyleString } from '../utils'
import { COMMON_LANGUAGES, highlightAndFormatCode } from '../utils/languages'

Object.entries(COMMON_LANGUAGES).forEach(([name, lang]) => {
  hljs.registerLanguage(name, lang)
})

export { hljs }

marked.setOptions({
  breaks: true,
})
marked.use(markedSlider())

function buildTheme({ theme: _theme, fonts, size, isUseIndent, isUseJustify }: IOpts): ThemeStyles {
  const theme = cloneDeep(_theme)
  const base = toMerged(theme.base, {
    'font-family': fonts,
    'font-size': size,
  })

  if (isUseIndent) {
    theme.block.p = {
      'text-indent': `2em`,
      ...theme.block.p,
    }
  }

  if (isUseJustify) {
    theme.block.p = {
      'text-align': `justify`,
      ...theme.block.p,
    }
  }

  const mergeStyles = (styles: Record<string, PropertiesHyphen>): Record<string, ExtendedProperties> =>
    Object.fromEntries(
      Object.entries(styles).map(([ele, style]) => [ele, toMerged(base, style)]),
    )
  return {
    ...mergeStyles(theme.inline),
    ...mergeStyles(theme.block),
  } as ThemeStyles
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, `&amp;`) // 转义 &
    .replace(/</g, `&lt;`) // 转义 <
    .replace(/>/g, `&gt;`) // 转义 >
    .replace(/"/g, `&quot;`) // 转义 "
    .replace(/'/g, `&#39;`) // 转义 '
    .replace(/`/g, `&#96;`) // 转义 `
}

function buildAddition(): string {
  return `
    <style>
      .preview-wrapper pre::before {
        position: absolute;
        top: 0;
        right: 0;
        color: #ccc;
        text-align: center;
        font-size: 0.8em;
        padding: 5px 10px 0;
        line-height: 15px;
        height: 15px;
        font-weight: 600;
      }
    </style>
  `
}

function getStyles(styleMapping: ThemeStyles, tokenName: string, addition: string = ``): string {
  const dict = styleMapping[tokenName as keyof ThemeStyles]
  if (!dict) {
    return ``
  }
  const styles = getStyleString(dict)
  return `style="${styles}${addition}"`
}

function buildFootnoteArray(footnotes: [number, string, string][]): string {
  return footnotes
    .map(([index, title, link]) =>
      link === title
        ? `<code style="font-size: 90%; opacity: 0.6;">[${index}]</code>: <i style="word-break: break-all">${title}</i><br/>`
        : `<code style="font-size: 90%; opacity: 0.6;">[${index}]</code> ${title}: <i style="word-break: break-all">${link}</i><br/>`,
    )
    .join(`\n`)
}

function transform(legend: string | null | undefined, text: string | null, title: string | null): string {
  if (!legend) {
    return text || title || ``
  }
  const options = legend.split(`-`)
  for (const option of options) {
    if (option === `alt` && text) {
      return text
    }
    if (option === `title` && title) {
      return title
    }
  }
  return ``
}

const macCodeSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px" width="45px" height="13px" viewBox="0 0 450 130">
    <ellipse cx="50" cy="65" rx="50" ry="52" stroke="rgb(220,60,54)" stroke-width="2" fill="rgb(237,108,96)" />
    <ellipse cx="225" cy="65" rx="50" ry="52" stroke="rgb(218,151,33)" stroke-width="2" fill="rgb(247,193,81)" />
    <ellipse cx="400" cy="65" rx="50" ry="52" stroke="rgb(27,161,37)" stroke-width="2" fill="rgb(100,200,86)" />
  </svg>
`.trim()

interface ParseResult {
  yamlData: Record<string, any>
  markdownContent: string
  readingTime: ReadTimeResults
}

function parseFrontMatterAndContent(markdownText: string): ParseResult {
  try {
    const parsed = frontMatter(markdownText)
    const yamlData = parsed.attributes
    const markdownContent = parsed.body

    const readingTimeResult = readingTime(markdownContent)

    return {
      yamlData: yamlData as Record<string, any>,
      markdownContent,
      readingTime: readingTimeResult,
    }
  }
  catch (error) {
    console.error(`Error parsing front-matter:`, error)
    return {
      yamlData: {},
      markdownContent: markdownText,
      readingTime: readingTime(markdownText),
    }
  }
}

export function initRenderer(initialOpts: IOpts): RendererAPI {
  const footnotes: [number, string, string][] = []
  let footnoteIndex: number = 0
  let opts: IOpts = { ...initialOpts }
  let styleMapping: ThemeStyles = buildTheme(opts)
  let codeIndex: number = 0
  const listOrderedStack: boolean[] = []
  const listCounters: number[] = []

  function getOpts(): IOpts {
    return opts
  }

  function styles(tag: string, addition: string = ``): string {
    return getStyles(styleMapping, tag, addition)
  }

  function styledContent(styleLabel: string, content: string, tagName?: string): string {
    const tag = tagName ?? styleLabel

    return `<${tag} ${/^h\d$/.test(tag) ? `data-heading="true"` : ``} ${styles(styleLabel)}>${content}</${tag}>`
  }

  function addFootnote(title: string, link: string): number {
    // 检查是否已经存在相同的链接
    const existingFootnote = footnotes.find(([, , existingLink]) => existingLink === link)
    if (existingFootnote) {
      return existingFootnote[0] // 返回已存在的脚注索引
    }

    // 如果不存在，创建新的脚注
    footnotes.push([++footnoteIndex, title, link])
    return footnoteIndex
  }

  function reset(newOpts: Partial<IOpts>): void {
    footnotes.length = 0
    footnoteIndex = 0
    setOptions(newOpts)
  }

  function setOptions(newOpts: Partial<IOpts>): void {
    opts = { ...opts, ...newOpts }
    const oldStyle = JSON.stringify(styleMapping)
    styleMapping = buildTheme(opts)
    const newStyle = JSON.stringify(styleMapping)
    if (oldStyle !== newStyle) {
      marked.use(markedAlert({ styles: styleMapping }))
      marked.use(
        MDKatex({ nonStandard: true }, styles(`inline_katex`, `;line-height: 1;`), styles(`block_katex`, `;text-align: center;`),
        ),
      )
      marked.use(markedMarkup({ styles: styleMapping }))
    }
  }

  function buildReadingTime(readingTime: ReadTimeResults): string {
    if (!opts.countStatus) {
      return ``
    }
    if (!readingTime.words) {
      return ``
    }
    return `
      <blockquote ${styles(`blockquote`)}>
        <p ${styles(`blockquote_p`)}>字数 ${readingTime?.words}，阅读大约需 ${Math.ceil(readingTime?.minutes)} 分钟</p>
      </blockquote>
    `
  }

  const buildFootnotes = () => {
    if (!footnotes.length) {
      return ``
    }

    return (
      styledContent(`h4`, `引用链接`)
      + styledContent(`footnotes`, buildFootnoteArray(footnotes), `p`)
    )
  }

  // 图标和背景图 URL
  const iconUrl = `https://mmbiz.uecloud.com.cn/sz_mmbiz_gif/I1fyHmvzZiaXqWLwTRoib4mcGgQXe0uyNTIIU4Z5DPyWHc0AlPNFD6MA3RGpfegvSL7A3MeJ8XDiaLOL832gIAJYA/0?from=appmsg`
  const bgImageUrl = `https://mmbiz.uecloud.com.cn/sz_mmbiz_png/I1fyHmvzZiaXqWLwTRoib4mcGgQXe0uyNTqEWV7FyAZ2icPV08wW1v4MibjFeMbf9frCCVnibxzz0LzmkZA2PAyxOcQ/0?from=appmsg`

  // 浅绿色系配色（扩展版）
  const greenTheme = {
    lightGreen1: `#e8f5e9`, // 最浅绿
    lightGreen2: `#c8e6c9`, // 浅绿
    lightGreen3: `#a5d6a7`, // 中浅绿
    lightGreen4: `#81c784`, // 浅中绿
    green1: `#66bb6a`, // 中绿
    green2: `#4caf50`, // 标准绿
    green3: `#43a047`, // 深绿
    darkGreen: `#388e3c`, // 深绿
    mintGreen: `#d4f1d4`, // 薄荷绿
    sageGreen: `#b8d4b8`, // 鼠尾草绿
    limeGreen: `#c9e4c9`, // 酸橙绿
    seaGreen: `#9fcd9f`, // 海绿色
    forestGreen: `#5fa85f`, // 森林绿
    text: `rgba(0,0,0,.9)`,
    textLight: `rgba(0,0,0,.85)`,
  }

  // H2 保持原始样式
  function generateH2Template(text: string): string {
    return `<section style="display: flex; justify-content: center; align-items: center; margin: 20px 0;" data-heading="true" data-heading-depth="2">
  <!-- 整体容器 -->
  <section style="display: flex; justify-content: flex-start; align-items: center; flex-direction: column; margin-bottom: 5px;">
    <!-- 顶部装饰圆点 -->
    <section style="width: 17px; height: 17px; display: flex; justify-content: center; align-items: center; align-self: flex-start; background: rgb(255, 255, 255); border-radius: 50%; border: 1px solid rgb(0, 0, 0); z-index: 2; margin-left: 5px; margin-bottom: -8.1px;">
      <img 
        src="${iconUrl}" 
        style="width: 8px; height: 8px; vertical-align: middle;" 
        alt=""
      >
    </section>
    <!-- 标题主体（含前景背景+后景底色） -->
    <section style="display: flex; justify-content: flex-start; align-items: center; flex-direction: column;">
      <!-- 前景：带纹理的标题背景 -->
      <section 
        style="text-align: center; 
               background-image: url('${bgImageUrl}'); 
               background-size: 100% 100%; 
               padding: 9px 15px 14px 19px; 
               z-index: 1;"
      >
        <section style="color: rgb(0, 0, 0); letter-spacing: 2px;">
          <p style="margin: 0; font-size: 18px; font-weight: 600;">${text}</p>
        </section>
      </section>
      <!-- 后景：错位底色（增强层次感） -->
      <section 
        style="width: 100%; 
               height: 38px; 
               background: rgb(182, 229, 175); 
               border-radius: 5px; 
               transform: translateX(4px); 
               margin-top: -41.1px;"
      ></section>
    </section>
  </section>
</section>`
  }

  // 生成 H1 样式 - 带左侧斜切和装饰条
  function generateH1Template(text: string): string {
    return `<section style="margin: 28px 0; position: relative;" data-heading="true" data-heading-depth="1">
  <section style="position: relative; display: inline-block;">
    <!-- 左侧装饰条 -->
    <section style="position: absolute; left: -6px; top: 0; bottom: 0; width: 4px; background: ${greenTheme.green2}; border-radius: 2px;"></section>
    <!-- 图标 -->
    <section style="position: absolute; left: -18px; top: -12px; width: 28px; height: 28px; display: flex; justify-content: center; align-items: center; background: white; border-radius: 50%; border: 3px solid ${greenTheme.green2}; z-index: 3; box-shadow: 0 3px 8px rgba(76, 175, 80, 0.2);">
      <img src="${iconUrl}" style="width: 14px; height: 14px;" alt="">
    </section>
    <!-- 标题主体 - 左侧斜切梯形 -->
    <section style="position: relative; background: linear-gradient(135deg, ${greenTheme.lightGreen1} 0%, ${greenTheme.mintGreen} 100%); clip-path: polygon(12px 0%, 100% 0%, 100% 100%, 0% 100%); padding: 20px 36px 20px 48px; border-left: 4px solid ${greenTheme.green2}; box-shadow: 0 4px 16px rgba(76, 175, 80, 0.18);">
      <section style="color: rgba(0,0,0,.9); font-size: 30px; font-weight: 700; line-height: 1.6; letter-spacing: 0.5px;">
        <p style="margin: 0;">${text}</p>
      </section>
    </section>
  </section>
</section>`
  }

  // 生成 H3 样式 - 圆角矩形带左侧突出块
  function generateH3Template(text: string): string {
    return `<section style="display: inline-flex; align-items: center; background: ${greenTheme.lightGreen2}; border: 2px solid ${greenTheme.green1}; border-radius: 50px; padding: 8px 16px; font-family: 'Arial', sans-serif;" data-heading="true" data-heading-depth="3">
  <section style="font-size: 24px; font-weight: bold; margin-right: 12px;">${text.slice(0, 2)}</section>
  <section style="font-size: 18px; font-weight: 500;">${text.slice(2)}</section>
</section>`
  }

  // 生成 H4 样式 - 下划线+圆圈
  function generateH4Template(text: string): string {
    return `<section style="display: inline-flex; align-items: center; margin: 16px 0; padding-bottom: 8px; border-bottom: 2px solid ${greenTheme.green3}; font-family: 'Arial', sans-serif;" data-heading="true" data-heading-depth="4">
  <section style="width: 8px; height: 8px; border-radius: 50%; background: ${greenTheme.darkGreen}; margin-right: 10px; flex-shrink: 0;"></section>
  <section style="font-size: 16px; font-weight: 600; color: rgba(0,0,0,.9);">${text}</section>
</section>`
  }

  // 生成 H5 样式 - 圆角矩形
  function generateH5Template(text: string): string {
    return `<section style="display: inline-flex; align-items: center; background: ${greenTheme.lightGreen4}; border: 2px solid ${greenTheme.green3}; border-radius: 40px; padding: 6px 12px; font-family: 'Arial', sans-serif; margin: 16px 0;" data-heading="true" data-heading-depth="5">
  <section style="font-size: 15px; font-weight: 500;">${text}</section>
</section>`
  }

  // 生成 H6 样式 - 简约圆角
  function generateH6Template(text: string): string {
    return `<section style="display: inline-flex; align-items: center; background: ${greenTheme.lightGreen1}; border: 1.5px solid ${greenTheme.green3}; border-radius: 35px; padding: 5px 10px; font-family: 'Arial', sans-serif; margin: 14px 0;" data-heading="true" data-heading-depth="6">
  <section style="font-size: 14px; font-weight: 500;">${text}</section>
</section>`
  }

  // 生成标题模板的函数
  function generateHeadingTemplate(depth: number, text: string): string {
    switch (depth) {
      case 1:
        return generateH1Template(text)
      case 2:
        return generateH2Template(text)
      case 3:
        return generateH3Template(text)
      case 4:
        return generateH4Template(text)
      case 5:
        return generateH5Template(text)
      case 6:
        return generateH6Template(text)
      default:
        return styledContent(`h${depth}`, text)
    }
  }

  const renderer: RendererObject = {
    heading({ tokens, depth }: Tokens.Heading) {
      const text = this.parser.parseInline(tokens)

      // 如果提供了自定义模板，使用模板生成 H2-H6 标题
      if (opts.headingTemplate && depth >= 2 && depth <= 6) {
        return generateHeadingHTML(
          depth as 2 | 3 | 4 | 5 | 6,
          text,
          opts.headingTemplate,
          opts.primaryColor,
        )
      }

      // 使用内置模板生成 H1-H6 标题
      if (depth >= 1 && depth <= 6) {
        return generateHeadingTemplate(depth, text)
      }

      const tag = `h${depth}`
      return styledContent(tag, text)
    },

    paragraph({ tokens }: Tokens.Paragraph): string {
      const text = this.parser.parseInline(tokens)
      const isFigureImage = text.includes(`<figure`) && text.includes(`<img`)
      const isEmpty = text.trim() === ``
      if (isFigureImage || isEmpty) {
        return text
      }
      return styledContent(`p`, text)
    },

    blockquote({ tokens }: Tokens.Blockquote): string {
      let text = this.parser.parse(tokens)
      text = text.replace(/<p .*?>/g, `<p ${styles(`blockquote_p`)}>`)
      return styledContent(`blockquote`, text)
    },

    code({ text, lang = `` }: Tokens.Code): string {
      if (lang.startsWith(`mermaid`)) {
        clearTimeout(codeIndex)
        codeIndex = setTimeout(async () => {
          // 优先使用全局 CDN 的 mermaid
          if (typeof window !== `undefined` && (window as any).mermaid) {
            const mermaid = (window as any).mermaid
            await mermaid.run()
          }
          else {
            // 回退到动态导入（开发环境）
            const mermaid = await import(`mermaid`)
            await mermaid.default.run()
          }
        }, 0) as any as number
        return `<pre class="mermaid">${text}</pre>`
      }
      const langText = lang.split(` `)[0]
      const isLanguageRegistered = hljs.getLanguage(langText)
      const language = isLanguageRegistered ? langText : `plaintext`

      const highlighted = highlightAndFormatCode(text, language, hljs, !!opts.isShowLineNumber)

      const span = `<span class="mac-sign" style="padding: 10px 14px 0;">${macCodeSvg}</span>`
      // 如果语言未注册，添加 data-language-pending 属性和原始代码文本用于后续动态加载
      let pendingAttr = ``
      if (!isLanguageRegistered && langText !== `plaintext`) {
        const escapedText = text.replace(/"/g, `&quot;`)
        pendingAttr = ` data-language-pending="${langText}" data-raw-code="${escapedText}" data-show-line-number="${opts.isShowLineNumber}"`
      }
      const code = `<code class="language-${lang}"${pendingAttr} ${styles(`code`)}>${highlighted}</code>`

      return `<pre class="hljs code__pre" ${styles(`code_pre`)}>${span}${code}</pre>`
    },

    codespan({ text }: Tokens.Codespan): string {
      const escapedText = escapeHtml(text)
      return styledContent(`codespan`, escapedText, `code`)
    },

    list({ ordered, items, start = 1 }: Tokens.List) {
      listOrderedStack.push(ordered)
      listCounters.push(Number(start))

      const html = items
        .map(item => this.listitem(item))
        .join(``)

      listOrderedStack.pop()
      listCounters.pop()

      return styledContent(
        ordered ? `ol` : `ul`,
        html,
      )
    },

    // 2. listitem：从栈顶取 ordered + counter，计算 prefix 并自增
    listitem(token: Tokens.ListItem) {
      const ordered = listOrderedStack[listOrderedStack.length - 1]
      const idx = listCounters[listCounters.length - 1]!

      // 准备下一个
      listCounters[listCounters.length - 1] = idx + 1

      const prefix = ordered
        ? `${idx}. `
        : `• `

      // 渲染内容：优先 inline，fallback 去掉 <p> 包裹
      let content: string
      try {
        content = this.parser.parseInline(token.tokens)
      }
      catch {
        content = this.parser
          .parse(token.tokens)
          .replace(/^<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/, `$1`)
      }

      return styledContent(
        `listitem`,
        `${prefix}${content}`,
        `li`,
      )
    },

    image({ href, title, text }: Tokens.Image): string {
      const subText = styledContent(`figcaption`, transform(opts.legend || null, text || null, title || null))
      const figureStyles = styles(`figure`)
      const imgStyles = styles(`image`)
      const safeTitle = title || ``
      const safeAlt = text || ``
      return `<figure ${figureStyles}><img ${imgStyles} src="${href}" title="${safeTitle}" alt="${safeAlt}"/>${subText}</figure>`
    },

    link({ href, title, text, tokens }: Tokens.Link): string {
      const parsedText = this.parser.parseInline(tokens)
      if (/^https?:\/\/mp\.weixin\.qq\.com/.test(href)) {
        return `<a href="${href}" title="${title || text}" ${styles(`wx_link`)}>${parsedText}</a>`
      }
      if (href === text) {
        return parsedText
      }
      if (opts.citeStatus) {
        const ref = addFootnote(title || text, href)
        return `<span ${styles(`link`)}>${parsedText}<sup>[${ref}]</sup></span>`
      }
      return styledContent(`link`, parsedText, `span`)
    },

    strong({ tokens }: Tokens.Strong): string {
      return styledContent(`strong`, this.parser.parseInline(tokens))
    },

    em({ tokens }: Tokens.Em): string {
      return styledContent(`em`, this.parser.parseInline(tokens), `span`)
    },

    table({ header, rows }: Tokens.Table): string {
      const headerRow = header
        .map((cell) => {
          const text = this.parser.parseInline(cell.tokens)
          return styledContent(`th`, text)
        })
        .join(``)
      const body = rows
        .map((row) => {
          const rowContent = row
            .map(cell => this.tablecell(cell))
            .join(``)
          return styledContent(`tr`, rowContent)
        })
        .join(``)
      return `
        <section style="max-width: 100%; overflow: auto">
          <table class="preview-table" ${styles(`table`)}>
            <thead ${styles(`thead`)}>${headerRow}</thead>
            <tbody>${body}</tbody>
          </table>
        </section>
      `
    },

    tablecell(token: Tokens.TableCell): string {
      const text = this.parser.parseInline(token.tokens)
      return styledContent(`td`, text)
    },

    hr(_: Tokens.Hr): string {
      return styledContent(`hr`, ``)
    },
  }

  marked.use({ renderer })
  marked.use(markedMarkup({ styles: styleMapping }))
  marked.use(markedToc())
  marked.use(markedSlider({ styles: styleMapping }))
  marked.use(markedAlert({ styles: styleMapping }))
  marked.use(
    MDKatex({ nonStandard: true }, styles(`inline_katex`, `;line-height: 1;`), styles(`block_katex`, `;text-align: center;`),
    ),
  )
  marked.use(markedFootnotes())
  marked.use(markedPlantUML({
    inlineSvg: true, // 启用SVG内嵌，适用于微信公众号
  }))
  marked.use(markedRuby())

  return {
    buildAddition,
    buildFootnotes,
    setOptions,
    reset,
    parseFrontMatterAndContent,
    buildReadingTime,
    createContainer(content: string) {
      return styledContent(`container`, content, `section`)
    },
    getOpts,
  }
}
